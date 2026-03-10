"""
文档解析 Worker
流程: 消费 document.parse 队列 → 读取文件 → 分块 → Qwen 提取候选知识点 → 存库
运行: python -m app.tasks.document_parser
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aio_pika
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.services.ai_client import extract_knowledge_candidates
from app.services.mq import QUEUE_DOCUMENT_PARSE

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CHUNK_SIZE = 1500  # 每块字符数（大约 500 token）
CHUNK_OVERLAP = 200


def _extract_text_from_file(file_path: str, mime_type: str | None) -> str:
    """从文件中提取纯文本。"""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    mime = (mime_type or "").lower()

    if mime == "application/pdf" or path.suffix.lower() == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            texts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    texts.append(t)
            return "\n".join(texts)
        except Exception as e:
            logger.warning("pypdf 提取失败，回退到读取原始字节: %s", e)
            return path.read_text(errors="ignore")

    if mime in (
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ) or path.suffix.lower() in (".doc", ".docx"):
        try:
            from docx import Document as DocxDocument
            doc = DocxDocument(str(path))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            logger.warning("python-docx 提取失败: %s", e)
            return ""

    # 纯文本 / Markdown
    return path.read_text(encoding="utf-8", errors="replace")


def _split_chunks(text: str) -> list[str]:
    """简单滑动窗口分块。"""
    if not text.strip():
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - CHUNK_OVERLAP
    return chunks


async def _process_task(task_id: str, db: AsyncSession) -> None:
    # 延迟导入避免循环依赖
    from app.models.document import Document, DocumentChunk, DocumentParseTask, DocumentVersion
    from app.models.knowledge import KnowledgePointCandidate

    # 加载 task
    result = await db.execute(select(DocumentParseTask).where(DocumentParseTask.id == uuid.UUID(task_id)))
    task = result.scalar_one_or_none()
    if not task:
        logger.error("Task %s not found", task_id)
        return
    if task.status not in ("queued", "failed"):
        logger.info("Task %s already in status %s, skip", task_id, task.status)
        return

    # 标记 running
    await db.execute(
        update(DocumentParseTask)
        .where(DocumentParseTask.id == task.id)
        .values(status="running", started_at=datetime.now(timezone.utc))
    )
    await db.commit()

    try:
        # 加载版本记录
        ver_result = await db.execute(
            select(DocumentVersion).where(DocumentVersion.id == task.document_version_id)
        )
        version = ver_result.scalar_one_or_none()
        if not version:
            raise ValueError("DocumentVersion not found")

        # 加载文档
        doc_result = await db.execute(
            select(Document).where(Document.id == version.document_id)
        )
        doc = doc_result.scalar_one_or_none()
        if not doc:
            raise ValueError("Document not found")

        # 更新文档状态为 parsing
        await db.execute(
            update(Document).where(Document.id == doc.id).values(status="parsing")
        )
        await db.commit()

        # 提取文本
        logger.info("Extracting text from %s", version.file_path)
        text = _extract_text_from_file(version.file_path, version.mime_type)
        logger.info("Extracted %d chars", len(text))

        if not text.strip():
            raise ValueError("提取到的文本为空，请检查文件")

        # 分块并存储
        chunks = _split_chunks(text)
        logger.info("Split into %d chunks", len(chunks))

        chunk_ids: list[uuid.UUID] = []
        for i, chunk_text in enumerate(chunks):
            chunk = DocumentChunk(
                id=uuid.uuid4(),
                document_version_id=version.id,
                chunk_index=i,
                content=chunk_text,
                token_count=len(chunk_text) // 4,  # 粗估
            )
            db.add(chunk)
            await db.flush()
            chunk_ids.append(chunk.id)
        await db.commit()
        logger.info("Saved %d chunks", len(chunks))

        # 对每块调用 Qwen 提取候选知识点
        total_candidates = 0
        for i, (chunk_id, chunk_text) in enumerate(zip(chunk_ids, chunks)):
            logger.info("Processing chunk %d/%d", i + 1, len(chunks))
            try:
                candidates = await extract_knowledge_candidates(chunk_text)
                for c in candidates:
                    name = str(c.get("name", "")).strip()
                    if not name:
                        continue
                    candidate = KnowledgePointCandidate(
                        id=uuid.uuid4(),
                        document_chunk_id=chunk_id,
                        candidate_name=name[:255],
                        candidate_description=str(c.get("description", ""))[:2000] or None,
                        confidence_score=float(c.get("confidence", 0.8)),
                        status="pending",
                    )
                    db.add(candidate)
                    total_candidates += 1
                await db.commit()
            except Exception as e:
                logger.warning("Chunk %d AI extraction failed: %s", i, e)
                await db.rollback()

        logger.info("Saved %d candidate knowledge points", total_candidates)

        # 完成
        await db.execute(
            update(DocumentParseTask)
            .where(DocumentParseTask.id == task.id)
            .values(status="succeeded", finished_at=datetime.now(timezone.utc))
        )
        await db.execute(
            update(Document).where(Document.id == doc.id).values(status="parsed")
        )
        await db.commit()
        logger.info("Task %s done — %d candidates extracted", task_id, total_candidates)

    except Exception as exc:
        logger.error("Task %s failed: %s", task_id, exc, exc_info=True)
        await db.rollback()
        await db.execute(
            update(DocumentParseTask)
            .where(DocumentParseTask.id == uuid.UUID(task_id))
            .values(
                status="failed",
                error_message=str(exc)[:500],
                finished_at=datetime.now(timezone.utc),
            )
        )
        # 文档回到 failed 状态
        from app.models.document import Document as Doc2
        result2 = await db.execute(
            select(DocumentParseTask).where(DocumentParseTask.id == uuid.UUID(task_id))
        )
        t2 = result2.scalar_one_or_none()
        if t2:
            ver2 = await db.execute(
                select(DocumentVersion).where(DocumentVersion.id == t2.document_version_id)
            )
            v2 = ver2.scalar_one_or_none()
            if v2:
                await db.execute(
                    update(Doc2).where(Doc2.id == v2.document_id).values(status="failed")
                )
        await db.commit()


async def main() -> None:
    logger.info("Document Parser Worker starting...")

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=1)
    queue = await channel.declare_queue(QUEUE_DOCUMENT_PARSE, durable=True)

    logger.info("Waiting for messages on queue: %s", QUEUE_DOCUMENT_PARSE)

    async def on_message(message: aio_pika.IncomingMessage) -> None:
        async with message.process(requeue=True):
            try:
                payload = json.loads(message.body)
                task_id = payload.get("task_id")
                logger.info("Received task: %s", task_id)
                async with AsyncSessionLocal() as db:
                    await _process_task(task_id, db)
            except Exception as exc:
                logger.error("Message processing error: %s", exc, exc_info=True)

    await queue.consume(on_message)
    logger.info("Worker ready. Press Ctrl+C to stop.")
    try:
        await asyncio.Future()  # 永不结束，直到 Ctrl+C
    finally:
        await connection.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
