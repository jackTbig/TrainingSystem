import hashlib
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BusinessException, NotFoundException
from app.repositories.document import (
    DocumentParseTaskRepository,
    DocumentRepository,
    DocumentVersionRepository,
)
from app.schemas.document import DocumentListItem, DocumentOut, DocumentUpdate

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.doc_repo = DocumentRepository(db)
        self.ver_repo = DocumentVersionRepository(db)
        self.task_repo = DocumentParseTaskRepository(db)

    async def upload(self, file: UploadFile, title: str, owner_id: uuid.UUID) -> DocumentOut:
        if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
            raise BusinessException(
                code="DOC_INVALID_TYPE",
                message=f"不支持的文件类型：{file.content_type}",
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise BusinessException(code="DOC_TOO_LARGE", message="文件超过 50 MB 限制")

        file_hash = hashlib.sha256(content).hexdigest()

        # 保存文件
        upload_dir = Path(settings.STORAGE_LOCAL_PATH)
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid.uuid4().hex}_{file.filename}"
        file_path = upload_dir / safe_name
        file_path.write_bytes(content)

        # 创建文档主记录
        doc = await self.doc_repo.create(title=title, owner_id=owner_id)

        # 创建版本记录
        ver = await self.ver_repo.create(
            document_id=doc.id,
            file_name=file.filename or safe_name,
            file_path=str(file_path),
            file_size=len(content),
            mime_type=file.content_type,
            file_hash=file_hash,
        )

        # 更新 current_version_id
        await self.doc_repo.update(doc, current_version_id=ver.id)

        # 创建解析任务并发布到 RabbitMQ
        task = await self.task_repo.create(document_version_id=ver.id)

        await self.db.commit()
        await self.db.refresh(doc)

        # 发布消息（非阻塞，失败不影响响应）
        from app.services.mq import QUEUE_DOCUMENT_PARSE, publish
        await publish(QUEUE_DOCUMENT_PARSE, {"task_id": str(task.id)})

        return DocumentOut.model_validate(doc)

    async def list_documents(
        self,
        page: int,
        page_size: int,
        owner_id: uuid.UUID | None = None,
        status: str | None = None,
    ):
        docs, total = await self.doc_repo.list_documents(page, page_size, owner_id, status)
        return [DocumentListItem.model_validate(d) for d in docs], total

    async def get_document(self, doc_id: uuid.UUID) -> DocumentOut:
        doc = await self.doc_repo.get_by_id(doc_id)
        if not doc:
            raise NotFoundException(code="DOC_NOT_FOUND", message="文档不存在")
        return DocumentOut.model_validate(doc)

    async def update_document(self, doc_id: uuid.UUID, data: DocumentUpdate) -> DocumentOut:
        doc = await self.doc_repo.get_by_id(doc_id)
        if not doc:
            raise NotFoundException(code="DOC_NOT_FOUND", message="文档不存在")
        updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if updates:
            await self.doc_repo.update(doc, **updates)
        await self.db.commit()
        await self.db.refresh(doc)
        return DocumentOut.model_validate(doc)

    async def archive_document(self, doc_id: uuid.UUID) -> DocumentOut:
        doc = await self.doc_repo.get_by_id(doc_id)
        if not doc:
            raise NotFoundException(code="DOC_NOT_FOUND", message="文档不存在")
        if doc.status == "archived":
            raise BusinessException(code="DOC_ALREADY_ARCHIVED", message="文档已归档")
        await self.doc_repo.update(doc, status="archived")
        await self.db.commit()
        await self.db.refresh(doc)
        return DocumentOut.model_validate(doc)

    async def reparse(self, doc_id: uuid.UUID) -> dict:
        doc = await self.doc_repo.get_by_id(doc_id)
        if not doc:
            raise NotFoundException(code="DOC_NOT_FOUND", message="文档不存在")
        if not doc.current_version_id:
            raise BusinessException(code="DOC_NO_VERSION", message="文档无版本文件")
        if doc.status not in ("failed", "uploaded", "parsed"):
            raise BusinessException(code="DOC_INVALID_STATE", message=f"当前状态 {doc.status} 不允许重新解析")
        task = await self.task_repo.create(document_version_id=doc.current_version_id)
        await self.doc_repo.update(doc, status="uploaded")
        await self.db.commit()

        from app.services.mq import QUEUE_DOCUMENT_PARSE, publish
        await publish(QUEUE_DOCUMENT_PARSE, {"task_id": str(task.id)})

        return {"task_id": str(task.id)}
