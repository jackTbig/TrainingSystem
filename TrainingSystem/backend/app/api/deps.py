from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthException
from app.core.security import decode_access_token
from app.db.session import get_db


async def get_current_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise AuthException(code="AUTH_INVALID_TOKEN", message="无效的认证令牌")
    token = authorization.removeprefix("Bearer ")
    payload = decode_access_token(token)
    if not payload:
        raise AuthException(code="AUTH_TOKEN_EXPIRED", message="令牌已过期或无效")
    return payload["sub"]


# 便捷依赖：同时获取 db session 和当前用户 ID
async def get_db_and_user(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return db, user_id
