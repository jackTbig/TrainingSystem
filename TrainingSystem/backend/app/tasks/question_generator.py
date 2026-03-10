"""
题目生成 Worker
流程: 消费 question.generate 队列 → 从 DB 读取知识点/章节内容 → Qwen 生成题目 → 存库
运行: python -m app.tasks.question_generator
"""
import asyncio
import json
import logging
import uuid

import aio_pika
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.services.ai_client import generate_questions
from app.services.mq import QUEUE_QUESTION_GENERATE

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def _process_task(payload: dict, db: AsyncSession) -> None:
    from app.models.question import Question, QuestionGenerationTask, QuestionVersion
    from app.models.knowledge import KnowledgePoint
    from app.models.course import CourseChapter

    task_id = payload.get("task_id")
    kp_ids: list[str] = payload.get("knowledge_point_ids", [])
    chapter_ids: list[str] = payload.get("chapter_ids", [])
    question_types: list[str] = payload.get("question_types", ["single_choice", "true_false", "short_answer"])
    count: int = payload.get("count", 10)
    owner_id: str | None = payload.get("owner_id")

    # 加载任务
    result = await db.execute(
        select(QuestionGenerationTask).where(QuestionGenerationTask.id == uuid.UUID(task_id))
    )
    gen_task = result.scalar_one_or_none()
    if not gen_task:
        logger.error("QuestionGenerationTask %s not found", task_id)
        return

    await db.execute(
        update(QuestionGenerationTask)
        .where(QuestionGenerationTask.id == gen_task.id)
        .values(status="running")
    )
    await db.commit()

    try:
        # 组合内容文本
        content_parts: list[str] = []

        if kp_ids:
            kp_result = await db.execute(
                select(KnowledgePoint).where(
                    KnowledgePoint.id.in_([uuid.UUID(k) for k in kp_ids]),
                    KnowledgePoint.status == "active",
                )
            )
        else:
            # 未指定时，取全部活跃知识点（最多30个）
            kp_result = await db.execute(
                select(KnowledgePoint).where(KnowledgePoint.status == "active").limit(30)
            )
        for kp in kp_result.scalars():
            content_parts.append(f"知识点：{kp.name}\n{kp.description or ''}")

        if chapter_ids:
            chap_result = await db.execute(
                select(CourseChapter).where(
                    CourseChapter.id.in_([uuid.UUID(c) for c in chapter_ids])
                )
            )
            for chap in chap_result.scalars():
                content_parts.append(f"章节：{chap.title}\n{chap.content}")

        if not content_parts:
            raise ValueError("没有可用的知识点或章节内容")

        source_content = "\n\n".join(content_parts)
        logger.info("Generating %d questions from %d content parts...", count, len(content_parts))

        questions_data = await generate_questions(source_content, question_types, count)
        if not questions_data:
            raise ValueError("AI 未生成任何题目")

        # 批量创建题目
        created = 0
        for q in questions_data:
            q_type = str(q.get("type", "single_choice"))
            stem = str(q.get("stem", "")).strip()
            if not stem:
                continue

            options = q.get("options")
            answer_json = q.get("answer", {"value": ""})
            if not isinstance(answer_json, dict):
                answer_json = {"value": answer_json}
            analysis = str(q.get("analysis", ""))
            difficulty = int(q.get("difficulty", 3))

            question = Question(id=uuid.uuid4(), status="draft")
            db.add(question)
            await db.flush()

            version = QuestionVersion(
                id=uuid.uuid4(),
                question_id=question.id,
                version_no=1,
                status="draft",
                question_type=q_type,
                stem=stem,
                options=options,
                answer_json=answer_json,
                analysis=analysis or None,
                difficulty_level=max(1, min(5, difficulty)),
            )
            db.add(version)
            await db.flush()

            await db.execute(
                update(Question)
                .where(Question.id == question.id)
                .values(current_version_id=version.id)
            )
            created += 1

        await db.execute(
            update(QuestionGenerationTask)
            .where(QuestionGenerationTask.id == gen_task.id)
            .values(status="succeeded")
        )
        await db.commit()
        logger.info("QuestionGenerationTask %s done: %d questions created", task_id, created)

    except Exception as exc:
        logger.error("QuestionGenerationTask %s failed: %s", task_id, exc, exc_info=True)
        await db.rollback()
        await db.execute(
            update(QuestionGenerationTask)
            .where(QuestionGenerationTask.id == uuid.UUID(task_id))
            .values(status="failed", error_message=str(exc)[:500])
        )
        await db.commit()


async def main() -> None:
    logger.info("Question Generator Worker starting...")

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=1)
    queue = await channel.declare_queue(QUEUE_QUESTION_GENERATE, durable=True)

    logger.info("Waiting for messages on queue: %s", QUEUE_QUESTION_GENERATE)

    async def on_message(message: aio_pika.IncomingMessage) -> None:
        async with message.process(requeue=True):
            try:
                payload = json.loads(message.body)
                logger.info("Received question generate task: %s", payload.get("task_id"))
                async with AsyncSessionLocal() as db:
                    await _process_task(payload, db)
            except Exception as exc:
                logger.error("Message processing error: %s", exc, exc_info=True)

    await queue.consume(on_message)
    logger.info("Worker ready. Press Ctrl+C to stop.")
    try:
        await asyncio.Future()
    finally:
        await connection.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
