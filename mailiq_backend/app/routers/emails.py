"""
/emails — CRUD endpoints for stored emails + RAG Q&A.

POST   /emails                  — manually classify & persist an email
GET    /emails                  — list with filters (category, priority, starred, pinned, search)
GET    /emails/{id}             — full detail row
PATCH  /emails/{id}             — toggle starred / pinned
POST   /emails/{id}/ask         — RAG "ask about this email"
GET    /emails/{id}/qa-history  — prior Q&A pairs for this email
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Email, QAHistory
from app.schemas.db_schemas import (
    EmailCreate,
    EmailOut,
    PatchEmail,
    QAHistoryItem,
    QARequest,
    QAResponse,
)
from app.services.model_service import classifier
from app.services.rag_service import semantic_rag

router = APIRouter(prefix="/emails", tags=["emails"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _classify_and_build(subject: str, body: str, source: str = "manual",
                        google_message_id: Optional[str] = None,
                        sender: Optional[str] = None,
                        received_at: Optional[datetime] = None) -> Email:
    category, cat_conf, priority, pri_conf = classifier.predict(subject, body)
    now = datetime.now(timezone.utc)
    return Email(
        google_message_id=google_message_id,
        subject=subject,
        body=body,
        sender=sender,
        category=category,
        category_confidence=cat_conf,
        priority=priority,
        priority_confidence=pri_conf,
        source=source,
        received_at=received_at or now,
        created_at=now,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=EmailOut, status_code=201)
def create_email(payload: EmailCreate, db: Session = Depends(get_db)):
    """Manually submit an email — classifies it and saves to DB."""
    email = _classify_and_build(payload.subject, payload.body, source="manual")
    db.add(email)
    db.commit()
    db.refresh(email)
    return email


@router.get("", response_model=List[EmailOut])
def list_emails(
    category: Optional[List[str]] = Query(default=None),
    priority: Optional[List[str]] = Query(default=None),
    starred: Optional[bool] = Query(default=None),
    pinned: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """List emails newest-first. All filters are optional and combinable."""
    q = db.query(Email)

    if category:
        q = q.filter(Email.category.in_(category))
    if priority:
        q = q.filter(Email.priority.in_(priority))
    if starred is not None:
        q = q.filter(Email.starred == starred)
    if pinned is not None:
        q = q.filter(Email.pinned == pinned)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (Email.subject.ilike(like)) | (Email.body.ilike(like))
        )

    return q.order_by(Email.received_at.desc()).all()


@router.get("/{email_id}", response_model=EmailOut)
def get_email(email_id: int, db: Session = Depends(get_db)):
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return email


@router.patch("/{email_id}", response_model=EmailOut)
def patch_email(email_id: int, payload: PatchEmail, db: Session = Depends(get_db)):
    """Toggle starred and/or pinned state."""
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    if payload.starred is not None:
        email.starred = payload.starred
    if payload.pinned is not None:
        email.pinned = payload.pinned
    db.commit()
    db.refresh(email)
    return email


@router.post("/{email_id}/ask", response_model=QAResponse)
def ask_about_email(email_id: int, payload: QARequest, db: Session = Depends(get_db)):
    """RAG Q&A — answer a question grounded only in the email + KB."""
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    result = semantic_rag.ask(email.subject, email.body, payload.question)

    qa = QAHistory(
        email_id=email_id,
        question=payload.question,
        answer=result["answer"],
        grounded=result["grounded"],
        created_at=datetime.now(timezone.utc),
    )
    db.add(qa)
    db.commit()

    return QAResponse(answer=result["answer"], grounded=result["grounded"])


@router.get("/{email_id}/qa-history", response_model=List[QAHistoryItem])
def qa_history(email_id: int, db: Session = Depends(get_db)):
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return (
        db.query(QAHistory)
        .filter(QAHistory.email_id == email_id)
        .order_by(QAHistory.created_at.asc())
        .all()
    )
