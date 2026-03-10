import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CourseChapterOut(BaseModel):
    id: uuid.UUID
    chapter_no: int
    title: str
    content: str
    estimated_duration_minutes: int | None
    created_at: datetime
    model_config = {"from_attributes": True}


class CourseChapterCreate(BaseModel):
    chapter_no: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    estimated_duration_minutes: int | None = Field(None, ge=1)


class CourseChapterUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    content: str | None = None
    estimated_duration_minutes: int | None = None


class CourseVersionOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    version_no: int
    title: str
    summary: str | None
    source_type: str
    status: str
    created_by: uuid.UUID | None
    reviewed_by: uuid.UUID | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    chapters: list[CourseChapterOut] = []
    model_config = {"from_attributes": True}


class CourseVersionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    summary: str | None = None
    source_type: str = "manual"


class CourseOut(BaseModel):
    id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    current_version_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime
    versions: list[CourseVersionOut] = []
    model_config = {"from_attributes": True}


class CourseListItem(BaseModel):
    id: uuid.UUID
    title: str
    owner_id: uuid.UUID
    status: str
    current_version_id: uuid.UUID | None
    created_at: datetime
    model_config = {"from_attributes": True}


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class CourseUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    status: str | None = None
