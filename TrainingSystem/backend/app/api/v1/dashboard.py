from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import success_response
from app.models.course import Course
from app.models.document import Document
from app.models.exam import Exam, ExamAttempt
from app.models.knowledge import KnowledgePoint, KnowledgePointCandidate
from app.models.question import Question
from app.models.training import TrainingTask
from app.models.user import User

router = APIRouter()


@router.get("", response_model=dict, summary="首页统计数据")
async def get_dashboard(
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    async def count(model, *filters):
        q = select(func.count()).select_from(model)
        for f in filters:
            q = q.where(f)
        return (await db.execute(q)).scalar_one()

    stats = {
        "users": await count(User, User.status == "active"),
        "documents": {
            "total": await count(Document),
            "parsed": await count(Document, Document.status == "parsed"),
            "uploading": await count(Document, Document.status == "uploaded"),
        },
        "knowledge_points": {
            "total": await count(KnowledgePoint, KnowledgePoint.status == "active"),
            "candidates_pending": await count(KnowledgePointCandidate, KnowledgePointCandidate.status == "pending"),
        },
        "courses": {
            "total": await count(Course),
            "published": await count(Course, Course.status == "published"),
        },
        "questions": {
            "total": await count(Question),
            "published": await count(Question, Question.status == "published"),
        },
        "exams": {
            "total": await count(Exam),
            "published": await count(Exam, Exam.status == "published"),
            "attempts": await count(ExamAttempt),
        },
        "training_tasks": {
            "total": await count(TrainingTask),
            "in_progress": await count(TrainingTask, TrainingTask.status.in_(["published", "in_progress"])),
        },
    }
    return success_response(data=stats)
