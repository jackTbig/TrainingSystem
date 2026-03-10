import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseChapter, CourseGenerationTask, CourseVersion


class CourseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, cid: uuid.UUID) -> Course | None:
        result = await self.db.execute(
            select(Course).options(selectinload(Course.versions)).where(Course.id == cid)
        )
        return result.scalar_one_or_none()

    async def list_courses(self, page: int, page_size: int, owner_id: uuid.UUID | None = None, status: str | None = None):
        q = select(Course)
        if owner_id:
            q = q.where(Course.owner_id == owner_id)
        if status:
            q = q.where(Course.status == status)
        total = (await self.db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
        q = q.order_by(Course.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows), total

    async def create(self, title: str, owner_id: uuid.UUID) -> Course:
        c = Course(title=title, owner_id=owner_id)
        self.db.add(c)
        await self.db.flush()
        return c

    async def update(self, course: Course, **kwargs) -> Course:
        for k, v in kwargs.items():
            setattr(course, k, v)
        await self.db.flush()
        return course


class CourseVersionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, vid: uuid.UUID) -> CourseVersion | None:
        result = await self.db.execute(
            select(CourseVersion)
            .options(selectinload(CourseVersion.chapters))
            .where(CourseVersion.id == vid)
        )
        return result.scalar_one_or_none()

    async def next_version_no(self, course_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.max(CourseVersion.version_no)).where(CourseVersion.course_id == course_id)
        )
        return (result.scalar_one_or_none() or 0) + 1

    async def create(self, course_id: uuid.UUID, title: str, summary: str | None, source_type: str, created_by: uuid.UUID | None) -> CourseVersion:
        vno = await self.next_version_no(course_id)
        ver = CourseVersion(course_id=course_id, version_no=vno, title=title, summary=summary, source_type=source_type, created_by=created_by)
        self.db.add(ver)
        await self.db.flush()
        return ver

    async def update(self, ver: CourseVersion, **kwargs) -> CourseVersion:
        for k, v in kwargs.items():
            setattr(ver, k, v)
        await self.db.flush()
        return ver


class CourseChapterRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, chap_id: uuid.UUID) -> CourseChapter | None:
        result = await self.db.execute(select(CourseChapter).where(CourseChapter.id == chap_id))
        return result.scalar_one_or_none()

    async def create(self, course_version_id: uuid.UUID, chapter_no: int, title: str, content: str, estimated_duration_minutes: int | None) -> CourseChapter:
        ch = CourseChapter(course_version_id=course_version_id, chapter_no=chapter_no, title=title, content=content, estimated_duration_minutes=estimated_duration_minutes)
        self.db.add(ch)
        await self.db.flush()
        return ch

    async def update(self, ch: CourseChapter, **kwargs) -> CourseChapter:
        for k, v in kwargs.items():
            setattr(ch, k, v)
        await self.db.flush()
        return ch

    async def delete(self, ch: CourseChapter) -> None:
        await self.db.delete(ch)
        await self.db.flush()
