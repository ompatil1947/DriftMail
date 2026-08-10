"""
Talks to Google directly over REST (via httpx) rather than pulling in
google-api-python-client / google-auth-oauthlib -- fewer, lighter
dependencies for what's a small surface area: exchange a code, refresh a
token, list inbox message ids, fetch one message's subject + body.
"""
import base64
import re
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.core.config import settings

TOKEN_URL = "https://oauth2.googleapis.com/token"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1/users/me"
SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


class GoogleTokenError(Exception):
    """Raised when Google's token endpoint returns an error (invalid_grant,
    invalid_client, etc). The caller decides what that means -- token_store
    treats it as "refresh token is dead, need to reconnect"."""


def build_authorization_url(state: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",  # required to get a refresh_token back
        "prompt": "consent",       # forces a refresh_token even on repeat logins
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict:
    resp = httpx.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=10.0,
    )
    if resp.status_code != 200:
        raise GoogleTokenError(f"Token exchange failed: {resp.status_code} {resp.text}")
    return resp.json()


def refresh_access_token(refresh_token: str) -> dict:
    resp = httpx.post(
        TOKEN_URL,
        data={
            "refresh_token": refresh_token,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "grant_type": "refresh_token",
        },
        timeout=10.0,
    )
    if resp.status_code != 200:
        raise GoogleTokenError(f"Token refresh failed: {resp.status_code} {resp.text}")
    data = resp.json()
    # Refresh responses don't include a new refresh_token -- caller (token_store)
    # keeps reusing the one it already has.
    data.setdefault("refresh_token", None)
    return data


def _auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def list_recent_message_ids(access_token: str, max_results: int = 10) -> list[str]:
    resp = httpx.get(
        f"{GMAIL_API_BASE}/messages",
        headers=_auth_headers(access_token),
        params={"maxResults": max_results, "labelIds": "INBOX"},
        timeout=10.0,
    )
    resp.raise_for_status()
    return [m["id"] for m in resp.json().get("messages", [])]


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def extract_email_body(payload: dict) -> str:
    """Safely extracts plain-text or HTML body from a Gmail API message payload."""
    body_text = ""
    
    # 1. Check direct body data
    if "body" in payload and "data" in payload["body"]:
        data = payload["body"]["data"]
        # Add padding to prevent Incorrect padding errors
        data += "=" * ((4 - len(data) % 4) % 4)
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    
    # 2. Check multipart payload structures
    parts = payload.get("parts", [])
    for part in parts:
        mime_type = part.get("mimeType", "")
        data = part.get("body", {}).get("data", "")
        
        if mime_type == "text/plain" and data:
            data += "=" * ((4 - len(data) % 4) % 4)
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
        elif mime_type == "text/html" and data and not body_text:
            data += "=" * ((4 - len(data) % 4) % 4)
            body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            
    return body_text or "(No text content available)"


def get_message(access_token: str, message_id: str, max_body_chars: int = 3000) -> dict:
    resp = httpx.get(
        f"{GMAIL_API_BASE}/messages/{message_id}",
        headers=_auth_headers(access_token),
        params={"format": "full"},
        timeout=10.0,
    )
    resp.raise_for_status()
    msg = resp.json()

    headers = {h["name"].lower(): h["value"] for h in msg["payload"].get("headers", [])}
    body = extract_email_body(msg["payload"])[:max_body_chars]

    return {
        "id": msg["id"],
        "subject": headers.get("subject", "(no subject)"),
        "sender": headers.get("from", ""),
        "date": headers.get("date"),
        "snippet": msg.get("snippet", ""),
        "body": body,
    }
