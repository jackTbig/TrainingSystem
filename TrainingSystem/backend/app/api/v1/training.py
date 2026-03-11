import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user_id, get_db
from app.core.exceptions import BusinessException, NotFoundException
from app.core.response import paginated_response, success_response
from app.models.training import StudyProgress, TrainingAssignment, TrainingTask

router = APIRouter()


@router.get("", response_model=dict, summary="培训任务列表")
async def list_training_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(TrainingTask)
    if status:
        q = q.where(TrainingTask.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.order_by(TrainingTask.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = list((await db.execute(q)).scalars().all())
    return paginated_response(
        items=[{"id": str(r.id), "title": r.title, "status": r.status,
                "due_at": r.due_at.isoformat() if r.due_at else None,
                "created_at": r.created_at.isoformat()} for r in rows],
        total=total, page=page, page_size=page_size,
    )


@router.post("", response_model=dict, summary="创建培训任务")
async def create_training_task(
    title: str = Body(...),
    description: str | None = Body(None),
    course_version_id: uuid.UUID | None = Body(None),
    exam_id: uuid.UUID | None = Body(None),
    due_at: datetime | None = Body(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task = TrainingTask(
        title=title, description=description,
        course_version_id=course_version_id, exam_id=exam_id,
        due_at=due_at, created_by=uuid.UUID(user_id),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return success_response(data={"id": str(task.id), "title": task.title, "status": task.status})


@router.get("/{task_id}", response_model=dict, summary="培训任务详情（含分配列表和进度）")
async def get_training_task(
    task_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User
    from app.models.exam import ExamAttempt

    result = await db.execute(select(TrainingTask).where(TrainingTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException(code="TASK_NOT_FOUND", message="培训任务不存在")

    # 所有分配记录
    asgn_rows = list((await db.execute(
        select(TrainingAssignment).where(TrainingAssignment.training_task_id == task_id)
    )).scalars())

    assignments = []
    for asgn in asgn_rows:
        user = (await db.execute(select(User).where(User.id == asgn.user_id))).scalar_one_or_none()
        prog = (await db.execute(
            select(StudyProgress).where(StudyProgress.training_assignment_id == asgn.id)
        )).scalar_one_or_none()
        # 最新考试尝试成绩
        attempt = None
        if task.exam_id:
            attempt = (await db.execute(
                select(ExamAttempt).where(
                    ExamAttempt.exam_id == task.exam_id,
                    ExamAttempt.user_id == asgn.user_id,
                ).order_by(ExamAttempt.submitted_at.desc().nullslast())
            )).scalars().first()
        assignments.append({
            "assignment_id": str(asgn.id),
            "user_id": str(asgn.user_id),
            "username": user.username if user else "",
            "real_name": user.real_name if user else "",
            "assignment_status": asgn.assignment_status,
            "progress_percent": prog.progress_percent if prog else 0,
            "completed": prog.completed if prog else False,
            "study_completed_at": asgn.study_completed_at.isoformat() if asgn.study_completed_at else None,
            "exam_score": attempt.total_score if attempt else None,
            "exam_passed": attempt.pass_result if attempt else None,
        })

    return success_response(data={
        "id": str(task.id),
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "course_version_id": str(task.course_version_id) if task.course_version_id else None,
        "exam_id": str(task.exam_id) if task.exam_id else None,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "allow_makeup_exam": task.allow_makeup_exam,
        "created_at": task.created_at.isoformat(),
        "total_assigned": len(asgn_rows),
        "completed_count": sum(1 for a in assignments if a["completed"]),
        "assignments": assignments,
    })


@router.delete("/{task_id}/assignments/{user_id}", response_model=dict, summary="移除分配学员")
async def remove_assignment(
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TrainingAssignment).where(
            TrainingAssignment.training_task_id == task_id,
            TrainingAssignment.user_id == user_id,
        )
    )
    asgn = result.scalar_one_or_none()
    if asgn:
        await db.delete(asgn)
        await db.commit()
    return success_response(message="已移除")


@router.put("/{task_id}", response_model=dict, summary="更新培训任务")
async def update_training_task(
    task_id: uuid.UUID,
    title: str | None = Body(None),
    description: str | None = Body(None),
    due_at: datetime | None = Body(None),
    allow_makeup_exam: bool | None = Body(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TrainingTask).where(TrainingTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException(code="TASK_NOT_FOUND", message="培训任务不存在")
    if title is not None: task.title = title
    if description is not None: task.description = description
    if due_at is not None: task.due_at = due_at
    if allow_makeup_exam is not None: task.allow_makeup_exam = allow_makeup_exam
    await db.commit()
    return success_response(data={"id": str(task.id), "title": task.title, "status": task.status})


@router.delete("/{task_id}", response_model=dict, summary="删除培训任务")
async def delete_training_task(
    task_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete as sql_delete
    result = await db.execute(select(TrainingTask).where(TrainingTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException(code="TASK_NOT_FOUND", message="培训任务不存在")
    if task.status == "published":
        raise BusinessException(code="TASK_PUBLISHED", message="已发布的培训任务不可删除，请先归档")
    # cascade: delete study_progress → assignments → task
    asgn_ids = [r.id for r in (await db.execute(
        select(TrainingAssignment.id).where(TrainingAssignment.training_task_id == task_id)
    )).scalars()]
    if asgn_ids:
        await db.execute(sql_delete(StudyProgress).where(StudyProgress.training_assignment_id.in_(asgn_ids)))
        await db.execute(sql_delete(TrainingAssignment).where(TrainingAssignment.training_task_id == task_id))
    await db.delete(task)
    await db.commit()
    return success_response(message="培训任务已删除")


@router.post("/{task_id}/publish", response_model=dict, summary="发布培训任务")
async def publish_task(
    task_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TrainingTask).where(TrainingTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException(code="TASK_NOT_FOUND", message="培训任务不存在")
    if task.status != "draft":
        raise BusinessException(code="TASK_NOT_DRAFT", message="只有草稿可发布")
    task.status = "published"
    await db.commit()
    return success_response(data={"id": str(task.id), "status": task.status})


@router.post("/{task_id}/assign", response_model=dict, summary="分配学员")
async def assign_users(
    task_id: uuid.UUID,
    user_ids: list[uuid.UUID] = Body(...),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TrainingTask).where(TrainingTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundException(code="TASK_NOT_FOUND", message="培训任务不存在")
    created = 0
    for uid in user_ids:
        existing = await db.execute(
            select(TrainingAssignment).where(
                TrainingAssignment.training_task_id == task_id,
                TrainingAssignment.user_id == uid,
            )
        )
        if not existing.scalar_one_or_none():
            asgn = TrainingAssignment(training_task_id=task_id, user_id=uid)
            db.add(asgn)
            created += 1
    await db.commit()
    return success_response(data={"assigned": created}, message=f"已分配 {created} 名学员")


@router.get("/my", response_model=dict, summary="我的培训任务列表（学员端）")
async def my_training_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """返回当前用户被分配的培训任务及进度。"""
    uid = uuid.UUID(user_id)
    q = select(TrainingAssignment).where(TrainingAssignment.user_id == uid)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.order_by(TrainingAssignment.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    assignments = list((await db.execute(q)).scalars())

    items = []
    for asgn in assignments:
        task_result = await db.execute(select(TrainingTask).where(TrainingTask.id == asgn.training_task_id))
        task = task_result.scalar_one_or_none()
        if not task:
            continue
        prog_result = await db.execute(
            select(StudyProgress).where(StudyProgress.training_assignment_id == asgn.id)
        )
        prog = prog_result.scalar_one_or_none()
        items.append({
            "assignment_id": str(asgn.id),
            "task_id": str(task.id),
            "title": task.title,
            "description": task.description,
            "course_version_id": str(task.course_version_id) if task.course_version_id else None,
            "exam_id": str(task.exam_id) if task.exam_id else None,
            "due_at": task.due_at.isoformat() if task.due_at else None,
            "assignment_status": asgn.assignment_status,
            "progress_percent": prog.progress_percent if prog else 0,
            "completed": prog.completed if prog else False,
        })
    return paginated_response(items=items, total=total, page=page, page_size=page_size)


@router.post("/assignments/{assignment_id}/progress", response_model=dict, summary="更新学习进度")
async def update_progress(
    assignment_id: uuid.UUID,
    progress_percent: int = Body(..., ge=0, le=100),
    last_position: dict | None = Body(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TrainingAssignment).where(TrainingAssignment.id == assignment_id)
    )
    asgn = result.scalar_one_or_none()
    if not asgn:
        raise NotFoundException(code="ASSIGNMENT_NOT_FOUND", message="培训分配不存在")
    if str(asgn.user_id) != user_id:
        raise BusinessException(code="FORBIDDEN", message="无权操作")

    prog_result = await db.execute(
        select(StudyProgress).where(StudyProgress.training_assignment_id == assignment_id)
    )
    prog = prog_result.scalar_one_or_none()
    if prog:
        prog.progress_percent = progress_percent
        if last_position:
            prog.last_position = last_position
        if progress_percent >= 100:
            prog.completed = True
        prog.updated_at = datetime.now(timezone.utc)
    else:
        prog = StudyProgress(
            training_assignment_id=assignment_id,
            progress_percent=progress_percent,
            last_position=last_position,
            completed=(progress_percent >= 100),
        )
        db.add(prog)

    if progress_percent >= 100 and asgn.assignment_status == "assigned":
        asgn.assignment_status = "study_completed"
        asgn.study_completed_at = datetime.now(timezone.utc)

    await db.commit()
    return success_response(data={"progress_percent": progress_percent, "completed": progress_percent >= 100})
