"""
/emails — CRUD endpoints for stored emails + RAG Q&A.

POST   /emails                  — manually classify & persist an email
POST   /emails/sync             — fetch Gmail inbox, classify, save to DB, return saved emails
GET    /emails                  — list with filters (category, priority, starred, pinned, search)
GET    /emails/{id}             — full detail row
PATCH  /emails/{id}             — toggle starred / pinned
POST   /emails/{id}/ask         — RAG "ask about this email"
GET    /emails/{id}/qa-history  — prior Q&A pairs for this email

Memory notes:
  • sync default batch reduced from 20 → 10 to fit within Render 512 MB.
  • gc.collect() called after sync loop to release tensor memory.
  • Each individual email processing is wrapped to not abort the entire sync.
"""
import gc
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
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
from app.services import gmail_service, token_store
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


@router.post("/sync", response_model=List[EmailOut])
def sync_gmail(
    max_results: int = Query(default=10, ge=1, le=25),  # reduced cap from 50→25, default 20→10
    db: Session = Depends(get_db),
):
    """
    Fetch the latest emails from Gmail, classify each one with the BiGRU model,
    and save them to the local database. Already-stored messages (matched by
    google_message_id) are skipped so re-syncing never creates duplicates.
    Returns the full list of newly-saved emails (may be empty if everything was
    already synced).
    """
    # 1. Validate Gmail connection
    try:
        access_token = token_store.get_valid_access_token()
    except token_store.GmailReconnectRequired:
        raise HTTPException(
            status_code=401,
            detail={
                "error_code": "RECONNECT_REQUIRED",
                "message": "Gmail isn't connected, or the connection expired. "
                           "Go to /auth/google/login to reconnect.",
            },
        )

    # 2. Fetch message IDs from Gmail
    try:
        message_ids = gmail_service.list_recent_message_ids(access_token, max_results)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gmail API error: {exc}") from exc

    saved: List[Email] = []

    try:
        for message_id in message_ids:
            # Skip if already in the database
            existing = db.query(Email).filter(Email.google_message_id == message_id).first()
            if existing:
                continue

            # 3. Fetch the full message
            try:
                msg = gmail_service.get_message(access_token, message_id)
            except Exception:
                # Don't let one bad message abort the entire sync
                continue

            # 4. Parse the received date; fall back to now if unparseable
            received_at = datetime.now(timezone.utc)
            if msg.get("date"):
                try:
                    received_at = parsedate_to_datetime(msg["date"])
                except Exception:
                    pass

            # 5. Classify with the BiGRU model
            subject = msg.get("subject") or "(no subject)"
            body = msg.get("body") or msg.get("snippet") or ""
            try:
                category, cat_conf, priority, pri_conf = classifier.predict(subject, body)
            except Exception:
                category, cat_conf, priority, pri_conf = "updates", 0.5, "medium", 0.5

            # 6. Persist to the database
            email = Email(
                google_message_id=message_id,
                subject=subject,
                body=body,
                sender=msg.get("sender", ""),
                category=category,
                category_confidence=cat_conf,
                priority=priority,
                priority_confidence=pri_conf,
                source="gmail",
                received_at=received_at,
                created_at=datetime.now(timezone.utc),
            )
            db.add(email)
            try:
                db.commit()
                db.refresh(email)
                saved.append(email)
            except Exception:
                db.rollback()  # e.g. unique constraint on google_message_id

    finally:
        # Release any tensors allocated during torch inference
        gc.collect()

    return saved


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
