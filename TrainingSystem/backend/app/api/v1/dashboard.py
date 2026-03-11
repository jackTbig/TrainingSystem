import uuid
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
from app.models.training import TrainingTask, TrainingAssignment
from app.models.user import User, UserRole, Role

router = APIRouter()


@router.get("", response_model=dict, summary="首页统计数据")
async def get_dashboard(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    uid = uuid.UUID(user_id)

    async def count(model, *filters):
        q = select(func.count()).select_from(model)
        for f in filters:
            q = q.where(f)
        return (await db.execute(q)).scalar_one()

    # Check if current user has admin role
    is_admin_row = await db.execute(
        select(func.count()).select_from(UserRole).join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_id == uid, Role.code == "admin")
    )
    is_admin = is_admin_row.scalar_one() > 0

    if is_admin:
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
    else:
        # Regular user: only show their own data
        my_assignments = await count(TrainingAssignment, TrainingAssignment.user_id == uid)
        my_attempts = await count(ExamAttempt, ExamAttempt.user_id == uid)
        # Distinct exams attempted
        my_exams_row = await db.execute(
            select(func.count(func.distinct(ExamAttempt.exam_id)))
            .where(ExamAttempt.user_id == uid)
        )
        my_exams = my_exams_row.scalar_one()
        # Distinct tasks assigned
        my_tasks_row = await db.execute(
            select(func.count(func.distinct(TrainingAssignment.task_id)))
            .where(TrainingAssignment.user_id == uid)
        )
        my_tasks = my_tasks_row.scalar_one()
        my_tasks_active_row = await db.execute(
            select(func.count(func.distinct(TrainingAssignment.task_id)))
            .join(TrainingTask, TrainingTask.id == TrainingAssignment.task_id)
            .where(
                TrainingAssignment.user_id == uid,
                TrainingTask.status.in_(["published", "in_progress"]),
            )
        )
        my_tasks_active = my_tasks_active_row.scalar_one()

        stats = {
            "users": 0,
            "documents": {"total": 0, "parsed": 0, "uploading": 0},
            "knowledge_points": {"total": 0, "candidates_pending": 0},
            "courses": {"total": 0, "published": 0},
            "questions": {"total": 0, "published": 0},
            "exams": {
                "total": my_exams,
                "published": my_exams,
                "attempts": my_attempts,
            },
            "training_tasks": {
                "total": my_tasks,
                "in_progress": my_tasks_active,
            },
        }

    return success_response(data=stats)
