import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import paginated_response, success_response
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


@router.post("/{doc_id}/reparse", response_model=dict, summary="重新解析")
async def reparse_document(
    doc_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = DocumentService(db)
    result = await svc.reparse(doc_id)
    return success_response(data=result, message="已重新加入解析队列")
