import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, Role, Permission, Department, DepartmentMembership


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def list_users(self, page: int, page_size: int, status: str | None = None):
        q = select(User).options(selectinload(User.roles))
        if status:
            q = q.where(User.status == status)
        total_result = await self.db.execute(
            select(func.count()).select_from(q.subquery())
        )
        total = total_result.scalar_one()
        q = q.offset((page - 1) * page_size).limit(page_size).order_by(User.created_at.desc())
        result = await self.db.execute(q)
        return result.scalars().all(), total

    async def create(
        self,
        username: str,
        password_hash: str,
        real_name: str,
        email: str | None = None,
        phone: str | None = None,
        roles: list[Role] | None = None,
    ) -> User:
        user = User(
            username=username,
            password_hash=password_hash,
            real_name=real_name,
            email=email,
            phone=phone,
        )
        if roles:
            user.roles = roles
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, **kwargs) -> User:
        for key, value in kwargs.items():
            if key == "roles":
                user.roles = value
            else:
                setattr(user, key, value)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update_last_login(self, user: User) -> None:
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def delete(self, user: User) -> None:
        await self.db.delete(user)
        await self.db.flush()


class RoleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, role_id: uuid.UUID) -> Role | None:
        result = await self.db.execute(
            select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Role | None:
        result = await self.db.execute(select(Role).where(Role.code == code))
        return result.scalar_one_or_none()

    async def get_by_ids(self, ids: list[uuid.UUID]) -> list[Role]:
        result = await self.db.execute(select(Role).where(Role.id.in_(ids)))
        return list(result.scalars().all())

    async def list_all(self) -> list[Role]:
        result = await self.db.execute(
            select(Role).options(selectinload(Role.permissions)).order_by(Role.code)
        )
        return list(result.scalars().all())

    async def create(
        self,
        code: str,
        name: str,
        description: str | None = None,
        permissions: list[Permission] | None = None,
    ) -> Role:
        role = Role(code=code, name=name, description=description)
        if permissions:
            role.permissions = permissions
        self.db.add(role)
        await self.db.flush()
        await self.db.refresh(role)
        return role

    async def update(self, role: Role, **kwargs) -> Role:
        for key, value in kwargs.items():
            if key == "permissions":
                role.permissions = value
            else:
                setattr(role, key, value)
        await self.db.flush()
        await self.db.refresh(role)
        return role

    async def delete(self, role: Role) -> None:
        await self.db.delete(role)
        await self.db.flush()


class PermissionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_ids(self, ids: list[uuid.UUID]) -> list[Permission]:
        result = await self.db.execute(select(Permission).where(Permission.id.in_(ids)))
        return list(result.scalars().all())

    async def list_all(self) -> list[Permission]:
        result = await self.db.execute(select(Permission).order_by(Permission.code))
        return list(result.scalars().all())


class DepartmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, dept_id: uuid.UUID) -> Department | None:
        result = await self.db.execute(
            select(Department).where(Department.id == dept_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self, status: str | None = None) -> list[Department]:
        q = select(Department).order_by(Department.name)
        if status:
            q = q.where(Department.status == status)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create(self, name: str, parent_id: uuid.UUID | None = None) -> Department:
        dept = Department(name=name, parent_id=parent_id)
        self.db.add(dept)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def update(self, dept: Department, **kwargs) -> Department:
        for key, value in kwargs.items():
            setattr(dept, key, value)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def delete(self, dept: Department) -> None:
        await self.db.delete(dept)
        await self.db.flush()
