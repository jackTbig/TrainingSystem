import uuid

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import paginated_response, success_response
from app.schemas.user import UserCreate, UserUpdate
from app.services.auth import UserService

router = APIRouter()


@router.get("", response_model=dict, summary="用户列表")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    users, total = await svc.list_users(page, page_size, status)
    return paginated_response(
        items=[u.model_dump() for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=dict, summary="创建用户")
async def create_user(
    data: UserCreate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.create_user(data)
    return success_response(data=user.model_dump())


@router.get("/{user_id}", response_model=dict, summary="获取用户详情")
async def get_user(
    user_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.get_user(user_id)
    return success_response(data=user.model_dump())


@router.put("/{user_id}", response_model=dict, summary="更新用户")
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    user = await svc.update_user(user_id, data)
    return success_response(data=user.model_dump())


@router.delete("/{user_id}", response_model=dict, summary="删除用户")
async def delete_user(
    user_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    await svc.delete_user(user_id)
    return success_response(message="删除成功")


@router.put("/{user_id}/roles", response_model=dict, summary="设置用户角色")
async def set_user_roles(
    user_id: uuid.UUID,
    data: dict = Body(...),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import UserRole
    from sqlalchemy import delete as sql_delete
    role_ids = data.get("role_ids", [])
    await db.execute(sql_delete(UserRole).where(UserRole.user_id == user_id))
    for rid in role_ids:
        db.add(UserRole(user_id=user_id, role_id=uuid.UUID(rid)))
    await db.commit()
    return success_response(message="角色已更新")


@router.post("/{user_id}/reset-password", response_model=dict, summary="重置密码")
async def reset_password(
    user_id: uuid.UUID,
    new_password: str,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = UserService(db)
    await svc.reset_password(user_id, new_password)
    return success_response(message="密码已重置")
