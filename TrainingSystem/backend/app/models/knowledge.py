import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class KnowledgePointCandidate(UUIDMixin, Base):
    """AI 从文档块中提取的候选知识点，待人工审核"""
    __tablename__ = "knowledge_point_candidates"

    document_chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    candidate_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    # pending / accepted / ignored / merged
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    # document / manual
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="document", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )


class KnowledgePoint(UUIDMixin, TimestampMixin, Base):
    """分类节点或知识点叶子节点"""
    __tablename__ = "knowledge_points"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_points.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # active / archived
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", index=True)
    weight: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # category / knowledge_point
    node_type: Mapped[str] = mapped_column(String(32), nullable=False, default="knowledge_point", index=True)
    # 来源候选知识点（从候选接受时记录）
    source_candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_point_candidates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # 关系
    children: Mapped[list["KnowledgePoint"]] = relationship(
        "KnowledgePoint",
        back_populates="parent",
        lazy="selectin",
    )
    parent: Mapped["KnowledgePoint | None"] = relationship(
        "KnowledgePoint",
        back_populates="children",
        remote_side="KnowledgePoint.id",
        lazy="selectin",
    )


class KnowledgePointRelation(Base):
    """知识点之间的关联（前驱、相关等）"""
    __tablename__ = "knowledge_point_relations"

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_points.id", ondelete="CASCADE"),
        primary_key=True,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_points.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # prerequisite / related / derived
    relation_type: Mapped[str] = mapped_column(String(32), nullable=False, primary_key=True)
