import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Role / Permission (nested) ────────────────────────────────────────────────

class PermissionOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    resource_type: str | None
    action: str | None

    model_config = {"from_attributes": True}


class RoleOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None

    model_config = {"from_attributes": True}


# ── User ──────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    real_name: str
    email: str | None
    phone: str | None
    status: str
    last_login_at: datetime | None
    created_at: datetime
    roles: list[RoleOut] = []

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=6)
    real_name: str = Field(..., min_length=1, max_length=64)
    email: str | None = None
    phone: str | None = None
    role_ids: list[uuid.UUID] = []


class UserUpdate(BaseModel):
    real_name: str | None = Field(None, min_length=1, max_length=64)
    email: str | None = None
    phone: str | None = None
    status: str | None = None
    role_ids: list[uuid.UUID] | None = None


# ── Department ────────────────────────────────────────────────────────────────

class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    parent_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    status: str | None = None


# ── Role CRUD ─────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=64)
    description: str | None = None
    permission_ids: list[uuid.UUID] = []


class RoleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=64)
    description: str | None = None
    permission_ids: list[uuid.UUID] | None = None
