import uuid

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user_id, get_db
from app.core.exceptions import BusinessException, NotFoundException
from app.core.response import paginated_response, success_response
from app.models.review import ReviewComment, ReviewTask
from sqlalchemy import func

router = APIRouter()


@router.get("", response_model=dict, summary="审核任务列表")
async def list_review_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    content_type: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(ReviewTask)
    if status:
        q = q.where(ReviewTask.status == status)
    if content_type:
        q = q.where(ReviewTask.content_type == content_type)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.order_by(ReviewTask.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = list((await db.execute(q)).scalars().all())
    return paginated_response(
        items=[{"id": str(r.id), "content_type": r.content_type, "content_id": str(r.content_id),
                "content_version_id": str(r.content_version_id), "review_stage": r.review_stage,
                "status": r.status, "assigned_reviewer_id": str(r.assigned_reviewer_id) if r.assigned_reviewer_id else None,
                "created_at": r.created_at.isoformat()} for r in rows],
        total=total, page=page, page_size=page_size,
    )


@router.post("", response_model=dict, summary="创建审核任务")
async def create_review_task(
    content_type: str = Body(...),
    content_id: uuid.UUID = Body(...),
    content_version_id: uuid.UUID = Body(...),
    review_stage: str = Body(...),
    assigned_reviewer_id: uuid.UUID | None = Body(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task = ReviewTask(
        content_type=content_type, content_id=content_id,
        content_version_id=content_version_id, review_stage=review_stage,
        assigned_reviewer_id=assigned_reviewer_id,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return success_response(data={"id": str(task.id), "status": task.status})


@router.get("/{task_id}", response_model=dict, summary="审核任务详情")
async def get_review_task(
    task_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReviewTask).options(selectinload(ReviewTask.comments)).where(ReviewTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException(code="REVIEW_NOT_FOUND", message="审核任务不存在")
    return success_response(data={
        "id": str(task.id), "content_type": task.content_type, "content_id": str(task.content_id),
        "status": task.status, "review_stage": task.review_stage,
        "comments": [{"id": str(c.id), "reviewer_id": str(c.reviewer_id), "comment_type": c.comment_type,
                      "content": c.content, "action_suggestion": c.action_suggestion, "created_at": c.created_at.isoformat()}
                     for c in task.comments],
    })


@router.post("/{task_id}/action", response_model=dict, summary="审核操作（通过/驳回/退回）")
async def review_action(
    task_id: uuid.UUID,
    action: str = Body(..., embed=True),
    comment: str = Body("", embed=True),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    ACTION_MAP = {"approve": "approved", "reject": "rejected", "return": "returned"}
    if action not in ACTION_MAP:
        raise BusinessException(code="INVALID_ACTION", message=f"无效操作：{action}")

    result = await db.execute(
        select(ReviewTask).options(selectinload(ReviewTask.comments)).where(ReviewTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException(code="REVIEW_NOT_FOUND", message="审核任务不存在")
    if task.status not in ("pending", "in_review"):
        raise BusinessException(code="REVIEW_INVALID_STATE", message=f"当前状态 {task.status} 不可操作")

    task.status = ACTION_MAP[action]
    task.assigned_reviewer_id = uuid.UUID(user_id)

    if comment:
        rc = ReviewComment(
            review_task_id=task.id, reviewer_id=uuid.UUID(user_id),
            comment_type="correction" if action == "return" else "approval",
            content=comment, action_suggestion=action,
        )
        db.add(rc)

    await db.commit()
    return success_response(data={"id": str(task.id), "status": task.status}, message=f"审核操作已完成：{action}")
