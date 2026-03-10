import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthException, NotFoundException
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user import RoleRepository, UserRepository
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserOut, UserUpdate


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.role_repo = RoleRepository(db)

    async def login(self, req: LoginRequest) -> TokenResponse:
        user = await self.user_repo.get_by_username(req.username)
        if not user or not verify_password(req.password, user.password_hash):
            raise AuthException(code="AUTH_BAD_CREDENTIALS", message="用户名或密码错误")
        if user.status != "active":
            raise AuthException(code="AUTH_USER_DISABLED", message="账号已被禁用")
        await self.user_repo.update_last_login(user)
        await self.db.commit()
        token = create_access_token(subject=str(user.id))
        return TokenResponse(access_token=token)

    async def get_current_user(self, user_id: str) -> UserOut:
        user = await self.user_repo.get_by_id(uuid.UUID(user_id))
        if not user:
            raise NotFoundException(code="USER_NOT_FOUND", message="用户不存在")
        return UserOut.model_validate(user)


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.role_repo = RoleRepository(db)

    async def create_user(self, data: UserCreate) -> UserOut:
        existing = await self.user_repo.get_by_username(data.username)
        if existing:
            from app.core.exceptions import BusinessException
            raise BusinessException(code="USER_EXISTS", message="用户名已存在")
        roles = await self.role_repo.get_by_ids(data.role_ids) if data.role_ids else []
        user = await self.user_repo.create(
            username=data.username,
            password_hash=hash_password(data.password),
            real_name=data.real_name,
            email=data.email,
            phone=data.phone,
            roles=roles,
        )
        await self.db.commit()
        await self.db.refresh(user)
        return UserOut.model_validate(user)

    async def list_users(self, page: int, page_size: int, status: str | None = None):
        users, total = await self.user_repo.list_users(page, page_size, status)
        return [UserOut.model_validate(u) for u in users], total

    async def get_user(self, user_id: uuid.UUID) -> UserOut:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException(code="USER_NOT_FOUND", message="用户不存在")
        return UserOut.model_validate(user)

    async def update_user(self, user_id: uuid.UUID, data: UserUpdate) -> UserOut:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException(code="USER_NOT_FOUND", message="用户不存在")
        updates: dict = {}
        if data.real_name is not None:
            updates["real_name"] = data.real_name
        if data.email is not None:
            updates["email"] = data.email
        if data.phone is not None:
            updates["phone"] = data.phone
        if data.status is not None:
            updates["status"] = data.status
        if data.role_ids is not None:
            updates["roles"] = await self.role_repo.get_by_ids(data.role_ids)
        user = await self.user_repo.update(user, **updates)
        await self.db.commit()
        await self.db.refresh(user)
        return UserOut.model_validate(user)

    async def delete_user(self, user_id: uuid.UUID) -> None:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException(code="USER_NOT_FOUND", message="用户不存在")
        await self.user_repo.delete(user)
        await self.db.commit()

    async def reset_password(self, user_id: uuid.UUID, new_password: str) -> None:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException(code="USER_NOT_FOUND", message="用户不存在")
        await self.user_repo.update(user, password_hash=hash_password(new_password))
        await self.db.commit()
