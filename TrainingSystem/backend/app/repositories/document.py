import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document, DocumentChunk, DocumentParseTask, DocumentVersion


class DocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, doc_id: uuid.UUID) -> Document | None:
        result = await self.db.execute(
            select(Document)
            .options(selectinload(Document.versions))
            .where(Document.id == doc_id)
        )
        return result.scalar_one_or_none()

    async def list_documents(
        self,
        page: int,
        page_size: int,
        owner_id: uuid.UUID | None = None,
        status: str | None = None,
    ):
        q = select(Document)
        if owner_id:
            q = q.where(Document.owner_id == owner_id)
        if status:
            q = q.where(Document.status == status)

        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.order_by(Document.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def create(self, title: str, owner_id: uuid.UUID, source_type: str = "upload") -> Document:
        doc = Document(title=title, owner_id=owner_id, source_type=source_type)
        self.db.add(doc)
        await self.db.flush()
        return doc

    async def update(self, doc: Document, **kwargs) -> Document:
        for k, v in kwargs.items():
            setattr(doc, k, v)
        await self.db.flush()
        return doc

    async def delete(self, doc: Document) -> None:
        await self.db.delete(doc)
        await self.db.flush()


class DocumentVersionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, ver_id: uuid.UUID) -> DocumentVersion | None:
        result = await self.db.execute(
            select(DocumentVersion).where(DocumentVersion.id == ver_id)
        )
        return result.scalar_one_or_none()

    async def next_version_no(self, document_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.max(DocumentVersion.version_no)).where(
                DocumentVersion.document_id == document_id
            )
        )
        max_no = result.scalar_one_or_none()
        return (max_no or 0) + 1

    async def create(
        self,
        document_id: uuid.UUID,
        file_name: str,
        file_path: str,
        file_size: int,
        mime_type: str | None = None,
        file_hash: str | None = None,
    ) -> DocumentVersion:
        version_no = await self.next_version_no(document_id)
        ver = DocumentVersion(
            document_id=document_id,
            version_no=version_no,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            file_hash=file_hash,
        )
        self.db.add(ver)
        await self.db.flush()
        return ver


class DocumentParseTaskRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, document_version_id: uuid.UUID) -> DocumentParseTask:
        task = DocumentParseTask(document_version_id=document_version_id)
        self.db.add(task)
        await self.db.flush()
        return task

    async def get_by_version(self, document_version_id: uuid.UUID) -> list[DocumentParseTask]:
        result = await self.db.execute(
            select(DocumentParseTask)
            .where(DocumentParseTask.document_version_id == document_version_id)
            .order_by(DocumentParseTask.created_at.desc())
        )
        return list(result.scalars().all())

    async def update(self, task: DocumentParseTask, **kwargs) -> DocumentParseTask:
        for k, v in kwargs.items():
            setattr(task, k, v)
        await self.db.flush()
        return task
