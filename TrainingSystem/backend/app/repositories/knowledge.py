import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge import KnowledgePoint, KnowledgePointCandidate, KnowledgePointRelation


class CandidateRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, cid: uuid.UUID) -> KnowledgePointCandidate | None:
        result = await self.db.execute(
            select(KnowledgePointCandidate).where(KnowledgePointCandidate.id == cid)
        )
        return result.scalar_one_or_none()

    async def list_candidates(
        self,
        page: int,
        page_size: int,
        status: str | None = None,
    ):
        q = select(KnowledgePointCandidate)
        if status:
            q = q.where(KnowledgePointCandidate.status == status)
        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.order_by(KnowledgePointCandidate.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def create(
        self,
        candidate_name: str,
        document_chunk_id: uuid.UUID | None = None,
        candidate_description: str | None = None,
        confidence_score: float | None = None,
    ) -> KnowledgePointCandidate:
        c = KnowledgePointCandidate(
            candidate_name=candidate_name,
            document_chunk_id=document_chunk_id,
            candidate_description=candidate_description,
            confidence_score=confidence_score,
        )
        self.db.add(c)
        await self.db.flush()
        return c

    async def create_manual(self, candidate_name: str, candidate_description: str | None = None) -> KnowledgePointCandidate:
        c = KnowledgePointCandidate(
            candidate_name=candidate_name,
            candidate_description=candidate_description,
            source_type="manual",
            document_chunk_id=None,
        )
        self.db.add(c)
        await self.db.flush()
        return c

    async def update(self, c: KnowledgePointCandidate, **kwargs) -> KnowledgePointCandidate:
        for k, v in kwargs.items():
            setattr(c, k, v)
        await self.db.flush()
        return c


class KnowledgePointRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, kp_id: uuid.UUID) -> KnowledgePoint | None:
        result = await self.db.execute(
            select(KnowledgePoint).where(KnowledgePoint.id == kp_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self, status: str | None = None) -> list[KnowledgePoint]:
        q = select(KnowledgePoint)
        if status:
            q = q.where(KnowledgePoint.status == status)
        q = q.order_by(KnowledgePoint.weight.desc(), KnowledgePoint.name)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows)

    async def list_roots(self) -> list[KnowledgePoint]:
        """仅返回顶层节点（parent_id IS NULL，且 active）"""
        result = await self.db.execute(
            select(KnowledgePoint)
            .where(KnowledgePoint.parent_id.is_(None), KnowledgePoint.status == "active")
            .order_by(KnowledgePoint.weight.desc(), KnowledgePoint.name)
        )
        return list(result.scalars().all())

    async def search(self, keyword: str, page: int, page_size: int):
        q = select(KnowledgePoint).where(
            KnowledgePoint.name.ilike(f"%{keyword}%"),
            KnowledgePoint.status == "active",
        )
        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.order_by(KnowledgePoint.name).offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def create(
        self,
        name: str,
        description: str | None = None,
        parent_id: uuid.UUID | None = None,
        weight: int = 0,
        node_type: str = "knowledge_point",
        source_candidate_id: uuid.UUID | None = None,
    ) -> KnowledgePoint:
        kp = KnowledgePoint(name=name, description=description, parent_id=parent_id, weight=weight,
                            node_type=node_type, source_candidate_id=source_candidate_id)
        self.db.add(kp)
        await self.db.flush()
        await self.db.refresh(kp)
        return kp

    async def create_category(self, name: str, description: str | None = None, parent_id: uuid.UUID | None = None) -> KnowledgePoint:
        return await self.create(name=name, description=description, parent_id=parent_id, node_type="category")

    async def update(self, kp: KnowledgePoint, **kwargs) -> KnowledgePoint:
        for k, v in kwargs.items():
            setattr(kp, k, v)
        await self.db.flush()
        await self.db.refresh(kp)
        return kp

    async def delete(self, kp: KnowledgePoint) -> None:
        await self.db.delete(kp)
        await self.db.flush()


class KnowledgePointRelationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_relations(self, source_id: uuid.UUID) -> list[KnowledgePointRelation]:
        result = await self.db.execute(
            select(KnowledgePointRelation).where(KnowledgePointRelation.source_id == source_id)
        )
        return list(result.scalars().all())

    async def create(
        self, source_id: uuid.UUID, target_id: uuid.UUID, relation_type: str
    ) -> KnowledgePointRelation:
        rel = KnowledgePointRelation(
            source_id=source_id, target_id=target_id, relation_type=relation_type
        )
        self.db.add(rel)
        await self.db.flush()
        return rel

    async def delete(
        self, source_id: uuid.UUID, target_id: uuid.UUID, relation_type: str
    ) -> None:
        result = await self.db.execute(
            select(KnowledgePointRelation).where(
                KnowledgePointRelation.source_id == source_id,
                KnowledgePointRelation.target_id == target_id,
                KnowledgePointRelation.relation_type == relation_type,
            )
        )
        rel = result.scalar_one_or_none()
        if rel:
            await self.db.delete(rel)
            await self.db.flush()
