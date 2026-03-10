"""创建初始管理员账号和基础角色/权限"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.db.session import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, Role, Permission, RolePermission, UserRole


ADMIN_PERMISSIONS = [
    ("user:read",   "查看用户",     "user",       "read"),
    ("user:write",  "管理用户",     "user",       "write"),
    ("role:read",   "查看角色",     "role",       "read"),
    ("role:write",  "管理角色",     "role",       "write"),
    ("dept:read",   "查看部门",     "dept",       "read"),
    ("dept:write",  "管理部门",     "dept",       "write"),
    ("doc:read",    "查看文档",     "document",   "read"),
    ("doc:write",   "上传文档",     "document",   "write"),
    ("course:read", "查看课程",     "course",     "read"),
    ("course:write","管理课程",     "course",     "write"),
    ("exam:read",   "查看考试",     "exam",       "read"),
    ("exam:write",  "管理考试",     "exam",       "write"),
    ("exam:take",   "参加考试",     "exam",       "take"),
    ("audit:read",  "查看审计日志", "audit",      "read"),
]


async def main():
    async with AsyncSessionLocal() as db:
        # 创建权限
        perms = {}
        for code, name, resource_type, action in ADMIN_PERMISSIONS:
            from sqlalchemy import select
            result = await db.execute(select(Permission).where(Permission.code == code))
            perm = result.scalar_one_or_none()
            if not perm:
                perm = Permission(code=code, name=name, resource_type=resource_type, action=action)
                db.add(perm)
            perms[code] = perm
        await db.flush()

        # 创建管理员角色
        from sqlalchemy import select
        result = await db.execute(select(Role).where(Role.code == "admin"))
        admin_role = result.scalar_one_or_none()
        if not admin_role:
            admin_role = Role(code="admin", name="系统管理员", description="拥有所有权限")
            db.add(admin_role)
            await db.flush()
            for perm in perms.values():
                db.add(RolePermission(role_id=admin_role.id, permission_id=perm.id))

        # 创建学员角色
        result = await db.execute(select(Role).where(Role.code == "learner"))
        learner_role = result.scalar_one_or_none()
        if not learner_role:
            learner_role = Role(code="learner", name="学员", description="普通学员")
            db.add(learner_role)
            await db.flush()
            for code in ("doc:read", "course:read", "exam:read", "exam:take"):
                db.add(RolePermission(role_id=learner_role.id, permission_id=perms[code].id))

        # 创建管理员用户
        result = await db.execute(select(User).where(User.username == "admin"))
        admin_user = result.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                username="admin",
                password_hash=hash_password("Admin@123"),
                real_name="系统管理员",
                email="admin@training.local",
                status="active",
            )
            db.add(admin_user)
            await db.flush()
            db.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))
            print(f"[OK] 管理员账号创建成功: admin / Admin@123")
        else:
            print("[SKIP] 管理员账号已存在")

        await db.commit()
        print("[OK] 初始化数据写入完成")


if __name__ == "__main__":
    asyncio.run(main())
