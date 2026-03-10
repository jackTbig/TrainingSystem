import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ExamPaper(UUIDMixin, Base):
    __tablename__ = "exam_papers"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # fixed / random
    paper_type: Mapped[str] = mapped_column(String(32), nullable=False, default="fixed")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )
    items: Mapped[list["ExamPaperItem"]] = relationship(
        "ExamPaperItem", back_populates="paper", lazy="selectin", order_by="ExamPaperItem.sort_order"
    )


class ExamPaperItem(UUIDMixin, Base):
    __tablename__ = "exam_paper_items"

    paper_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_papers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("question_versions.id"), nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    paper: Mapped["ExamPaper"] = relationship("ExamPaper", back_populates="items")


class Exam(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "exams"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # timed / unlimited
    exam_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="timed")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    pass_score: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    paper_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_papers.id"), nullable=True
    )
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # draft / published / archived
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)

    attempts: Mapped[list["ExamAttempt"]] = relationship(
        "ExamAttempt", back_populates="exam", lazy="noload"
    )


class ExamAttempt(UUIDMixin, Base):
    __tablename__ = "exam_attempts"

    exam_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    # ongoing / submitted / graded / expired
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ongoing", index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pass_result: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    )

    exam: Mapped["Exam"] = relationship("Exam", back_populates="attempts")
    answers: Mapped[list["ExamAnswer"]] = relationship(
        "ExamAnswer", back_populates="attempt", lazy="selectin"
    )


class ExamAnswer(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "exam_answers"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("question_versions.id"), nullable=False
    )
    answer_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    attempt: Mapped["ExamAttempt"] = relationship("ExamAttempt", back_populates="answers")
