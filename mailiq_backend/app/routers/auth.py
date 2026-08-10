"""
GET  /auth/google/login      -> redirects the browser to Google's consent screen
GET  /auth/google/callback   -> Google redirects here with ?code=...
GET  /auth/google/status     -> is Gmail currently connected?
POST /auth/google/disconnect -> forget the stored tokens
"""
import secrets

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services import gmail_service, token_store
from app.db.database import get_db
from app.db.models import Email, QAHistory

router = APIRouter(prefix="/auth/google", tags=["auth"])

# In-memory CSRF state store. Fine for a single-process personal project --
# if you ever run multiple uvicorn workers behind a load balancer, swap this
# for something shared (Redis, a DB row) since each worker would otherwise
# have its own copy of this set.
_pending_states: set[str] = set()


def _clear_gmail_data(db: Session):
    """Helper to wipe all Gmail-sourced emails and their Q&A history."""
    gmail_emails = db.query(Email).filter(Email.source == "gmail").all()
    if gmail_emails:
        email_ids = [e.id for e in gmail_emails]
        db.query(QAHistory).filter(QAHistory.email_id.in_(email_ids)).delete(synchronize_session=False)
        db.query(Email).filter(Email.source == "gmail").delete(synchronize_session=False)
        db.commit()


@router.get("/login")
def login():
    state = secrets.token_urlsafe(24)
    _pending_states.add(state)
    url = gmail_service.build_authorization_url(state)
    return RedirectResponse(url)


@router.get("/callback")
def callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if error:
        # e.g. the user clicked "Cancel" on Google's consent screen
        raise HTTPException(status_code=400, detail=f"Google returned an error: {error}")

    if not state or state not in _pending_states:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")
    _pending_states.discard(state)

    if not code:
        raise HTTPException(status_code=400, detail="Missing 'code' from Google.")

    try:
        tokens = gmail_service.exchange_code_for_tokens(code)
        token_store.save_tokens(tokens)
        # Wipe old Gmail data when a new account is connected
        _clear_gmail_data(db)
    except gmail_service.GoogleTokenError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if settings.frontend_url:
        return RedirectResponse(f"{settings.frontend_url}?gmail_connected=true")
    return {"connected": True, "message": "Gmail connected. You can close this tab."}


@router.get("/status")
def status():
    return token_store.get_status()


@router.post("/disconnect")
def disconnect(db: Session = Depends(get_db)):
    token_store.disconnect()
    # Wipe old Gmail data when disconnected
    _clear_gmail_data(db)
    return {"disconnected": True}
