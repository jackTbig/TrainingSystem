import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import paginated_response, success_response
from app.schemas.knowledge import (
    CandidateAcceptRequest,
    CandidateMergeRequest,
    KnowledgePointCreate,
    KnowledgePointUpdate,
    RelationCreate,
)
from app.services.knowledge import CandidateService, KnowledgePointService

router = APIRouter()


# ── 候选知识点 ────────────────────────────────────────────────────────────────

@router.get("/candidates", response_model=dict, summary="候选知识点列表")
async def list_candidates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CandidateService(db)
    items, total = await svc.list_candidates(page, page_size, status)
    return paginated_response(
        items=[i.model_dump() for i in items],
        total=total, page=page, page_size=page_size,
    )


@router.post("/candidates/{cid}/accept", response_model=dict, summary="接受候选知识点")
async def accept_candidate(
    cid: uuid.UUID,
    req: CandidateAcceptRequest,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CandidateService(db)
    kp = await svc.accept(cid, req)
    return success_response(data=kp.model_dump(), message="已接受并创建知识点")


@router.post("/candidates/{cid}/ignore", response_model=dict, summary="忽略候选知识点")
async def ignore_candidate(
    cid: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CandidateService(db)
    c = await svc.ignore(cid)
    return success_response(data=c.model_dump(), message="已忽略")


@router.post("/candidates/{cid}/merge", response_model=dict, summary="合并到已有知识点")
async def merge_candidate(
    cid: uuid.UUID,
    req: CandidateMergeRequest,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CandidateService(db)
    kp = await svc.merge(cid, req)
    return success_response(data=kp.model_dump(), message="已合并")


# ── 知识点管理 ────────────────────────────────────────────────────────────────

@router.get("/tree", response_model=dict, summary="知识点树")
async def get_kp_tree(
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    tree = await svc.get_tree()
    return success_response(data=[n.model_dump() for n in tree])


@router.get("/search", response_model=dict, summary="知识点搜索")
async def search_kps(
    keyword: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    items, total = await svc.search(keyword, page, page_size)
    return paginated_response(
        items=[i.model_dump() for i in items],
        total=total, page=page, page_size=page_size,
    )


@router.post("", response_model=dict, summary="创建知识点")
async def create_kp(
    data: KnowledgePointCreate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    kp = await svc.create_kp(data)
    return success_response(data=kp.model_dump())


@router.get("/{kp_id}", response_model=dict, summary="知识点详情")
async def get_kp(
    kp_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    kp = await svc.get_kp(kp_id)
    return success_response(data=kp.model_dump())


@router.put("/{kp_id}", response_model=dict, summary="更新知识点")
async def update_kp(
    kp_id: uuid.UUID,
    data: KnowledgePointUpdate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    kp = await svc.update_kp(kp_id, data)
    return success_response(data=kp.model_dump())


@router.post("/{kp_id}/archive", response_model=dict, summary="归档知识点")
async def archive_kp(
    kp_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    kp = await svc.archive_kp(kp_id)
    return success_response(data=kp.model_dump())


@router.get("/{kp_id}/relations", response_model=dict, summary="知识点关联列表")
async def get_relations(
    kp_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    rels = await svc.get_relations(kp_id)
    return success_response(data=rels)


@router.post("/{kp_id}/relations", response_model=dict, summary="添加关联")
async def add_relation(
    kp_id: uuid.UUID,
    data: RelationCreate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    rel = await svc.add_relation(kp_id, data)
    return success_response(data=rel)


@router.delete("/{kp_id}/relations/{target_id}/{relation_type}", response_model=dict, summary="删除关联")
async def remove_relation(
    kp_id: uuid.UUID,
    target_id: uuid.UUID,
    relation_type: str,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = KnowledgePointService(db)
    await svc.remove_relation(kp_id, target_id, relation_type)
    return success_response(message="关联已删除")
