"""
独立 Worker 启动脚本 - 数据库轮询模式
直接轮询 DB 中 queued/failed 状态的任务，无需 RabbitMQ 长连接
用法: python run_worker.py [document|course|question|all]
"""
import asyncio
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def run_document_parser():
    from sqlalchemy import select
    from app.models.document import DocumentParseTask
    from app.tasks.document_parser import _process_task
    from app.db.session import AsyncSessionLocal

    logger.info("[DocParser] 启动轮询模式...")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(DocumentParseTask)
                    .where(DocumentParseTask.status.in_(["queued"]))
                    .limit(5)
                )
                tasks = result.scalars().all()
                for task in tasks:
                    logger.info("[DocParser] 处理任务 %s", task.id)
                    await _process_task(str(task.id), db)
        except Exception as e:
            logger.error("[DocParser] 轮询错误: %s", e)
        await asyncio.sleep(5)


async def run_course_generator():
    from sqlalchemy import select
    from app.models.course import CourseGenerationTask
    from app.tasks.course_generator import _process_task
    from app.db.session import AsyncSessionLocal

    logger.info("[CourseGen] 启动轮询模式...")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(CourseGenerationTask)
                    .where(CourseGenerationTask.status.in_(["queued"]))
                    .limit(3)
                )
                tasks = result.scalars().all()
                for task in tasks:
                    payload = {
                        "task_id": str(task.id),
                        "course_id": str(task.course_id),
                        **(task.config or {}),
                    }
                    logger.info("[CourseGen] 处理任务 %s", task.id)
                    await _process_task(payload, db)
        except Exception as e:
            logger.error("[CourseGen] 轮询错误: %s", e)
        await asyncio.sleep(5)


async def run_question_generator():
    from sqlalchemy import select
    from app.models.question import QuestionGenerationTask
    from app.tasks.question_generator import _process_task
    from app.db.session import AsyncSessionLocal

    logger.info("[QuestionGen] 启动轮询模式...")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(QuestionGenerationTask)
                    .where(QuestionGenerationTask.status.in_(["queued"]))
                    .limit(3)
                )
                tasks = result.scalars().all()
                for task in tasks:
                    payload = {
                        "task_id": str(task.id),
                        **(task.config or {}),
                    }
                    logger.info("[QuestionGen] 处理任务 %s", task.id)
                    await _process_task(payload, db)
        except Exception as e:
            logger.error("[QuestionGen] 轮询错误: %s", e)
        await asyncio.sleep(5)


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    tasks = []
    if mode in ("document", "all"):
        tasks.append(run_document_parser())
    if mode in ("course", "all"):
        tasks.append(run_course_generator())
    if mode in ("question", "all"):
        tasks.append(run_question_generator())

    logger.info("Workers 启动 (模式: %s)，按 Ctrl+C 停止", mode)
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Workers 已停止")
