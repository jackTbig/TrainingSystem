import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessException, NotFoundException
from app.repositories.knowledge import (
    CandidateRepository,
    KnowledgePointRelationRepository,
    KnowledgePointRepository,
)
from app.schemas.knowledge import (
    CandidateAcceptRequest,
    CandidateMergeRequest,
    CandidateOut,
    KnowledgePointCreate,
    KnowledgePointOut,
    KnowledgePointTree,
    KnowledgePointUpdate,
    RelationCreate,
)


class CandidateService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CandidateRepository(db)
        self.kp_repo = KnowledgePointRepository(db)

    async def list_candidates(self, page: int, page_size: int, status: str | None = None):
        rows, total = await self.repo.list_candidates(page, page_size, status)
        return [CandidateOut.model_validate(r) for r in rows], total

    async def accept(self, cid: uuid.UUID, req: CandidateAcceptRequest) -> KnowledgePointOut:
        c = await self.repo.get_by_id(cid)
        if not c:
            raise NotFoundException(code="CANDIDATE_NOT_FOUND", message="候选知识点不存在")
        if c.status != "pending":
            raise BusinessException(code="CANDIDATE_NOT_PENDING", message=f"当前状态 {c.status} 无法接受")

        name = req.name or c.candidate_name
        description = req.description if req.description is not None else c.candidate_description

        kp = await self.kp_repo.create(
            name=name,
            description=description,
            parent_id=req.parent_id,
            weight=req.weight,
            source_candidate_id=c.id,
        )
        await self.repo.update(c, status="accepted")
        await self.db.commit()
        await self.db.refresh(kp)
        return KnowledgePointOut.model_validate(kp)

    async def ignore(self, cid: uuid.UUID) -> CandidateOut:
        c = await self.repo.get_by_id(cid)
        if not c:
            raise NotFoundException(code="CANDIDATE_NOT_FOUND", message="候选知识点不存在")
        if c.status != "pending":
            raise BusinessException(code="CANDIDATE_NOT_PENDING", message=f"当前状态 {c.status} 无法忽略")
        await self.repo.update(c, status="ignored")
        await self.db.commit()
        return CandidateOut.model_validate(c)

    async def merge(self, cid: uuid.UUID, req: CandidateMergeRequest) -> KnowledgePointOut:
        c = await self.repo.get_by_id(cid)
        if not c:
            raise NotFoundException(code="CANDIDATE_NOT_FOUND", message="候选知识点不存在")
        if c.status != "pending":
            raise BusinessException(code="CANDIDATE_NOT_PENDING", message=f"当前状态 {c.status} 无法合并")
        kp = await self.kp_repo.get_by_id(req.target_knowledge_point_id)
        if not kp:
            raise NotFoundException(code="KP_NOT_FOUND", message="目标知识点不存在")
        await self.repo.update(c, status="merged")
        await self.db.commit()
        return KnowledgePointOut.model_validate(kp)


def _build_tree(kps: list) -> list[KnowledgePointTree]:
    """将扁平列表构建为树（仅 active 节点）"""
    by_id = {
        kp.id: KnowledgePointTree(
            id=kp.id, name=kp.name, description=kp.description,
            parent_id=kp.parent_id, status=kp.status, weight=kp.weight,
            created_at=kp.created_at, updated_at=kp.updated_at, children=[],
        )
        for kp in kps if kp.status == "active"
    }
    roots: list[KnowledgePointTree] = []
    for node in by_id.values():
        if node.parent_id and node.parent_id in by_id:
            by_id[node.parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


class KnowledgePointService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = KnowledgePointRepository(db)
        self.rel_repo = KnowledgePointRelationRepository(db)

    async def get_tree(self) -> list[KnowledgePointTree]:
        all_kps = await self.repo.list_all()
        return _build_tree(all_kps)

    async def search(self, keyword: str, page: int, page_size: int):
        rows, total = await self.repo.search(keyword, page, page_size)
        return [KnowledgePointOut.model_validate(r) for r in rows], total

    async def get_kp(self, kp_id: uuid.UUID) -> KnowledgePointOut:
        kp = await self.repo.get_by_id(kp_id)
        if not kp:
            raise NotFoundException(code="KP_NOT_FOUND", message="知识点不存在")
        return KnowledgePointOut.model_validate(kp)

    async def create_kp(self, data: KnowledgePointCreate) -> KnowledgePointOut:
        if data.parent_id:
            parent = await self.repo.get_by_id(data.parent_id)
            if not parent:
                raise NotFoundException(code="KP_PARENT_NOT_FOUND", message="父知识点不存在")
        kp = await self.repo.create(
            name=data.name,
            description=data.description,
            parent_id=data.parent_id,
            weight=data.weight,
        )
        await self.db.commit()
        return KnowledgePointOut.model_validate(kp)

    async def update_kp(self, kp_id: uuid.UUID, data: KnowledgePointUpdate) -> KnowledgePointOut:
        kp = await self.repo.get_by_id(kp_id)
        if not kp:
            raise NotFoundException(code="KP_NOT_FOUND", message="知识点不存在")
        updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if updates:
            await self.repo.update(kp, **updates)
        await self.db.commit()
        return KnowledgePointOut.model_validate(kp)

    async def archive_kp(self, kp_id: uuid.UUID) -> KnowledgePointOut:
        kp = await self.repo.get_by_id(kp_id)
        if not kp:
            raise NotFoundException(code="KP_NOT_FOUND", message="知识点不存在")
        if kp.status == "archived":
            raise BusinessException(code="KP_ALREADY_ARCHIVED", message="知识点已归档")
        await self.repo.update(kp, status="archived")
        await self.db.commit()
        return KnowledgePointOut.model_validate(kp)

    async def add_relation(self, kp_id: uuid.UUID, data: RelationCreate) -> dict:
        kp = await self.repo.get_by_id(kp_id)
        if not kp:
            raise NotFoundException(code="KP_NOT_FOUND", message="知识点不存在")
        if kp_id == data.target_id:
            raise BusinessException(code="KP_SELF_RELATION", message="不能与自身建立关联")
        target = await self.repo.get_by_id(data.target_id)
        if not target:
            raise NotFoundException(code="KP_NOT_FOUND", message="目标知识点不存在")
        await self.rel_repo.create(kp_id, data.target_id, data.relation_type)
        await self.db.commit()
        return {"source_id": str(kp_id), "target_id": str(data.target_id), "relation_type": data.relation_type}

    async def remove_relation(self, kp_id: uuid.UUID, target_id: uuid.UUID, relation_type: str) -> None:
        await self.rel_repo.delete(kp_id, target_id, relation_type)
        await self.db.commit()

    async def get_relations(self, kp_id: uuid.UUID) -> list[dict]:
        rels = await self.rel_repo.get_relations(kp_id)
        return [
            {"target_id": str(r.target_id), "relation_type": r.relation_type}
            for r in rels
        ]
