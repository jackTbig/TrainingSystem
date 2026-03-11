import uuid

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user_id, get_db
from app.core.exceptions import NotFoundException
from app.core.response import paginated_response, success_response
from app.models.question import Question, QuestionVersion
from app.schemas.question import QuestionVersionCreate, QuestionVersionUpdate

router = APIRouter()


@router.get("", response_model=dict, summary="题目列表")
async def list_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    question_type: str | None = Query(None),
    keyword: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Question).options(selectinload(Question.versions))
    if status:
        q = q.where(Question.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.order_by(Question.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = list((await db.execute(q)).scalars().all())

    items = []
    for r in rows:
        # 找当前版本
        cur_ver = next((v for v in r.versions if str(v.id) == str(r.current_version_id)), r.versions[0] if r.versions else None)
        if question_type and cur_ver and cur_ver.question_type != question_type:
            continue
        if keyword and cur_ver and keyword.lower() not in cur_ver.stem.lower():
            continue
        items.append({
            "id": str(r.id),
            "status": r.status,
            "current_version_id": str(r.current_version_id) if r.current_version_id else None,
            "created_at": r.created_at.isoformat(),
            "question_type": cur_ver.question_type if cur_ver else None,
            "stem": cur_ver.stem[:100] if cur_ver else None,
            "difficulty_level": cur_ver.difficulty_level if cur_ver else None,
        })
    return paginated_response(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=dict, summary="新建题目（含第一个版本）")
async def create_question(
    data: QuestionVersionCreate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    q = Question()
    db.add(q)
    await db.flush()
    ver = QuestionVersion(
        question_id=q.id, version_no=1, question_type=data.question_type,
        stem=data.stem, options=data.options, answer_json=data.answer_json,
        analysis=data.analysis, difficulty_level=data.difficulty_level,
    )
    db.add(ver)
    await db.flush()
    q.current_version_id = ver.id
    await db.commit()
    await db.refresh(q)
    return success_response(data={"id": str(q.id), "status": q.status, "current_version_id": str(q.current_version_id)})


@router.get("/{question_id}", response_model=dict, summary="题目详情")
async def get_question(
    question_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Question).options(selectinload(Question.versions)).where(Question.id == question_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise NotFoundException(code="QUESTION_NOT_FOUND", message="题目不存在")
    return success_response(data={
        "id": str(q.id), "status": q.status,
        "current_version_id": str(q.current_version_id) if q.current_version_id else None,
        "versions": [
            {"id": str(v.id), "version_no": v.version_no, "question_type": v.question_type,
             "stem": v.stem, "options": v.options, "answer_json": v.answer_json,
             "analysis": v.analysis, "difficulty_level": v.difficulty_level, "status": v.status}
            for v in q.versions
        ],
    })


@router.post("/{question_id}/versions", response_model=dict, summary="新建题目版本")
async def add_question_version(
    question_id: uuid.UUID,
    data: QuestionVersionCreate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Question).options(selectinload(Question.versions)).where(Question.id == question_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise NotFoundException(code="QUESTION_NOT_FOUND", message="题目不存在")
    next_no = max((v.version_no for v in q.versions), default=0) + 1
    ver = QuestionVersion(
        question_id=question_id, version_no=next_no, question_type=data.question_type,
        stem=data.stem, options=data.options, answer_json=data.answer_json,
        analysis=data.analysis, difficulty_level=data.difficulty_level,
    )
    db.add(ver)
    q.current_version_id = ver.id
    await db.commit()
    return success_response(data={"id": str(ver.id), "version_no": next_no})


@router.put("/{question_id}", response_model=dict, summary="更新题目（新建版本保存更改）")
async def update_question(
    question_id: uuid.UUID,
    data: QuestionVersionCreate,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from app.core.exceptions import NotFoundException
    result = await db.execute(
        select(Question).options(selectinload(Question.versions)).where(Question.id == question_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise NotFoundException(code="QUESTION_NOT_FOUND", message="题目不存在")
    next_no = max((v.version_no for v in q.versions), default=0) + 1
    ver = QuestionVersion(
        question_id=question_id, version_no=next_no,
        question_type=data.question_type, stem=data.stem, options=data.options,
        answer_json=data.answer_json, analysis=data.analysis, difficulty_level=data.difficulty_level,
    )
    db.add(ver)
    await db.flush()
    q.current_version_id = ver.id
    await db.commit()
    return success_response(data={"id": str(q.id), "current_version_id": str(ver.id), "version_no": next_no})


@router.delete("/{question_id}", response_model=dict, summary="删除题目")
async def delete_question(
    question_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete as sql_delete
    from app.core.exceptions import NotFoundException, BusinessException
    result = await db.execute(
        select(Question).options(selectinload(Question.versions)).where(Question.id == question_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise NotFoundException(code="QUESTION_NOT_FOUND", message="题目不存在")
    # check if any version is in a published exam paper
    from app.models.exam import ExamPaperItem, ExamAnswer
    ver_ids = [v.id for v in q.versions]
    if ver_ids:
        in_paper = (await db.execute(
            select(func.count()).select_from(ExamPaperItem)
            .where(ExamPaperItem.question_version_id.in_(ver_ids))
        )).scalar_one()
        if in_paper > 0:
            raise BusinessException(code="QUESTION_IN_PAPER", message=f"该题目已被 {in_paper} 份试卷引用，无法删除")
        # delete exam answers referencing these versions
        await db.execute(sql_delete(ExamAnswer).where(ExamAnswer.question_version_id.in_(ver_ids)))
    # explicitly delete versions before deleting the question
    await db.execute(sql_delete(QuestionVersion).where(QuestionVersion.question_id == question_id))
    await db.delete(q)
    await db.commit()
    return success_response(message="题目已删除")


@router.post("/{question_id}/status", response_model=dict, summary="更新题目状态")
async def update_question_status(
    question_id: uuid.UUID,
    status: str = Body(..., embed=True),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise NotFoundException(code="QUESTION_NOT_FOUND", message="题目不存在")
    q.status = status
    await db.commit()
    return success_response(data={"id": str(q.id), "status": q.status})


# ── AI 生成 ───────────────────────────────────────────────────────────────────

class QuestionGenerateRequest(BaseModel):
    knowledge_point_ids: list[str] = []
    chapter_ids: list[str] = []
    question_types: list[str] = ["single_choice", "true_false", "short_answer"]
    count: int = 10


@router.post("/ai-generate", response_model=dict, summary="AI 批量生成题目")
async def ai_generate_questions(
    req: QuestionGenerateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """创建 AI 题目生成任务并发布到消息队列。"""
    from app.models.question import QuestionGenerationTask
    from app.services.mq import QUEUE_QUESTION_GENERATE, publish

    task = QuestionGenerationTask(
        id=uuid.uuid4(),
        status="queued",
        config={
            "knowledge_point_ids": req.knowledge_point_ids,
            "chapter_ids": req.chapter_ids,
            "question_types": req.question_types,
            "count": req.count,
        },
    )
    db.add(task)
    await db.commit()

    await publish(QUEUE_QUESTION_GENERATE, {
        "task_id": str(task.id),
        "knowledge_point_ids": req.knowledge_point_ids,
        "chapter_ids": req.chapter_ids,
        "question_types": req.question_types,
        "count": req.count,
        "owner_id": user_id,
    })

    return success_response(data={"task_id": str(task.id), "status": "queued"})
