import uuid

from fastapi import Body, APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import success_response
from app.models.user import Department, DepartmentMembership, User

router = APIRouter()


@router.get("", response_model=dict, summary="部门树")
async def list_departments(
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Load all at once to avoid async lazy-load on self-referential children
    all_depts = (await db.execute(select(Department))).scalars().all()
    all_mems = (await db.execute(select(DepartmentMembership))).scalars().all()
    member_counts: dict[str, int] = {}
    for m in all_mems:
        k = str(m.department_id)
        member_counts[k] = member_counts.get(k, 0) + 1

    nodes: dict[str, dict] = {
        str(d.id): {
            "id": str(d.id),
            "name": d.name,
            "parent_id": str(d.parent_id) if d.parent_id else None,
            "status": d.status,
            "member_count": member_counts.get(str(d.id), 0),
            "children": [],
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in all_depts
    }
    roots = []
    for node in nodes.values():
        pid = node["parent_id"]
        if pid and pid in nodes:
            nodes[pid]["children"].append(node)
        else:
            roots.append(node)
    return success_response(data=roots)


@router.post("", response_model=dict, summary="创建部门")
async def create_department(
    data: dict = Body(...),
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
    data: dict = Body(...),
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
    data: dict = Body(...),
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
