from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.courses import router as courses_router
from app.api.v1.departments import router as departments_router
from app.api.v1.documents import router as documents_router
from app.api.v1.exams import router as exams_router
from app.api.v1.knowledge import router as knowledge_router
from app.api.v1.questions import router as questions_router
from app.api.v1.reviews import router as reviews_router
from app.api.v1.roles import router as roles_router
from app.api.v1.system import router as system_router
from app.api.v1.training import router as training_router
from app.api.v1.users import router as users_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["首页统计"])
api_router.include_router(users_router, prefix="/users", tags=["用户管理"])
api_router.include_router(roles_router, prefix="/roles", tags=["角色权限"])
api_router.include_router(departments_router, prefix="/departments", tags=["部门管理"])
api_router.include_router(documents_router, prefix="/documents", tags=["文档管理"])
api_router.include_router(knowledge_router, prefix="/knowledge-points", tags=["知识点管理"])
api_router.include_router(courses_router, prefix="/courses", tags=["课程管理"])
api_router.include_router(questions_router, prefix="/questions", tags=["题库管理"])
api_router.include_router(reviews_router, prefix="/reviews", tags=["审核管理"])
api_router.include_router(exams_router, prefix="/exams", tags=["考试管理"])
api_router.include_router(training_router, prefix="/training-tasks", tags=["培训任务"])
api_router.include_router(system_router, prefix="/system", tags=["系统管理"])
