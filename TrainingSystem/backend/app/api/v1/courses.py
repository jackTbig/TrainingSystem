import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import paginated_response, success_response
from app.schemas.course import CourseChapterCreate, CourseChapterUpdate, CourseCreate, CourseUpdate, CourseVersionCreate
from app.services.course import CourseService

router = APIRouter()


@router.get("", response_model=dict, summary="课程列表")
async def list_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    mine: bool = Query(False),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    owner = uuid.UUID(user_id) if mine else None
    courses, total = await svc.list_courses(page, page_size, owner, status)
    return paginated_response(items=[c.model_dump() for c in courses], total=total, page=page, page_size=page_size)


@router.post("", response_model=dict, summary="创建课程")
async def create_course(
    data: CourseCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    course = await svc.create_course(data, uuid.UUID(user_id))
    return success_response(data=course.model_dump())


@router.get("/{course_id}", response_model=dict, summary="课程详情")
async def get_course(
    course_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    course = await svc.get_course(course_id)
    return success_response(data=course.model_dump())


@router.put("/{course_id}", response_model=dict, summary="更新课程")
async def update_course(
    course_id: uuid.UUID,
    data: CourseUpdate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    course = await svc.update_course(course_id, data)
    return success_response(data=course.model_dump())


# ── 版本 ──────────────────────────────────────────────────────────────────────

@router.delete("/{course_id}", response_model=dict, summary="删除课程")
async def delete_course(
    course_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, delete as sql_delete, func
    from app.models.course import Course, CourseVersion, CourseChapter
    from app.models.training import TrainingTask
    from app.core.exceptions import NotFoundException, BusinessException

    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise NotFoundException(code="COURSE_NOT_FOUND", message="课程不存在")
    # check if any version is referenced by a training task
    versions = (await db.execute(select(CourseVersion).where(CourseVersion.course_id == course_id))).scalars().all()
    ver_ids = [v.id for v in versions]
    if ver_ids:
        ref_count = (await db.execute(
            select(func.count()).select_from(TrainingTask)
            .where(TrainingTask.course_version_id.in_(ver_ids))
        )).scalar_one()
        if ref_count > 0:
            raise BusinessException(code="COURSE_IN_USE", message=f"该课程已被 {ref_count} 个培训任务引用，无法删除")
        # delete chapters → versions
        for vid in ver_ids:
            await db.execute(sql_delete(CourseChapter).where(CourseChapter.course_version_id == vid))
        await db.execute(sql_delete(CourseVersion).where(CourseVersion.course_id == course_id))
    await db.delete(course)
    await db.commit()
    return success_response(message="课程已删除")


@router.post("/{course_id}/versions", response_model=dict, summary="新建课程版本")
async def create_version(
    course_id: uuid.UUID,
    data: CourseVersionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    ver = await svc.create_version(course_id, data, uuid.UUID(user_id))
    return success_response(data=ver.model_dump())


@router.get("/versions/{version_id}", response_model=dict, summary="版本详情")
async def get_version(
    version_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    ver = await svc.get_version(version_id)
    return success_response(data=ver.model_dump())


@router.post("/versions/{version_id}/status", response_model=dict, summary="更新版本状态")
async def update_version_status(
    version_id: uuid.UUID,
    status: str = Body(..., embed=True),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    ver = await svc.update_version_status(version_id, status)
    return success_response(data=ver.model_dump())


@router.post("/versions/{version_id}/rollback", response_model=dict, summary="版本回滚（将此版本设为发布版）")
async def rollback_version(
    version_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from app.models.course import CourseVersion
    from app.core.exceptions import NotFoundException, BusinessException

    target = (await db.execute(select(CourseVersion).where(CourseVersion.id == version_id))).scalar_one_or_none()
    if not target:
        raise NotFoundException(code="VERSION_NOT_FOUND", message="版本不存在")
    if target.status == "published":
        raise BusinessException(code="ALREADY_PUBLISHED", message="该版本已是发布状态")

    # archive current published version of same course
    published_versions = (await db.execute(
        select(CourseVersion).where(
            CourseVersion.course_id == target.course_id,
            CourseVersion.status == "published",
        )
    )).scalars().all()
    for v in published_versions:
        v.status = "archived"

    target.status = "published"
    await db.commit()
    return success_response(data={"id": str(target.id), "status": target.status}, message="版本回滚成功")


# ── 章节 ──────────────────────────────────────────────────────────────────────

@router.post("/versions/{version_id}/chapters", response_model=dict, summary="添加章节")
async def add_chapter(
    version_id: uuid.UUID,
    data: CourseChapterCreate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    ch = await svc.add_chapter(version_id, data)
    return success_response(data=ch.model_dump())


@router.put("/chapters/{chapter_id}", response_model=dict, summary="更新章节")
async def update_chapter(
    chapter_id: uuid.UUID,
    data: CourseChapterUpdate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    ch = await svc.update_chapter(chapter_id, data)
    return success_response(data=ch.model_dump())


@router.delete("/chapters/{chapter_id}", response_model=dict, summary="删除章节")
async def delete_chapter(
    chapter_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = CourseService(db)
    await svc.delete_chapter(chapter_id)
    return success_response(message="章节已删除")


# ── AI 生成 ───────────────────────────────────────────────────────────────────

class CourseGenerateRequest(BaseModel):
    knowledge_point_ids: list[str] = []
    chapter_count: int = 5


@router.post("/{course_id}/ai-generate", response_model=dict, summary="AI 生成课程内容")
async def ai_generate_course(
    course_id: uuid.UUID,
    req: CourseGenerateRequest,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """创建 AI 课程生成任务并发布到消息队列。"""
    from app.models.course import Course, CourseGenerationTask
    from sqlalchemy import select
    from app.services.mq import QUEUE_COURSE_GENERATE, publish

    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(code="COURSE_NOT_FOUND", message="课程不存在")

    task = CourseGenerationTask(
        id=uuid.uuid4(),
        course_id=course_id,
        status="queued",
        config={
            "knowledge_point_ids": req.knowledge_point_ids,
            "chapter_count": req.chapter_count,
        },
    )
    db.add(task)
    await db.commit()

    await publish(QUEUE_COURSE_GENERATE, {
        "task_id": str(task.id),
        "course_id": str(course_id),
        "knowledge_point_ids": req.knowledge_point_ids,
        "chapter_count": req.chapter_count,
    })

    return success_response(data={"task_id": str(task.id), "status": "queued"})


@router.get("/{course_id}/generation-tasks/{task_id}", response_model=dict, summary="AI生成任务状态")
async def get_generation_task_status(
    course_id: uuid.UUID,
    task_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.course import CourseGenerationTask
    from sqlalchemy import select
    task = (await db.execute(
        select(CourseGenerationTask).where(
            CourseGenerationTask.id == task_id,
            CourseGenerationTask.course_id == course_id,
        )
    )).scalar_one_or_none()
    if not task:
        from app.core.exceptions import NotFoundException
        raise NotFoundException(code="TASK_NOT_FOUND", message="任务不存在")
    return success_response(data={
        "task_id": str(task.id),
        "status": task.status,
        "error_message": task.error_message,
        "config": task.config,
        "created_at": task.created_at.isoformat(),
    })


@router.get("/{course_id}/generation-tasks", response_model=dict, summary="课程AI生成任务列表")
async def list_generation_tasks(
    course_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.course import CourseGenerationTask
    from sqlalchemy import select, desc
    tasks = list((await db.execute(
        select(CourseGenerationTask)
        .where(CourseGenerationTask.course_id == course_id)
        .order_by(desc(CourseGenerationTask.created_at))
        .limit(10)
    )).scalars())
    return success_response(data=[{
        "task_id": str(t.id),
        "status": t.status,
        "error_message": t.error_message,
        "config": t.config,
        "created_at": t.created_at.isoformat(),
    } for t in tasks])
