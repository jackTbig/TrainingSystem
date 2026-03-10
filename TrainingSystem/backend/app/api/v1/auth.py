from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db
from app.core.response import success_response
from app.schemas.user import LoginRequest, TokenResponse, UserOut
from app.services.auth import AuthService

router = APIRouter()


@router.post("/login", response_model=dict, summary="用户登录")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    token = await svc.login(req)
    return success_response(data=token.model_dump())


@router.get("/me", response_model=dict, summary="获取当前用户信息")
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AuthService(db)
    user = await svc.get_current_user(user_id)
    return success_response(data=user.model_dump())
