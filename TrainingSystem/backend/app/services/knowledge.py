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
    CategoryCreate,
    KnowledgePointCreate,
    KnowledgePointOut,
    KnowledgePointTree,
    KnowledgePointUpdate,
    ManualCandidateCreate,
    RelationCreate,
)
from app.models.knowledge import KnowledgePoint, KnowledgePointCandidate


class CandidateService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CandidateRepository(db)
        self.kp_repo = KnowledgePointRepository(db)

    async def list_candidates(self, page: int, page_size: int, status: str | None = None):
        from sqlalchemy import select, func
        from app.models.document import DocumentChunk, DocumentVersion, Document

        q = select(
            KnowledgePointCandidate,
            Document.id.label("doc_id"),
            Document.title.label("doc_title"),
            DocumentVersion.file_name.label("doc_file_name"),
        ).outerjoin(
            DocumentChunk, DocumentChunk.id == KnowledgePointCandidate.document_chunk_id
        ).outerjoin(
            DocumentVersion, DocumentVersion.id == DocumentChunk.document_version_id
        ).outerjoin(
            Document, Document.id == DocumentVersion.document_id
        )
        if status:
            q = q.where(KnowledgePointCandidate.status == status)

        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        q = q.order_by(Document.title.nulls_last(), KnowledgePointCandidate.created_at.desc())
        q = q.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(q)).all()

        items = []
        for row in rows:
            c = row[0]
            out = CandidateOut(
                id=c.id,
                document_chunk_id=c.document_chunk_id,
                candidate_name=c.candidate_name,
                candidate_description=c.candidate_description,
                confidence_score=c.confidence_score,
                status=c.status,
                source_type=c.source_type,
                document_id=str(row.doc_id) if row.doc_id else None,
                document_title=row.doc_title,
                document_file_name=row.doc_file_name,
                created_at=c.created_at,
            )
            items.append(out)
        return items, total

    async def accept(self, cid: uuid.UUID, req: CandidateAcceptRequest) -> KnowledgePointOut:
        c = await self.repo.get_by_id(cid)
        if not c:
            raise NotFoundException(code="CANDIDATE_NOT_FOUND", message="候选知识点不存在")
        if c.status != "pending":
            raise BusinessException(code="CANDIDATE_NOT_PENDING", message=f"当前状态 {c.status} 无法接受")

        name = req.name or c.candidate_name
        description = req.description if req.description is not None else c.candidate_description

        # verify category exists and is a category node
        from sqlalchemy import select as sa_select
        cat = (await self.db.execute(
            sa_select(KnowledgePoint).where(KnowledgePoint.id == req.category_id, KnowledgePoint.node_type == "category")
        )).scalar_one_or_none()
        if not cat:
            raise NotFoundException(code="CATEGORY_NOT_FOUND", message="目标分类不存在")

        kp = await self.kp_repo.create(
            name=name,
            description=description,
            parent_id=req.category_id,
            weight=0,
            node_type="knowledge_point",
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
        out = CandidateOut(
            id=c.id,
            document_chunk_id=c.document_chunk_id,
            candidate_name=c.candidate_name,
            candidate_description=c.candidate_description,
            confidence_score=c.confidence_score,
            status=c.status,
            source_type=c.source_type,
            created_at=c.created_at,
        )
        return out

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

    async def create_manual(self, data: ManualCandidateCreate) -> CandidateOut:
        c = await self.repo.create_manual(
            candidate_name=data.candidate_name,
            candidate_description=data.candidate_description,
        )
        await self.db.commit()
        out = CandidateOut(
            id=c.id,
            document_chunk_id=None,
            candidate_name=c.candidate_name,
            candidate_description=c.candidate_description,
            confidence_score=None,
            status=c.status,
            source_type=c.source_type,
            document_id=None,
            document_title=None,
            document_file_name=None,
            created_at=c.created_at,
        )
        return out


def _build_tree(kps: list) -> list[KnowledgePointTree]:
    """将扁平列表构建为树（仅 active 节点）"""
    by_id = {
        kp.id: KnowledgePointTree(
            id=kp.id, name=kp.name, description=kp.description,
            parent_id=kp.parent_id, status=kp.status, weight=kp.weight,
            node_type=kp.node_type,
            source_candidate_id=kp.source_candidate_id,
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

    async def create_category(self, data: CategoryCreate) -> KnowledgePointOut:
        if data.parent_id:
            parent = await self.repo.get_by_id(data.parent_id)
            if not parent:
                raise NotFoundException(code="KP_PARENT_NOT_FOUND", message="父分类不存在")
            if parent.node_type != "category":
                raise BusinessException(code="KP_PARENT_NOT_CATEGORY", message="父节点不是分类")
        kp = await self.repo.create(
            name=data.name,
            description=data.description,
            parent_id=data.parent_id,
            weight=0,
            node_type="category",
        )
        await self.db.commit()
        return KnowledgePointOut.model_validate(kp)

    async def update_kp(self, kp_id: uuid.UUID, data: KnowledgePointUpdate) -> KnowledgePointOut:
        kp = await self.repo.get_by_id(kp_id)
        if not kp:
            raise NotFoundException(code="KP_NOT_FOUND", message="知识点不存在")
        updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
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
