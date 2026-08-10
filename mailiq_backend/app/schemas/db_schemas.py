"""
Pydantic schemas for the /emails endpoints.
Kept separate from email_schema.py (which serves the inference/gmail routes).
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Request bodies ──────────────────────────────────────────────────────────

class EmailCreate(BaseModel):
    subject: str = Field(..., min_length=1, description="Email subject line")
    body: str = Field(..., min_length=1, description="Plain-text email body")


class PatchEmail(BaseModel):
    starred: Optional[bool] = None
    pinned: Optional[bool] = None


class QARequest(BaseModel):
    question: str = Field(..., min_length=1)


# ── Response models ──────────────────────────────────────────────────────────

class EmailOut(BaseModel):
    id: int
    google_message_id: Optional[str] = None
    subject: str
    body: str
    sender: Optional[str] = None
    category: str
    category_confidence: float
    priority: str
    priority_confidence: float
    starred: bool
    pinned: bool
    source: str
    received_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class QAResponse(BaseModel):
    answer: str
    grounded: bool


class QAHistoryItem(BaseModel):
    id: int
    email_id: int
    question: str
    answer: str
    grounded: bool
    created_at: datetime

    model_config = {"from_attributes": True}
