import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Question(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "questions"

    current_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # draft / published / archived
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)

    versions: Mapped[list["QuestionVersion"]] = relationship(
        "QuestionVersion", back_populates="question", lazy="selectin"
    )


class QuestionVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "question_versions"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    # draft / pending_review / in_review / published / rejected / archived
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    # single_choice / multi_choice / true_false / fill_blank / short_answer
    question_type: Mapped[str] = mapped_column(String(32), nullable=False)
    stem: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    answer_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    analysis: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty_level: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    question: Mapped["Question"] = relationship("Question", back_populates="versions")


class QuestionGenerationTask(UUIDMixin, Base):
    __tablename__ = "question_generation_tasks"

    # queued / running / succeeded / failed / cancelled
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", index=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )
