import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ReviewTask(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "review_tasks"

    # course_version / question_version
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)
    content_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    content_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    review_stage: Mapped[str] = mapped_column(String(32), nullable=False)
    # pending / in_review / approved / rejected / returned
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    assigned_reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    comments: Mapped[list["ReviewComment"]] = relationship(
        "ReviewComment", back_populates="review_task", lazy="selectin"
    )


class ReviewComment(UUIDMixin, Base):
    __tablename__ = "review_comments"

    review_task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("review_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    # suggestion / correction / approval
    comment_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # approve / reject / return
    action_suggestion: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )

    review_task: Mapped["ReviewTask"] = relationship("ReviewTask", back_populates="comments")
