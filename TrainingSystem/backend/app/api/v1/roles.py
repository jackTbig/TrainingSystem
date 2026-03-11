import uuid

from fastapi import Body, APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import paginated_response, success_response
from app.models.user import Permission, Role, RolePermission, User, UserRole

router = APIRouter()


@router.get("", response_model=dict, summary="角色列表")
async def list_roles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total_res = await db.execute(select(Role))
    all_roles = total_res.scalars().all()
    total = len(all_roles)
    offset = (page - 1) * page_size
    roles = all_roles[offset: offset + page_size]
    items = []
    for r in roles:
        items.append({
            "id": str(r.id),
            "code": r.code,
            "name": r.name,
            "description": r.description,
            "user_count": len(r.users),
            "permission_count": len(r.permissions),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return paginated_response(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=dict, summary="创建角色")
async def create_role(
    data: dict = Body(...),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    import re, time
    raw_code = data.get("code") or re.sub(r'[^a-zA-Z0-9_]', '_', data["name"]) + f'_{int(time.time())%10000}'
    role = Role(
        id=uuid.uuid4(),
        code=raw_code,
        name=data["name"],
        description=data.get("description"),
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return success_response(data={"id": str(role.id), "code": role.code, "name": role.name})


@router.get("/permissions", response_model=dict, summary="权限列表")
async def list_permissions(
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Permission).order_by(Permission.resource_type, Permission.action))
    perms = result.scalars().all()
    items = [{"id": str(p.id), "code": p.code, "name": p.name,
              "resource_type": p.resource_type, "action": p.action} for p in perms]
    return success_response(data=items)


@router.get("/{role_id}", response_model=dict, summary="角色详情")
async def get_role(
    role_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        return success_response(data=None)
    return success_response(data={
        "id": str(role.id),
        "code": role.code,
        "name": role.name,
        "description": role.description,
        "permissions": [{"id": str(p.id), "code": p.code, "name": p.name} for p in role.permissions],
        "users": [{"id": str(u.id), "username": u.username, "real_name": u.real_name} for u in role.users],
    })


@router.put("/{role_id}/permissions", response_model=dict, summary="设置角色权限")
async def set_role_permissions(
    role_id: uuid.UUID,
    data: dict = Body(...),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # 删除现有权限关联
    existing = await db.execute(select(RolePermission).where(RolePermission.role_id == role_id))
    for rp in existing.scalars().all():
        await db.delete(rp)
    # 添加新权限
    permission_ids = data.get("permission_ids", [])
    for pid in permission_ids:
        rp = RolePermission(role_id=role_id, permission_id=uuid.UUID(pid))
        db.add(rp)
    await db.commit()
    return success_response(message="权限已更新")


@router.put("/{role_id}/users", response_model=dict, summary="设置角色用户")
async def set_role_users(
    role_id: uuid.UUID,
    data: dict = Body(...),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(UserRole).where(UserRole.role_id == role_id))
    for ur in existing.scalars().all():
        await db.delete(ur)
    user_ids = data.get("user_ids", [])
    for uid in user_ids:
        ur = UserRole(role_id=role_id, user_id=uuid.UUID(uid))
        db.add(ur)
    await db.commit()
    return success_response(message="用户已更新")


@router.delete("/{role_id}", response_model=dict, summary="删除角色")
async def delete_role(
    role_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if role:
        await db.delete(role)
        await db.commit()
    return success_response(message="删除成功")
