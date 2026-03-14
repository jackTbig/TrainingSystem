import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CandidateOut(BaseModel):
    id: uuid.UUID
    document_chunk_id: uuid.UUID | None
    candidate_name: str
    candidate_description: str | None
    confidence_score: float | None
    status: str
    source_type: str  # document / manual
    # denormalized document info for grouped display
    document_id: str | None = None
    document_title: str | None = None
    document_file_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CandidateAcceptRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    category_id: uuid.UUID  # required: must assign to a category


class ManualCandidateCreate(BaseModel):
    candidate_name: str = Field(..., min_length=1, max_length=255)
    candidate_description: str | None = None


class CandidateMergeRequest(BaseModel):
    target_knowledge_point_id: uuid.UUID


class KnowledgePointOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    parent_id: uuid.UUID | None
    status: str
    weight: int
    node_type: str  # category / knowledge_point
    source_candidate_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KnowledgePointTree(KnowledgePointOut):
    children: list["KnowledgePointTree"] = []

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    parent_id: uuid.UUID | None = None


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


class RelationCreate(BaseModel):
    target_id: uuid.UUID
    relation_type: str = Field(..., pattern="^(prerequisite|related|derived)$")
