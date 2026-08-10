from fastapi import APIRouter, HTTPException, Query

from app.schemas.email_schema import InboxEmailPrediction
from app.services import gmail_service, rag_service, token_store
from app.services.model_service import classifier

router = APIRouter(prefix="/gmail", tags=["gmail"])

MAX_RESULTS_CAP = 25


@router.get("/inbox", response_model=list[InboxEmailPrediction])
def inbox(max_results: int = Query(default=10, ge=1, le=MAX_RESULTS_CAP)):
    try:
        access_token = token_store.get_valid_access_token()
    except token_store.GmailReconnectRequired:
        raise HTTPException(
            status_code=401,
            detail={
                "error_code": "RECONNECT_REQUIRED",
                "message": "Gmail isn't connected, or the connection expired. "
                           "Send the user to GET /auth/google/login again.",
            },
        )

    message_ids = gmail_service.list_recent_message_ids(access_token, max_results)

    results = []
    for message_id in message_ids:
        msg = gmail_service.get_message(access_token, message_id)

        category, category_conf, priority, priority_conf = classifier.predict(
            msg["subject"], msg["body"]
        )
        context_note = rag_service.get_context(category)

        results.append(
            InboxEmailPrediction(
                id=msg["id"],
                sender=msg["sender"],
                date=msg["date"],
                snippet=msg["snippet"],
                category=category,
                category_confidence=category_conf,
                priority=priority,
                priority_confidence=priority_conf,
                context_note=context_note,
            )
        )

    return results


@router.get("/debug")
def debug_gmail():
    """
    Diagnostic endpoint — returns the current token status and attempts to list
    the 5 most recent message IDs from Gmail.  Use this to confirm the OAuth
    token is valid before troubleshooting the sync flow.
    Visit: http://localhost:8000/gmail/debug
    """
    status = token_store.get_status()
    if not status["connected"]:
        return {"connected": False, "message": "No token on file. Go to /auth/google/login first."}

    try:
        access_token = token_store.get_valid_access_token()
    except token_store.GmailReconnectRequired as e:
        return {"connected": False, "error": str(e), "action": "Go to /auth/google/login to reconnect."}

    try:
        message_ids = gmail_service.list_recent_message_ids(access_token, max_results=5)
        return {
            "connected": True,
            "token_expires_at": status["expires_at"],
            "gmail_api": "OK",
            "sample_message_ids": message_ids,
            "message_count": len(message_ids),
        }
    except Exception as exc:
        return {
            "connected": True,
            "token_expires_at": status["expires_at"],
            "gmail_api": "ERROR",
            "error": str(exc),
        }
