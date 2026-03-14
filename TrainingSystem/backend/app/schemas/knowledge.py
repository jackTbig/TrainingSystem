import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── 候选知识点 ────────────────────────────────────────────────────────────────

class CandidateOut(BaseModel):
    id: uuid.UUID
    document_chunk_id: uuid.UUID | None
    candidate_name: str
    candidate_description: str | None
    confidence_score: float | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CandidateAcceptRequest(BaseModel):
    """接受候选知识点，可覆盖名称/描述，并指定归属父节点"""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    parent_id: uuid.UUID | None = None
    weight: int = 0


class CandidateMergeRequest(BaseModel):
    """合并到已有知识点"""
    target_knowledge_point_id: uuid.UUID


# ── 知识点 ────────────────────────────────────────────────────────────────────

class KnowledgePointOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    parent_id: uuid.UUID | None
    status: str
    weight: int
    source_candidate_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KnowledgePointTree(KnowledgePointOut):
    """带子节点，用于树形展示"""
    children: list["KnowledgePointTree"] = []

    model_config = {"from_attributes": True}


class KnowledgePointCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    parent_id: uuid.UUID | None = None
    weight: int = Field(0, ge=0)


class KnowledgePointUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    parent_id: uuid.UUID | None = None
    status: str | None = None
    weight: int | None = Field(None, ge=0)


# ── 关联 ──────────────────────────────────────────────────────────────────────

class RelationCreate(BaseModel):
    target_id: uuid.UUID
    relation_type: str = Field(..., pattern="^(prerequisite|related|derived)$")
