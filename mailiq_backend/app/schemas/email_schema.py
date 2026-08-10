from typing import Optional

from pydantic import BaseModel, Field


class EmailInput(BaseModel):
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Plain-text email body")


class EmailPrediction(BaseModel):
    category: str
    category_confidence: float
    priority: str
    priority_confidence: float
    context_note: Optional[str] = Field(
        default=None,
        description="RAG-retrieved note, only present for college/oportunities/finance",
    )


class InboxEmailPrediction(EmailPrediction):
    id: str
    sender: str
    date: Optional[str] = None
    snippet: str
