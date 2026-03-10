"""
课程生成 Worker
流程: 消费 course.generate 队列 → 从 DB 读取知识点 → Qwen 生成课程大纲与章节内容 → 存库
运行: python -m app.tasks.course_generator
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

import aio_pika
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.services.ai_client import generate_course
from app.services.mq import QUEUE_COURSE_GENERATE

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def _process_task(payload: dict, db: AsyncSession) -> None:
    from app.models.course import Course, CourseChapter, CourseGenerationTask, CourseVersion
    from app.models.knowledge import KnowledgePoint

    task_id = payload.get("task_id")
    course_id = payload.get("course_id")
    kp_ids: list[str] = payload.get("knowledge_point_ids", [])
    chapter_count: int = payload.get("chapter_count", 5)

    # 加载 GenerationTask
    result = await db.execute(
        select(CourseGenerationTask).where(CourseGenerationTask.id == uuid.UUID(task_id))
    )
    gen_task = result.scalar_one_or_none()
    if not gen_task:
        logger.error("CourseGenerationTask %s not found", task_id)
        return

    # 标记 running
    await db.execute(
        update(CourseGenerationTask)
        .where(CourseGenerationTask.id == gen_task.id)
        .values(status="running")
    )
    await db.commit()

    try:
        # 加载课程
        course_result = await db.execute(
            select(Course).where(Course.id == uuid.UUID(course_id))
        )
        course = course_result.scalar_one_or_none()
        if not course:
            raise ValueError(f"Course {course_id} not found")

        # 加载知识点
        if kp_ids:
            kp_result = await db.execute(
                select(KnowledgePoint).where(
                    KnowledgePoint.id.in_([uuid.UUID(k) for k in kp_ids]),
                    KnowledgePoint.status == "active",
                )
            )
        else:
            kp_result = await db.execute(
                select(KnowledgePoint).where(KnowledgePoint.status == "active").limit(50)
            )
        kps = kp_result.scalars().all()
        if not kps:
            raise ValueError("没有可用的知识点")

        kp_data = [{"name": kp.name, "description": kp.description or ""} for kp in kps]

        logger.info("Generating course '%s' from %d KPs...", course.title, len(kp_data))
        result_data = await generate_course(kp_data, course.title, chapter_count)

        summary = result_data.get("summary", "")
        chapters_data = result_data.get("chapters", [])

        if not chapters_data:
            raise ValueError("AI 未生成任何章节内容")

        # 获取当前最大版本号
        ver_result = await db.execute(
            select(CourseVersion)
            .where(CourseVersion.course_id == uuid.UUID(course_id))
            .order_by(CourseVersion.version_no.desc())
            .limit(1)
        )
        existing_ver = ver_result.scalar_one_or_none()
        next_ver_no = (existing_ver.version_no + 1) if existing_ver else 1

        # 创建新版本
        new_version = CourseVersion(
            id=uuid.uuid4(),
            course_id=uuid.UUID(course_id),
            version_no=next_ver_no,
            title=course.title,
            summary=summary,
            source_type="ai_generated",
            status="draft",
        )
        db.add(new_version)
        await db.flush()

        # 创建章节
        for i, chap in enumerate(chapters_data):
            chapter = CourseChapter(
                id=uuid.uuid4(),
                course_version_id=new_version.id,
                chapter_no=i + 1,
                title=str(chap.get("title", f"第{i+1}章"))[:255],
                content=str(chap.get("content", "")),
                estimated_duration_minutes=chap.get("duration_minutes"),
            )
            db.add(chapter)

        # 更新课程 current_version_id
        await db.execute(
            update(Course)
            .where(Course.id == uuid.UUID(course_id))
            .values(current_version_id=new_version.id)
        )

        # 完成任务
        await db.execute(
            update(CourseGenerationTask)
            .where(CourseGenerationTask.id == gen_task.id)
            .values(status="succeeded")
        )
        await db.commit()
        logger.info("Course %s generated: %d chapters", course_id, len(chapters_data))

    except Exception as exc:
        logger.error("CourseGenerationTask %s failed: %s", task_id, exc, exc_info=True)
        await db.rollback()
        await db.execute(
            update(CourseGenerationTask)
            .where(CourseGenerationTask.id == uuid.UUID(task_id))
            .values(status="failed", error_message=str(exc)[:500])
        )
        await db.commit()


async def main() -> None:
    logger.info("Course Generator Worker starting...")

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=1)
    queue = await channel.declare_queue(QUEUE_COURSE_GENERATE, durable=True)

    logger.info("Waiting for messages on queue: %s", QUEUE_COURSE_GENERATE)

    async def on_message(message: aio_pika.IncomingMessage) -> None:
        async with message.process(requeue=True):
            try:
                payload = json.loads(message.body)
                logger.info("Received course generate task: %s", payload.get("task_id"))
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
