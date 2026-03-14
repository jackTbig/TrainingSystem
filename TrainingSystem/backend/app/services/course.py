import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessException, NotFoundException
from app.repositories.course import CourseChapterRepository, CourseRepository, CourseVersionRepository
from app.schemas.course import (
    CourseChapterCreate, CourseChapterOut, CourseChapterUpdate,
    CourseCreate, CourseListItem, CourseOut, CourseUpdate,
    CourseVersionCreate, CourseVersionOut,
)

VALID_COURSE_STATUSES = {"draft", "published", "archived"}
VALID_VERSION_STATUSES = {"draft", "pending_review", "in_review", "published", "rejected", "archived"}


class CourseService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CourseRepository(db)
        self.ver_repo = CourseVersionRepository(db)
        self.chap_repo = CourseChapterRepository(db)

    # ── Course CRUD ────────────────────────────────────────────────────────────

    async def list_courses(self, page: int, page_size: int, owner_id: uuid.UUID | None = None, status: str | None = None):
        rows, total = await self.repo.list_courses(page, page_size, owner_id, status)
        return [CourseListItem.model_validate(r) for r in rows], total

    async def get_course(self, course_id: uuid.UUID) -> CourseOut:
        course = await self.repo.get_by_id(course_id)
        if not course:
            raise NotFoundException(code="COURSE_NOT_FOUND", message="课程不存在")
        return CourseOut.model_validate(course)

    async def create_course(self, data: CourseCreate, owner_id: uuid.UUID) -> CourseOut:
        course = await self.repo.create(title=data.title, owner_id=owner_id)
        await self.db.commit()
        await self.db.refresh(course)
        return CourseOut.model_validate(course)

    async def update_course(self, course_id: uuid.UUID, data: CourseUpdate) -> CourseOut:
        course = await self.repo.get_by_id(course_id)
        if not course:
            raise NotFoundException(code="COURSE_NOT_FOUND", message="课程不存在")
        updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if "status" in updates and updates["status"] not in VALID_COURSE_STATUSES:
            raise BusinessException(code="INVALID_STATUS", message=f"无效状态：{updates['status']}")
        if updates:
            await self.repo.update(course, **updates)
        await self.db.commit()
        await self.db.refresh(course)
        return CourseOut.model_validate(course)

    # ── Version ────────────────────────────────────────────────────────────────

    async def create_version(self, course_id: uuid.UUID, data: CourseVersionCreate, user_id: uuid.UUID) -> CourseVersionOut:
        course = await self.repo.get_by_id(course_id)
        if not course:
            raise NotFoundException(code="COURSE_NOT_FOUND", message="课程不存在")
        ver = await self.ver_repo.create(
            course_id=course_id, title=data.title, summary=data.summary,
            source_type=data.source_type, created_by=user_id,
        )
        await self.repo.update(course, current_version_id=ver.id)
        await self.db.commit()
        await self.db.refresh(ver)
        return CourseVersionOut.model_validate(ver)

    async def get_version(self, version_id: uuid.UUID) -> CourseVersionOut:
        ver = await self.ver_repo.get_by_id(version_id)
        if not ver:
            raise NotFoundException(code="VERSION_NOT_FOUND", message="课程版本不存在")
        return CourseVersionOut.model_validate(ver)

    async def update_version_status(self, version_id: uuid.UUID, status: str) -> CourseVersionOut:
        if status not in VALID_VERSION_STATUSES:
            raise BusinessException(code="INVALID_STATUS", message=f"无效状态：{status}")
        ver = await self.ver_repo.get_by_id(version_id)
        if not ver:
            raise NotFoundException(code="VERSION_NOT_FOUND", message="课程版本不存在")
        updates: dict = {"status": status}
        if status == "published":
            from datetime import datetime, timezone
            updates["published_at"] = datetime.now(timezone.utc)
        await self.ver_repo.update(ver, **updates)
        # 提交审核时，若尚无待审核任务则自动创建
        if status == "pending_review":
            from sqlalchemy import select
            from app.models.review import ReviewTask
            existing = (await self.db.execute(
                select(ReviewTask).where(
                    ReviewTask.content_type == "course_version",
                    ReviewTask.content_version_id == version_id,
                    ReviewTask.status.in_(["pending", "in_review"]),
                )
            )).scalar_one_or_none()
            if not existing:
                rt = ReviewTask(
                    content_type="course_version",
                    content_id=ver.course_id,
                    content_version_id=version_id,
                    review_stage="initial",
                )
                self.db.add(rt)
        await self.db.commit()
        return CourseVersionOut.model_validate(ver)

    # ── Chapter ────────────────────────────────────────────────────────────────

    async def add_chapter(self, version_id: uuid.UUID, data: CourseChapterCreate) -> CourseChapterOut:
        ver = await self.ver_repo.get_by_id(version_id)
        if not ver:
            raise NotFoundException(code="VERSION_NOT_FOUND", message="课程版本不存在")
        if ver.status not in ("draft", "rejected"):
            raise BusinessException(code="VERSION_LOCKED", message="当前版本状态不允许修改章节")
        ch = await self.chap_repo.create(
            course_version_id=version_id,
            chapter_no=data.chapter_no,
            title=data.title,
            content=data.content,
            estimated_duration_minutes=data.estimated_duration_minutes,
        )
        await self.db.commit()
        await self.db.refresh(ch)
        return CourseChapterOut.model_validate(ch)

    async def update_chapter(self, chapter_id: uuid.UUID, data: CourseChapterUpdate) -> CourseChapterOut:
        ch = await self.chap_repo.get_by_id(chapter_id)
        if not ch:
            raise NotFoundException(code="CHAPTER_NOT_FOUND", message="章节不存在")
        updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if updates:
            await self.chap_repo.update(ch, **updates)
        await self.db.commit()
        await self.db.refresh(ch)
        return CourseChapterOut.model_validate(ch)

    async def delete_chapter(self, chapter_id: uuid.UUID) -> None:
        ch = await self.chap_repo.get_by_id(chapter_id)
        if not ch:
            raise NotFoundException(code="CHAPTER_NOT_FOUND", message="章节不存在")
        await self.chap_repo.delete(ch)
        await self.db.commit()
