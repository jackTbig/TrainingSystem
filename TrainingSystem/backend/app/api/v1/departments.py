import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import success_response
from app.models.user import Department, DepartmentMembership, User

router = APIRouter()


def dept_to_dict(d: Department) -> dict:
    return {
        "id": str(d.id),
        "name": d.name,
        "parent_id": str(d.parent_id) if d.parent_id else None,
        "status": d.status,
        "member_count": len(d.memberships),
        "children": [dept_to_dict(c) for c in d.children],
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


@router.get("", response_model=dict, summary="部门树")
async def list_departments(
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.parent_id.is_(None)))
    roots = result.scalars().all()
    return success_response(data=[dept_to_dict(d) for d in roots])


@router.post("", response_model=dict, summary="创建部门")
async def create_department(
    data: dict,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    dept = Department(
        id=uuid.uuid4(),
        name=data["name"],
        parent_id=uuid.UUID(data["parent_id"]) if data.get("parent_id") else None,
        status="active",
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return success_response(data={"id": str(dept.id), "name": dept.name})


@router.get("/{dept_id}/members", response_model=dict, summary="部门成员")
async def list_members(
    dept_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DepartmentMembership, User)
        .join(User, User.id == DepartmentMembership.user_id)
        .where(DepartmentMembership.department_id == dept_id)
    )
    rows = result.all()
    items = [{"user_id": str(m.user_id), "username": u.username,
              "real_name": u.real_name, "is_primary": m.is_primary} for m, u in rows]
    return success_response(data=items)


@router.post("/{dept_id}/members", response_model=dict, summary="添加部门成员")
async def add_member(
    dept_id: uuid.UUID,
    data: dict,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user_id = uuid.UUID(data["user_id"])
    existing = await db.execute(
        select(DepartmentMembership).where(
            DepartmentMembership.department_id == dept_id,
            DepartmentMembership.user_id == user_id,
        )
    )
    if not existing.scalar_one_or_none():
        m = DepartmentMembership(
            id=uuid.uuid4(),
            department_id=dept_id,
            user_id=user_id,
            is_primary=data.get("is_primary", True),
        )
        db.add(m)
        await db.commit()
    return success_response(message="成员已添加")


@router.delete("/{dept_id}/members/{user_id}", response_model=dict, summary="移除部门成员")
async def remove_member(
    dept_id: uuid.UUID,
    user_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DepartmentMembership).where(
            DepartmentMembership.department_id == dept_id,
            DepartmentMembership.user_id == user_id,
        )
    )
    m = result.scalar_one_or_none()
    if m:
        await db.delete(m)
        await db.commit()
    return success_response(message="已移除")


@router.put("/{dept_id}", response_model=dict, summary="更新部门")
async def update_department(
    dept_id: uuid.UUID,
    data: dict,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if dept:
        if "name" in data:
            dept.name = data["name"]
        if "status" in data:
            dept.status = data["status"]
        await db.commit()
    return success_response(message="已更新")


@router.delete("/{dept_id}", response_model=dict, summary="删除部门")
async def delete_department(
    dept_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if dept:
        await db.delete(dept)
        await db.commit()
    return success_response(message="已删除")
