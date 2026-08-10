"""
ORM models for the DriftMail SQLite database.
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String

from app.db.database import Base


def _now():
    return datetime.now(timezone.utc)


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)
    google_message_id = Column(String, nullable=True, unique=True, index=True)
    subject = Column(String, nullable=False)
    body = Column(String, nullable=False)
    sender = Column(String, nullable=True)          # populated for Gmail source emails
    category = Column(String, nullable=False)
    category_confidence = Column(Float, nullable=False)
    priority = Column(String, nullable=False)
    priority_confidence = Column(Float, nullable=False)
    starred = Column(Boolean, default=False, nullable=False)
    pinned = Column(Boolean, default=False, nullable=False)
    source = Column(String, nullable=False, default="manual")   # "manual" | "gmail"
    received_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class QAHistory(Base):
    __tablename__ = "qa_history"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("emails.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=False)
    grounded = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
