from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import paginated_response, success_response
from app.models.audit import AsyncJob, AuditLog

router = APIRouter()


@router.get("/statistics", response_model=dict, summary="系统统计数据")
async def get_statistics(
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.document import Document
    from app.models.training import TrainingAssignment, TrainingTask
    from app.models.exam import ExamAttempt
    from app.models.user import User

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_docs = (await db.execute(select(func.count()).select_from(Document))).scalar_one()
    total_tasks = (await db.execute(select(func.count()).select_from(TrainingTask))).scalar_one()
    total_assignments = (await db.execute(select(func.count()).select_from(TrainingAssignment))).scalar_one()
    completed_assignments = (await db.execute(
        select(func.count()).select_from(TrainingAssignment)
        .where(TrainingAssignment.assignment_status.in_(["study_completed", "exam_completed"]))
    )).scalar_one()
    total_attempts = (await db.execute(select(func.count()).select_from(ExamAttempt))).scalar_one()
    passed_attempts = (await db.execute(
        select(func.count()).select_from(ExamAttempt)
        .where(ExamAttempt.pass_result == True)  # noqa: E712
    )).scalar_one()

    # per-task stats
    tasks = (await db.execute(
        select(TrainingTask).order_by(TrainingTask.created_at.desc()).limit(10)
    )).scalars().all()
    task_stats = []
    for t in tasks:
        total_a = (await db.execute(
            select(func.count()).select_from(TrainingAssignment)
            .where(TrainingAssignment.training_task_id == t.id)
        )).scalar_one()
        done_a = (await db.execute(
            select(func.count()).select_from(TrainingAssignment)
            .where(
                TrainingAssignment.training_task_id == t.id,
                TrainingAssignment.assignment_status.in_(["study_completed", "exam_completed"]),
            )
        )).scalar_one()
        task_stats.append({
            "id": str(t.id),
            "title": t.title,
            "status": t.status,
            "total_assigned": total_a,
            "completed_count": done_a,
            "completion_rate": round(done_a / total_a * 100) if total_a > 0 else 0,
        })

    return success_response(data={
        "overview": {
            "total_users": total_users,
            "total_documents": total_docs,
            "total_training_tasks": total_tasks,
            "total_assignments": total_assignments,
            "completed_assignments": completed_assignments,
            "completion_rate": round(completed_assignments / total_assignments * 100) if total_assignments > 0 else 0,
            "total_exam_attempts": total_attempts,
            "passed_exam_attempts": passed_attempts,
            "exam_pass_rate": round(passed_attempts / total_attempts * 100) if total_attempts > 0 else 0,
        },
        "task_stats": task_stats,
    })


@router.get("/audit-logs", response_model=dict, summary="审计日志")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog).order_by(desc(AuditLog.created_at))
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)

    count_query = select(AuditLog)
    if action:
        count_query = count_query.where(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        count_query = count_query.where(AuditLog.resource_type == resource_type)
    count_res = await db.execute(count_query)
    total = len(count_res.scalars().all())

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()
    items = [{
        "id": str(lg.id),
        "operator_id": str(lg.operator_id) if lg.operator_id else None,
        "action": lg.action,
        "resource_type": lg.resource_type,
        "resource_id": str(lg.resource_id) if lg.resource_id else None,
        "before_data": lg.before_data,
        "after_data": lg.after_data,
        "created_at": lg.created_at.isoformat(),
    } for lg in logs]
    return paginated_response(items=items, total=total, page=page, page_size=page_size)


@router.get("/async-jobs", response_model=dict, summary="异步任务列表")
async def list_async_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    job_type: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    query = select(AsyncJob).order_by(desc(AsyncJob.queued_at))
    if status:
        query = query.where(AsyncJob.status == status)
    if job_type:
        query = query.where(AsyncJob.job_type == job_type)

    count_query = select(AsyncJob)
    if status:
        count_query = count_query.where(AsyncJob.status == status)
    if job_type:
        count_query = count_query.where(AsyncJob.job_type == job_type)
    count_res = await db.execute(count_query)
    total = len(count_res.scalars().all())

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    jobs = result.scalars().all()
    items = [{
        "id": str(j.id),
        "job_type": j.job_type,
        "biz_type": j.biz_type,
        "biz_id": str(j.biz_id) if j.biz_id else None,
        "status": j.status,
        "retry_count": j.retry_count,
        "error_message": j.error_message,
        "queued_at": j.queued_at.isoformat(),
        "started_at": j.started_at.isoformat() if j.started_at else None,
        "finished_at": j.finished_at.isoformat() if j.finished_at else None,
    } for j in jobs]
    return paginated_response(items=items, total=total, page=page, page_size=page_size)


@router.get("/bg-tasks", response_model=dict, summary="后台任务统一视图（文档解析+课程生成+题目生成）")
async def list_bg_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    job_type: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.document import Document, DocumentParseTask, DocumentVersion
    from app.models.course import Course, CourseGenerationTask
    from app.models.question import QuestionGenerationTask
    from app.models.knowledge import KnowledgePoint

    TYPE_LABEL: dict[str, str] = {
        "single_choice": "单选", "multi_choice": "多选",
        "true_false": "判断", "fill_blank": "填空", "short_answer": "简答",
    }

    all_items: list[dict] = []

    if not job_type or job_type == "document_parse":
        q = select(DocumentParseTask)
        if status:
            q = q.where(DocumentParseTask.status == status)
        for r in (await db.execute(q.order_by(desc(DocumentParseTask.created_at)).limit(200))).scalars().all():
            # Resolve document title via version → document
            doc_title = None
            dv = (await db.execute(select(DocumentVersion).where(DocumentVersion.id == r.document_version_id))).scalar_one_or_none()
            if dv:
                doc = (await db.execute(select(Document).where(Document.id == dv.document_id))).scalar_one_or_none()
                doc_title = doc.title if doc else None
            description = f"文档：{doc_title}" if doc_title else "文档解析"
            all_items.append({
                "id": str(r.id), "job_type": "document_parse", "biz_label": "文档解析",
                "description": description,
                "biz_id": str(r.document_version_id), "status": r.status,
                "retry_count": r.retry_count, "error_message": r.error_message,
                "created_at": r.created_at.isoformat(),
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            })

    if not job_type or job_type == "course_generate":
        q = select(CourseGenerationTask)
        if status:
            q = q.where(CourseGenerationTask.status == status)
        for r in (await db.execute(q.order_by(desc(CourseGenerationTask.created_at)).limit(200))).scalars().all():
            # Resolve course title
            course_title = None
            if r.course_id:
                course = (await db.execute(select(Course).where(Course.id == r.course_id))).scalar_one_or_none()
                course_title = course.title if course else None
            cfg = r.config or {}
            chapter_count = cfg.get("chapter_count", "?")
            kp_ids = cfg.get("knowledge_point_ids", [])
            kp_part = f"，{len(kp_ids)} 个知识点" if kp_ids else "，全部知识点"
            description = f"课程：{course_title}（{chapter_count} 章节{kp_part}）" if course_title else f"课程生成（{chapter_count} 章节{kp_part}）"
            all_items.append({
                "id": str(r.id), "job_type": "course_generate", "biz_label": "课程生成",
                "description": description,
                "biz_id": str(r.course_id) if r.course_id else None, "status": r.status,
                "retry_count": r.retry_count, "error_message": r.error_message,
                "created_at": r.created_at.isoformat(), "started_at": None, "finished_at": None,
            })

    if not job_type or job_type == "question_generate":
        q = select(QuestionGenerationTask)
        if status:
            q = q.where(QuestionGenerationTask.status == status)
        for r in (await db.execute(q.order_by(desc(QuestionGenerationTask.created_at)).limit(200))).scalars().all():
            cfg = r.config or {}
            count = cfg.get("count", "?")
            types = cfg.get("question_types", [])
            type_str = "、".join(TYPE_LABEL.get(t, t) for t in types) if types else "混合题型"
            kp_ids = cfg.get("knowledge_point_ids", [])
            kp_part = f"，{len(kp_ids)} 个知识点" if kp_ids else "，全部知识点"
            description = f"生成 {count} 题（{type_str}{kp_part}）"
            all_items.append({
                "id": str(r.id), "job_type": "question_generate", "biz_label": "题目生成",
                "description": description,
                "biz_id": None, "status": r.status,
                "retry_count": r.retry_count, "error_message": r.error_message,
                "created_at": r.created_at.isoformat(), "started_at": None, "finished_at": None,
            })

    all_items.sort(key=lambda x: x["created_at"], reverse=True)
    total = len(all_items)
    start = (page - 1) * page_size
    return paginated_response(items=all_items[start:start + page_size], total=total, page=page, page_size=page_size)
