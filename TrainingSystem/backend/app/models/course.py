import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Course(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "courses"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    # draft / published / archived
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)

    versions: Mapped[list["CourseVersion"]] = relationship(
        "CourseVersion", back_populates="course", lazy="selectin"
    )


class CourseVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "course_versions"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # manual / ai_generated
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    # draft / pending_review / in_review / published / rejected / archived
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    course: Mapped["Course"] = relationship("Course", back_populates="versions")
    chapters: Mapped[list["CourseChapter"]] = relationship(
        "CourseChapter", back_populates="course_version",
        lazy="selectin", order_by="CourseChapter.chapter_no"
    )


class CourseChapter(UUIDMixin, Base):
    __tablename__ = "course_chapters"

    course_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_versions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    chapter_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )

    course_version: Mapped["CourseVersion"] = relationship(
        "CourseVersion", back_populates="chapters"
    )


class CourseGenerationTask(UUIDMixin, Base):
    __tablename__ = "course_generation_tasks"

    course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # queued / running / succeeded / failed / cancelled
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", index=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )
