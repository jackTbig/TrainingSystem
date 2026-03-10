import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class TrainingTask(UUIDMixin, Base):
    __tablename__ = "training_tasks"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    course_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("course_versions.id"), nullable=True
    )
    exam_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # draft / published / in_progress / completed / archived
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    allow_makeup_exam: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    makeup_exam_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notify_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )

    assignments: Mapped[list["TrainingAssignment"]] = relationship(
        "TrainingAssignment", back_populates="task", lazy="noload"
    )


class TrainingAssignment(UUIDMixin, Base):
    __tablename__ = "training_assignments"

    training_task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("training_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    # assigned / study_completed / exam_completed / overdue
    assignment_status: Mapped[str] = mapped_column(String(32), nullable=False, default="assigned")
    study_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exam_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )

    task: Mapped["TrainingTask"] = relationship("TrainingTask", back_populates="assignments")


class StudyProgress(UUIDMixin, Base):
    __tablename__ = "study_progress"

    training_assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("training_assignments.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_position: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )
