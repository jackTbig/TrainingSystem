import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user_id, get_db
from app.core.exceptions import BusinessException, NotFoundException
from app.core.response import paginated_response, success_response
from app.models.exam import Exam, ExamAnswer, ExamAttempt, ExamPaper, ExamPaperItem
from app.models.question import QuestionVersion

router = APIRouter()


# ── 自动阅卷 ──────────────────────────────────────────────────────────────────

def _score_answer(q_type: str, correct: dict, submitted: dict, max_score: int) -> int:
    """对客观题自动判分，返回得分；主观题返回 0（待人工批阅）。"""
    try:
        if q_type == "single_choice":
            correct_val = str(correct.get("value") or correct.get("answer", "")).strip().upper()
            sub_val = str(submitted.get("value", "")).strip().upper()
            return max_score if correct_val == sub_val else 0

        if q_type == "true_false":
            def to_bool(v):
                if isinstance(v, bool): return v
                return str(v).lower() in ("true", "是", "1", "正确")
            return max_score if to_bool(correct.get("value", correct.get("answer"))) == to_bool(submitted.get("value", "")) else 0

        if q_type == "multi_choice":
            correct_val = set(str(correct.get("value") or correct.get("answer", "")).upper().split(","))
            sub_val = set(str(submitted.get("value", "")).upper().split(","))
            correct_val = {v.strip() for v in correct_val if v.strip()}
            sub_val = {v.strip() for v in sub_val if v.strip()}
            return max_score if correct_val == sub_val else 0

        if q_type == "matching":
            correct_pairs = correct.get("pairs", {})
            sub_pairs = submitted.get("value", {})
            if not correct_pairs:
                return 0
            if isinstance(sub_pairs, str):
                try:
                    import json as _json
                    sub_pairs = _json.loads(sub_pairs)
                except Exception:
                    return 0
            if not isinstance(sub_pairs, dict):
                return 0
            matched = sum(1 for k, v in correct_pairs.items() if str(sub_pairs.get(str(k), "")) == str(v))
            return round(max_score * matched / len(correct_pairs))

    except Exception:
        pass
    # fill_blank / short_answer / ai_graded → 人工批阅或 AI 批阅
    return 0


async def _grade_attempt(attempt: ExamAttempt, db: AsyncSession) -> None:
    """对已提交的答卷执行自动阅卷，更新 ExamAnswer.score + ExamAttempt.total_score + pass_result。"""
    # 加载试卷题目和分值
    exam_result = await db.execute(
        select(Exam).options(selectinload(Exam.attempts)).where(Exam.id == attempt.exam_id)
    )
    exam = exam_result.scalar_one_or_none()
    if not exam or not exam.paper_id:
        return

    paper_result = await db.execute(
        select(ExamPaper).options(selectinload(ExamPaper.items)).where(ExamPaper.id == exam.paper_id)
    )
    paper = paper_result.scalar_one_or_none()
    if not paper:
        return

    # 建立 question_version_id → (max_score) 映射
    score_map: dict[uuid.UUID, int] = {item.question_version_id: item.score for item in paper.items}

    # 加载题目正确答案
    qv_ids = list(score_map.keys())
    qv_result = await db.execute(
        select(QuestionVersion).where(QuestionVersion.id.in_(qv_ids))
    )
    qv_map: dict[uuid.UUID, QuestionVersion] = {qv.id: qv for qv in qv_result.scalars()}

    # 批改每道答案
    total = 0
    for answer in attempt.answers:
        qv = qv_map.get(answer.question_version_id)
        max_score = score_map.get(answer.question_version_id, 1)
        if qv:
            s = _score_answer(qv.question_type, qv.answer_json, answer.answer_json, max_score)
        else:
            s = 0
        answer.score = s
        total += s

    # AI grading for ai_graded questions
    from app.services.ai_client import grade_answer as ai_grade
    paper_scores: dict[str, int] = {str(item.question_version_id): item.score for item in paper.items}
    for ans in attempt.answers:
        qv = qv_map.get(ans.question_version_id)
        if qv and qv.question_type == "ai_graded":
            student_text = (ans.answer_json or {}).get("value", "")
            if student_text:
                criteria = (qv.answer_json or {}).get("scoring_criteria", "")
                ref_answer = (qv.answer_json or {}).get("reference_answer", "")
                max_s = paper_scores.get(str(ans.question_version_id), 10)
                ai_result = await ai_grade(
                    stem=qv.stem,
                    scoring_criteria=criteria,
                    reference_answer=ref_answer,
                    student_answer=str(student_text),
                    max_score=max_s,
                )
                ans.score = ai_result["score"]
                ans.answer_json = {**(ans.answer_json or {}), "ai_comment": ai_result["comment"]}
                total += ai_result["score"]

    attempt.total_score = total
    attempt.pass_result = total >= exam.pass_score
    attempt.status = "graded"


# ── 试卷 ──────────────────────────────────────────────────────────────────────

@router.post("/papers", response_model=dict, summary="创建试卷")
async def create_paper(
    title: str = Body(...),
    paper_type: str = Body("fixed"),
    question_version_ids: list[uuid.UUID] = Body(...),
    scores: list[int] = Body(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    paper = ExamPaper(title=title, paper_type=paper_type)
    db.add(paper)
    await db.flush()
    for i, qvid in enumerate(question_version_ids):
        score = (scores[i] if scores and i < len(scores) else 1)
        db.add(ExamPaperItem(paper_id=paper.id, question_version_id=qvid, score=score, sort_order=i))
    await db.commit()
    await db.refresh(paper)
    return success_response(data={"id": str(paper.id), "title": paper.title})


@router.get("/papers", response_model=dict, summary="试卷列表")
async def list_papers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count()).select_from(ExamPaper))).scalar_one()
    q = select(ExamPaper).order_by(ExamPaper.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = list((await db.execute(q)).scalars())
    return paginated_response(
        items=[{"id": str(r.id), "title": r.title, "paper_type": r.paper_type,
                "created_at": r.created_at.isoformat()} for r in rows],
        total=total, page=page, page_size=page_size,
    )


# ── 考试 CRUD ──────────────────────────────────────────────────────────────────

@router.get("", response_model=dict, summary="考试列表")
async def list_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Exam)
    if status:
        q = q.where(Exam.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.order_by(Exam.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = list((await db.execute(q)).scalars().all())
    return paginated_response(
        items=[{"id": str(r.id), "title": r.title, "exam_mode": r.exam_mode,
                "duration_minutes": r.duration_minutes, "total_score": r.total_score,
                "pass_score": r.pass_score, "status": r.status,
                "paper_id": str(r.paper_id) if r.paper_id else None,
                "start_at": r.start_at.isoformat() if r.start_at else None,
                "end_at": r.end_at.isoformat() if r.end_at else None} for r in rows],
        total=total, page=page, page_size=page_size,
    )


@router.post("", response_model=dict, summary="创建考试")
async def create_exam(
    title: str = Body(...),
    description: str | None = Body(None),
    exam_mode: str = Body("timed"),
    duration_minutes: int = Body(60),
    total_score: int = Body(100),
    pass_score: int = Body(60),
    paper_id: uuid.UUID | None = Body(None),
    start_at: datetime | None = Body(None),
    end_at: datetime | None = Body(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    exam = Exam(title=title, description=description, exam_mode=exam_mode,
                duration_minutes=duration_minutes, total_score=total_score,
                pass_score=pass_score, paper_id=paper_id, start_at=start_at, end_at=end_at)
    db.add(exam)
    await db.commit()
    await db.refresh(exam)
    return success_response(data={"id": str(exam.id), "title": exam.title, "status": exam.status})


@router.get("/my", response_model=dict, summary="我的可参加考试列表")
async def my_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """返回已发布的考试，及当前用户的答题状态。"""
    q = select(Exam).where(Exam.status == "published")
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.order_by(Exam.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    exams = list((await db.execute(q)).scalars())

    uid = uuid.UUID(user_id)
    items = []
    for exam in exams:
        attempt_result = await db.execute(
            select(ExamAttempt)
            .where(ExamAttempt.exam_id == exam.id, ExamAttempt.user_id == uid)
            .order_by(ExamAttempt.started_at.desc())
            .limit(1)
        )
        attempt = attempt_result.scalar_one_or_none()
        items.append({
            "id": str(exam.id),
            "title": exam.title,
            "description": exam.description,
            "duration_minutes": exam.duration_minutes,
            "total_score": exam.total_score,
            "pass_score": exam.pass_score,
            "exam_mode": exam.exam_mode,
            "start_at": exam.start_at.isoformat() if exam.start_at else None,
            "end_at": exam.end_at.isoformat() if exam.end_at else None,
            "my_attempt": {
                "attempt_id": str(attempt.id),
                "status": attempt.status,
                "total_score": attempt.total_score,
                "pass_result": attempt.pass_result,
                "started_at": attempt.started_at.isoformat(),
            } if attempt else None,
        })
    return paginated_response(items=items, total=total, page=page, page_size=page_size)


@router.get("/all-attempts", response_model=dict, summary="管理员：所有考试记录")
async def list_all_attempts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    exam_id: uuid.UUID | None = Query(None),
    pass_result: bool | None = Query(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User

    q = select(ExamAttempt).where(ExamAttempt.status.in_(["submitted", "graded"]))
    if exam_id:
        q = q.where(ExamAttempt.exam_id == exam_id)
    if pass_result is not None:
        q = q.where(ExamAttempt.pass_result == pass_result)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.order_by(ExamAttempt.submitted_at.desc()).offset((page - 1) * page_size).limit(page_size)
    attempts = (await db.execute(q)).scalars().all()

    items = []
    for a in attempts:
        user = (await db.execute(select(User).where(User.id == a.user_id))).scalar_one_or_none()
        exam = (await db.execute(select(Exam).where(Exam.id == a.exam_id))).scalar_one_or_none()
        items.append({
            "id": str(a.id),
            "exam_id": str(a.exam_id),
            "exam_title": exam.title if exam else "",
            "user_id": str(a.user_id),
            "username": user.username if user else "",
            "real_name": user.real_name if user else "",
            "total_score": a.total_score,
            "pass_result": a.pass_result,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        })
    return paginated_response(items=items, total=total, page=page, page_size=page_size)


@router.get("/{exam_id}", response_model=dict, summary="考试详情")
async def get_exam(
    exam_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise NotFoundException(code="EXAM_NOT_FOUND", message="考试不存在")
    return success_response(data={
        "id": str(exam.id), "title": exam.title, "description": exam.description,
        "exam_mode": exam.exam_mode, "duration_minutes": exam.duration_minutes,
        "total_score": exam.total_score, "pass_score": exam.pass_score,
        "status": exam.status, "paper_id": str(exam.paper_id) if exam.paper_id else None,
        "start_at": exam.start_at.isoformat() if exam.start_at else None,
        "end_at": exam.end_at.isoformat() if exam.end_at else None,
        "created_at": exam.created_at.isoformat(),
    })


@router.put("/{exam_id}", response_model=dict, summary="更新考试信息")
async def update_exam(
    exam_id: uuid.UUID,
    title: str | None = Body(None),
    description: str | None = Body(None),
    duration_minutes: int | None = Body(None),
    total_score: int | None = Body(None),
    pass_score: int | None = Body(None),
    paper_id: uuid.UUID | None = Body(None),
    start_at: datetime | None = Body(None),
    end_at: datetime | None = Body(None),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise NotFoundException(code="EXAM_NOT_FOUND", message="考试不存在")
    if exam.status == "published":
        raise BusinessException(code="EXAM_PUBLISHED", message="已发布的考试不可修改，请先下线")
    if title is not None: exam.title = title
    if description is not None: exam.description = description
    if duration_minutes is not None: exam.duration_minutes = duration_minutes
    if total_score is not None: exam.total_score = total_score
    if pass_score is not None: exam.pass_score = pass_score
    if paper_id is not None: exam.paper_id = paper_id
    if start_at is not None: exam.start_at = start_at
    if end_at is not None: exam.end_at = end_at
    await db.commit()
    return success_response(data={"id": str(exam.id), "title": exam.title, "status": exam.status})


@router.patch("/{exam_id}/paper", response_model=dict, summary="为考试关联/更换试卷（已发布也可操作）")
async def assign_exam_paper(
    exam_id: uuid.UUID,
    paper_id: uuid.UUID = Body(..., embed=True),
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise NotFoundException(code="EXAM_NOT_FOUND", message="考试不存在")
    exam.paper_id = paper_id
    await db.commit()
    return success_response(data={"id": str(exam.id), "paper_id": str(exam.paper_id)})


@router.delete("/{exam_id}", response_model=dict, summary="删除考试")
async def delete_exam(
    exam_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise NotFoundException(code="EXAM_NOT_FOUND", message="考试不存在")
    if exam.status == "published":
        raise BusinessException(code="EXAM_PUBLISHED", message="已发布的考试不可删除，请先下线")
    # check for submitted attempts
    attempt_count = (await db.execute(
        select(func.count()).select_from(ExamAttempt)
        .where(ExamAttempt.exam_id == exam_id, ExamAttempt.status == "submitted")
    )).scalar_one()
    if attempt_count > 0:
        raise BusinessException(code="EXAM_HAS_ATTEMPTS", message=f"该考试已有 {attempt_count} 份提交，无法删除")
    # delete ongoing attempts first
    from sqlalchemy import delete as sql_delete
    await db.execute(sql_delete(ExamAttempt).where(ExamAttempt.exam_id == exam_id))
    await db.delete(exam)
    await db.commit()
    return success_response(message="考试已删除")


@router.post("/{exam_id}/publish", response_model=dict, summary="发布考试")
async def publish_exam(
    exam_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise NotFoundException(code="EXAM_NOT_FOUND", message="考试不存在")
    if exam.status != "draft":
        raise BusinessException(code="EXAM_NOT_DRAFT", message="只有草稿状态可发布")
    exam.status = "published"
    await db.commit()
    return success_response(data={"id": str(exam.id), "status": exam.status})


@router.get("/{exam_id}/paper", response_model=dict, summary="获取考试题目（学员用，不含答案）")
async def get_exam_paper(
    exam_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """返回考试的试卷题目，供答题页展示。题目正确答案不返回。"""
    exam_result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = exam_result.scalar_one_or_none()
    if not exam:
        raise NotFoundException(code="EXAM_NOT_FOUND", message="考试不存在")
    if not exam.paper_id:
        raise BusinessException(code="NO_PAPER", message="该考试尚未关联试卷")

    paper_result = await db.execute(
        select(ExamPaper).options(selectinload(ExamPaper.items)).where(ExamPaper.id == exam.paper_id)
    )
    paper = paper_result.scalar_one_or_none()
    if not paper:
        raise NotFoundException(code="PAPER_NOT_FOUND", message="试卷不存在")

    qv_ids = [item.question_version_id for item in paper.items]
    qv_result = await db.execute(select(QuestionVersion).where(QuestionVersion.id.in_(qv_ids)))
    qv_map = {qv.id: qv for qv in qv_result.scalars()}

    questions = []
    for item in paper.items:
        qv = qv_map.get(item.question_version_id)
        if not qv:
            continue
        questions.append({
            "question_version_id": str(item.question_version_id),
            "sort_order": item.sort_order,
            "score": item.score,
            "question_type": qv.question_type,
            "stem": qv.stem,
            "options": qv.options,
            "difficulty_level": qv.difficulty_level,
            # 不返回 answer_json / analysis
        })

    return success_response(data={
        "exam_id": str(exam_id),
        "title": exam.title,
        "duration_minutes": exam.duration_minutes,
        "total_score": exam.total_score,
        "pass_score": exam.pass_score,
        "questions": sorted(questions, key=lambda x: x["sort_order"]),
    })


# ── 学员考试参与 ───────────────────────────────────────────────────────────────

@router.post("/{exam_id}/start", response_model=dict, summary="开始考试")
async def start_exam(
    exam_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise NotFoundException(code="EXAM_NOT_FOUND", message="考试不存在")
    if exam.status != "published":
        raise BusinessException(code="EXAM_NOT_PUBLISHED", message="考试未发布")
    if not exam.paper_id:
        raise BusinessException(code="EXAM_NO_PAPER", message="该考试尚未关联试卷，请先在考试管理中为其关联试卷")

    # 若已有进行中的答题，直接返回
    uid = uuid.UUID(user_id)
    existing = await db.execute(
        select(ExamAttempt).where(
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.user_id == uid,
            ExamAttempt.status == "ongoing",
        )
    )
    ongoing = existing.scalar_one_or_none()
    if ongoing:
        return success_response(data={"attempt_id": str(ongoing.id), "started_at": ongoing.started_at.isoformat(), "resumed": True})

    attempt = ExamAttempt(exam_id=exam_id, user_id=uid)
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return success_response(data={"attempt_id": str(attempt.id), "started_at": attempt.started_at.isoformat(), "resumed": False})


@router.post("/attempts/{attempt_id}/answers", response_model=dict, summary="保存单题答案（自动保存）")
async def save_answer(
    attempt_id: uuid.UUID,
    question_version_id: uuid.UUID = Body(...),
    answer_json: dict = Body(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """保存或更新单道题的答案（答题过程中自动保存）。"""
    result = await db.execute(select(ExamAttempt).where(ExamAttempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise NotFoundException(code="ATTEMPT_NOT_FOUND", message="答题记录不存在")
    if str(attempt.user_id) != user_id:
        raise BusinessException(code="FORBIDDEN", message="无权操作")
    if attempt.status != "ongoing":
        raise BusinessException(code="ATTEMPT_CLOSED", message="考试已结束")

    # 查找是否已有该题答案
    existing_ans = await db.execute(
        select(ExamAnswer).where(
            ExamAnswer.attempt_id == attempt_id,
            ExamAnswer.question_version_id == question_version_id,
        )
    )
    ans = existing_ans.scalar_one_or_none()
    if ans:
        ans.answer_json = answer_json
    else:
        ans = ExamAnswer(attempt_id=attempt_id, question_version_id=question_version_id, answer_json=answer_json)
        db.add(ans)
    await db.commit()
    return success_response(message="已保存")


@router.post("/attempts/{attempt_id}/submit", response_model=dict, summary="提交答卷（自动阅卷）")
async def submit_answers(
    attempt_id: uuid.UUID,
    answers: list[dict] = Body(default=[], description="最终答案列表 [{question_version_id, answer_json}]"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExamAttempt).options(selectinload(ExamAttempt.answers)).where(ExamAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise NotFoundException(code="ATTEMPT_NOT_FOUND", message="考试记录不存在")
    if str(attempt.user_id) != user_id:
        raise BusinessException(code="FORBIDDEN", message="无权操作此考试记录")
    if attempt.status != "ongoing":
        raise BusinessException(code="ATTEMPT_CLOSED", message="考试已结束")

    # 合并最终答案（覆盖已有的自动保存答案）
    existing_map = {a.question_version_id: a for a in attempt.answers}
    for ans in answers:
        qvid = uuid.UUID(ans["question_version_id"])
        if qvid in existing_map:
            existing_map[qvid].answer_json = ans["answer_json"]
        else:
            ea = ExamAnswer(attempt_id=attempt_id, question_version_id=qvid, answer_json=ans["answer_json"])
            db.add(ea)
            attempt.answers.append(ea)

    attempt.submitted_at = datetime.now(timezone.utc)

    # 刷新以确保所有答案都在 attempt.answers 中
    await db.flush()
    await db.refresh(attempt)

    # 自动阅卷
    await _grade_attempt(attempt, db)
    await db.commit()

    return success_response(data={
        "attempt_id": str(attempt_id),
        "status": attempt.status,
        "total_score": attempt.total_score,
        "pass_result": attempt.pass_result,
    }, message="提交成功，自动评分完成")


@router.get("/attempts/{attempt_id}", response_model=dict, summary="查看答题记录（含评分结果）")
async def get_attempt(
    attempt_id: uuid.UUID,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExamAttempt).options(selectinload(ExamAttempt.answers)).where(ExamAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise NotFoundException(code="ATTEMPT_NOT_FOUND", message="考试记录不存在")

    # 加载题目信息（含正确答案，用于结果页展示）
    qv_ids = [a.question_version_id for a in attempt.answers]
    qv_map: dict[uuid.UUID, QuestionVersion] = {}
    if qv_ids:
        qv_result = await db.execute(select(QuestionVersion).where(QuestionVersion.id.in_(qv_ids)))
        qv_map = {qv.id: qv for qv in qv_result.scalars()}

    return success_response(data={
        "id": str(attempt.id),
        "exam_id": str(attempt.exam_id),
        "user_id": str(attempt.user_id),
        "status": attempt.status,
        "started_at": attempt.started_at.isoformat(),
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "total_score": attempt.total_score,
        "pass_result": attempt.pass_result,
        "answers": [
            {
                "question_version_id": str(a.question_version_id),
                "answer_json": a.answer_json,
                "score": a.score,
                "question_type": qv_map[a.question_version_id].question_type if a.question_version_id in qv_map else None,
                "stem": qv_map[a.question_version_id].stem if a.question_version_id in qv_map else None,
                "options": qv_map[a.question_version_id].options if a.question_version_id in qv_map else None,
                "correct_answer": qv_map[a.question_version_id].answer_json if a.question_version_id in qv_map else None,
                "analysis": qv_map[a.question_version_id].analysis if a.question_version_id in qv_map else None,
            }
            for a in attempt.answers
        ],
    })


@router.get("/attempts/{attempt_id}/result", response_model=dict, summary="考试结果（同 get_attempt）")
async def get_attempt_result(
    attempt_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await get_attempt(attempt_id, user_id, db)


