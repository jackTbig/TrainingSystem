import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class QuestionVersionOut(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    version_no: int
    status: str
    question_type: str
    stem: str
    options: dict | None
    answer_json: dict
    analysis: str | None
    difficulty_level: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class QuestionOut(BaseModel):
    id: uuid.UUID
    status: str
    current_version_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    versions: list[QuestionVersionOut] = []
    model_config = {"from_attributes": True}


class QuestionListItem(BaseModel):
    id: uuid.UUID
    status: str
    current_version_id: uuid.UUID | None
    created_at: datetime
    model_config = {"from_attributes": True}


class QuestionVersionCreate(BaseModel):
    question_type: str = Field(..., pattern="^(single_choice|multi_choice|true_false|fill_blank|short_answer)$")
    stem: str = Field(..., min_length=1)
    options: dict | None = None
    answer_json: dict
    analysis: str | None = None
    difficulty_level: int = Field(3, ge=1, le=5)


class QuestionVersionUpdate(BaseModel):
    stem: str | None = None
    options: dict | None = None
    answer_json: dict | None = None
    analysis: str | None = None
    difficulty_level: int | None = Field(None, ge=1, le=5)
