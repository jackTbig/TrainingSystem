import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.exceptions import NotFoundException
from app.core.response import paginated_response, success_response
from app.models.document import Document, DocumentChunk, DocumentVersion
from app.schemas.document import DocumentUpdate
from app.services.document import DocumentService

router = APIRouter()


@router.post("", response_model=dict, summary="上传文档")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(..., min_length=1, max_length=200),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DocumentService(db)
    doc = await svc.upload(file=file, title=title, owner_id=uuid.UUID(user_id))
    return success_response(data=doc.model_dump())


@router.get("", response_model=dict, summary="文档列表")
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    mine: bool = Query(False, description="只看自己上传的"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DocumentService(db)
    owner_filter = uuid.UUID(user_id) if mine else None
    docs, total = await svc.list_documents(page, page_size, owner_id=owner_filter, status=status)
    return paginated_response(
        items=[d.model_dump() for d in docs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{doc_id}", response_model=dict, summary="文档详情")
async def get_document(
    doc_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DocumentService(db)
    doc = await svc.get_document(doc_id)
    return success_response(data=doc.model_dump())


@router.put("/{doc_id}", response_model=dict, summary="更新文档信息")
async def update_document(
    doc_id: uuid.UUID,
    data: DocumentUpdate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DocumentService(db)
    doc = await svc.update_document(doc_id, data)
    return success_response(data=doc.model_dump())


@router.post("/{doc_id}/archive", response_model=dict, summary="归档文档")
async def archive_document(
    doc_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DocumentService(db)
    doc = await svc.archive_document(doc_id)
    return success_response(data=doc.model_dump())


@router.delete("/{doc_id}", response_model=dict, summary="删除文档（硬删除）")
async def delete_document(
    doc_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    import os
    from sqlalchemy import delete as sql_delete
    doc = (await db.execute(select(Document).where(Document.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise NotFoundException(code="DOC_NOT_FOUND", message="文档不存在")
    versions = (await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == doc_id)
    )).scalars().all()
    for v in versions:
        try:
            if v.file_path and os.path.exists(v.file_path):
                os.remove(v.file_path)
        except Exception:
            pass
    # explicitly delete versions (DB CASCADE handles parse_tasks + chunks)
    await db.execute(sql_delete(DocumentVersion).where(DocumentVersion.document_id == doc_id))
    await db.delete(doc)
    await db.commit()
    return success_response(message="文档已删除")


@router.get("/{doc_id}/chunks", response_model=dict, summary="文档解析结果（chunks）")
async def list_document_chunks(
    doc_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    doc = (await db.execute(select(Document).where(Document.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise NotFoundException(code="DOC_NOT_FOUND", message="文档不存在")
    if not doc.current_version_id:
        return paginated_response(items=[], total=0, page=page, page_size=page_size)
    total_q = await db.execute(
        select(DocumentChunk).where(DocumentChunk.document_version_id == doc.current_version_id)
    )
    all_chunks = total_q.scalars().all()
    total = len(all_chunks)
    q = (
        select(DocumentChunk)
        .where(DocumentChunk.document_version_id == doc.current_version_id)
        .order_by(DocumentChunk.chunk_index)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    chunks = (await db.execute(q)).scalars().all()
    return paginated_response(
        items=[{
            "id": str(c.id),
            "chunk_index": c.chunk_index,
            "chapter_title": c.chapter_title,
            "content": c.content,
            "token_count": c.token_count,
            "embedding_status": c.embedding_status,
            "created_at": c.created_at.isoformat(),
        } for c in chunks],
        total=total, page=page, page_size=page_size,
    )


@router.post("/{doc_id}/reparse", response_model=dict, summary="重新解析")
async def reparse_document(
    doc_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DocumentService(db)
    result = await svc.reparse(doc_id)
    return success_response(data=result, message="已重新加入解析队列")
