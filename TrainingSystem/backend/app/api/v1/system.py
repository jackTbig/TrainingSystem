from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import paginated_response
from app.models.audit import AsyncJob, AuditLog

router = APIRouter()


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
