"""
Persists the Gmail OAuth tokens to a local JSON file and hands out a valid
access token on request, refreshing it automatically when it's stale.

This is a single-user, personal-project store -- fine for one Gmail account
on one machine. It is NOT a session system: there's no concept of multiple
users. If you ever add real multi-user auth, replace this file-backed store
with a per-user row in your database.

Testing-mode detail this file exists to handle cleanly: while your OAuth
consent screen is in "Testing" publishing status, Google expires the
refresh token after exactly 7 days regardless of use. When that happens,
refreshing the access token fails with `invalid_grant`. Instead of that
error leaking out as a raw 500, GmailReconnectRequired is raised so routers
can turn it into a clean, expected "please reconnect Gmail" response.
"""
import json
import os
import time
from typing import Optional

from app.services import gmail_service

TOKEN_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "gmail_tokens.json"
)

# Refresh a little before actual expiry so we never hand out a token that
# expires mid-request.
EXPIRY_BUFFER_SECONDS = 60


class GmailReconnectRequired(Exception):
    """Raised when there's no valid refresh token left -- the user needs to
    go through /auth/google/login again."""


def _read() -> Optional[dict]:
    if not os.path.exists(TOKEN_PATH):
        return None
    with open(TOKEN_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _write(data: dict) -> None:
    os.makedirs(os.path.dirname(TOKEN_PATH), exist_ok=True)
    with open(TOKEN_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f)


def save_tokens(token_response: dict) -> None:
    """token_response is whatever Google's /token endpoint returned.
    `refresh_token` is only present on the FIRST consent (or when
    prompt=consent forces it) -- if this call doesn't include one, keep
    whatever refresh_token we already had stored.
    """
    existing = _read() or {}
    data = {
        "access_token": token_response["access_token"],
        "refresh_token": token_response.get("refresh_token", existing.get("refresh_token")),
        "expires_at": time.time() + token_response.get("expires_in", 3600),
    }
    if not data["refresh_token"]:
        raise RuntimeError(
            "No refresh_token received and none stored previously. "
            "Make sure /auth/google/login includes access_type=offline&prompt=consent."
        )
    _write(data)


def is_connected() -> bool:
    return _read() is not None


def get_status() -> dict:
    data = _read()
    if not data:
        return {"connected": False, "expires_at": None}
    return {"connected": True, "expires_at": data["expires_at"]}


def disconnect() -> None:
    if os.path.exists(TOKEN_PATH):
        os.remove(TOKEN_PATH)


def get_valid_access_token() -> str:
    """Returns a live access token, refreshing it first if it's expired or
    close to expiring. Raises GmailReconnectRequired if there's nothing
    stored, or if the stored refresh_token has itself expired/been revoked.
    """
    data = _read()
    if not data:
        raise GmailReconnectRequired("No Gmail connection on file yet.")

    if data["expires_at"] - EXPIRY_BUFFER_SECONDS > time.time():
        return data["access_token"]

    try:
        refreshed = gmail_service.refresh_access_token(data["refresh_token"])
    except gmail_service.GoogleTokenError as e:
        # invalid_grant here almost always means: Testing-mode 7-day expiry
        # hit, or the user revoked access from their Google account settings.
        disconnect()
        raise GmailReconnectRequired(str(e)) from e

    save_tokens(refreshed)
    return refreshed["access_token"]
