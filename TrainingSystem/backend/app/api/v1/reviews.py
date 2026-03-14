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

    # Resolve content title for display
    from app.models.course import Course, CourseVersion
    from app.models.question import Question, QuestionVersion
    from app.models.knowledge import KnowledgePoint

    async def get_content_title(content_type: str, content_id: uuid.UUID) -> str | None:
        if content_type == "course_version":
            cv = (await db.execute(select(CourseVersion).where(CourseVersion.id == content_id))).scalar_one_or_none()
            if cv:
                c = (await db.execute(select(Course).where(Course.id == cv.course_id))).scalar_one_or_none()
                return c.title if c else None
        elif content_type == "question_version":
            qv = (await db.execute(select(QuestionVersion).where(QuestionVersion.id == content_id))).scalar_one_or_none()
            if qv:
                q2 = (await db.execute(select(Question).where(Question.id == qv.question_id))).scalar_one_or_none()
                return (q2.stem[:60] + "…") if q2 and len(q2.stem) > 60 else (q2.stem if q2 else None)
        elif content_type == "knowledge_point":
            kp = (await db.execute(select(KnowledgePoint).where(KnowledgePoint.id == content_id))).scalar_one_or_none()
            return kp.name if kp else None
        return None

    items = []
    for r in rows:
        title = await get_content_title(r.content_type, r.content_id)
        items.append({
            "id": str(r.id), "content_type": r.content_type, "content_id": str(r.content_id),
            "content_title": title,
            "content_version_id": str(r.content_version_id), "review_stage": r.review_stage,
            "status": r.status, "assigned_reviewer_id": str(r.assigned_reviewer_id) if r.assigned_reviewer_id else None,
            "created_at": r.created_at.isoformat(),
        })
    return paginated_response(items=items, total=total, page=page, page_size=page_size)


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

    # Sync content status when review is approved or rejected
    if action in ("approve", "reject") and task.content_type == "course_version":
        from app.models.course import Course, CourseVersion
        from datetime import datetime, timezone
        ver = (await db.execute(select(CourseVersion).where(CourseVersion.id == task.content_version_id))).scalar_one_or_none()
        if ver:
            if action == "approve":
                # Archive any currently published version
                published = (await db.execute(
                    select(CourseVersion).where(CourseVersion.course_id == ver.course_id, CourseVersion.status == "published")
                )).scalars().all()
                for pv in published:
                    pv.status = "archived"
                ver.status = "published"
                ver.published_at = datetime.now(timezone.utc)
                # Sync course status
                course = (await db.execute(select(Course).where(Course.id == ver.course_id))).scalar_one_or_none()
                if course:
                    course.status = "published"
            else:
                ver.status = "rejected"

    await db.commit()
    return success_response(data={"id": str(task.id), "status": task.status}, message=f"审核操作已完成：{action}")


@router.post("/batch-action", response_model=dict, summary="批量审核操作")
async def batch_review_action(
    task_ids: list[uuid.UUID] = Body(...),
    action: str = Body(...),
    comment: str = Body(""),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    ACTION_MAP = {"approve": "approved", "reject": "rejected"}
    if action not in ACTION_MAP:
        raise BusinessException(code="INVALID_ACTION", message=f"无效操作：{action}")

    success_count = 0
    for tid in task_ids:
        result = await db.execute(
            select(ReviewTask).options(selectinload(ReviewTask.comments)).where(ReviewTask.id == tid)
        )
        task = result.scalar_one_or_none()
        if not task or task.status not in ("pending", "in_review"):
            continue
        task.status = ACTION_MAP[action]
        task.assigned_reviewer_id = uuid.UUID(user_id)
        if comment:
            rc = ReviewComment(
                review_task_id=task.id, reviewer_id=uuid.UUID(user_id),
                comment_type="approval",
                content=comment, action_suggestion=action,
            )
            db.add(rc)
        success_count += 1

    await db.commit()
    return success_response(data={"success_count": success_count}, message=f"批量操作完成，处理 {success_count} 条")
