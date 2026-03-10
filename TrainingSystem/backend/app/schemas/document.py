import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DocumentVersionOut(BaseModel):
    id: uuid.UUID
    version_no: int
    file_name: str
    file_size: int
    mime_type: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ParseTaskOut(BaseModel):
    id: uuid.UUID
    status: str
    retry_count: int
    error_message: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    source_type: str
    status: str
    current_version_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    versions: list[DocumentVersionOut] = []

    model_config = {"from_attributes": True}


class DocumentListItem(BaseModel):
    id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    status: str
    current_version_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    status: str | None = None
