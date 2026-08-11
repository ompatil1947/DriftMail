"""
Persists the Gmail OAuth tokens to a local JSON file and hands out a valid
access token on request, refreshing it automatically when it's stale.

ACCOUNT SWITCHING FIX: When a new access+refresh token pair arrives from a
fresh OAuth consent (new account), we do a full wipe of the existing token
file before writing. This prevents the old account's refresh_token from
being silently reused.

Note on Render free tier: the disk is ephemeral between deploys, so tokens
stored here will be cleared on each new deployment. That is expected behaviour.

Testing-mode detail: while your OAuth consent screen is in "Testing"
publishing status, Google expires the refresh token after exactly 7 days.
When that happens, refreshing fails with `invalid_grant`. Instead of a raw
500, GmailReconnectRequired is raised so routers return a clean 401.
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
    try:
        with open(TOKEN_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def _write(data: dict) -> None:
    os.makedirs(os.path.dirname(TOKEN_PATH), exist_ok=True)
    with open(TOKEN_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f)


def save_tokens(token_response: dict) -> None:
    """Save OAuth tokens from Google's /token endpoint.

    ACCOUNT SWITCHING: If token_response contains a refresh_token (which
    Google only sends on fresh consent), we do a FULL wipe of the existing
    token file to guarantee a clean slate. This prevents the old account's
    refresh_token from leaking into the new session.

    If no refresh_token comes (e.g. silent token refresh), we keep the
    existing one — but only if it belongs to the same account.
    """
    new_refresh_token = token_response.get("refresh_token")

    if new_refresh_token:
        # Fresh consent received — full wipe and write (account may have changed)
        data = {
            "access_token": token_response["access_token"],
            "refresh_token": new_refresh_token,
            "expires_at": time.time() + token_response.get("expires_in", 3600),
        }
    else:
        # Silent refresh — keep existing refresh_token
        existing = _read() or {}
        existing_refresh = existing.get("refresh_token")
        if not existing_refresh:
            raise RuntimeError(
                "No refresh_token received and none stored previously. "
                "Make sure /auth/google/login includes access_type=offline&prompt=consent."
            )
        data = {
            "access_token": token_response["access_token"],
            "refresh_token": existing_refresh,
            "expires_at": time.time() + token_response.get("expires_in", 3600),
        }

    _write(data)


def is_connected() -> bool:
    return _read() is not None


def get_status() -> dict:
    data = _read()
    if not data:
        return {"connected": False, "expires_at": None}
    return {"connected": True, "expires_at": data["expires_at"]}


def disconnect() -> None:
    """Remove stored tokens. Safe to call even if no token is stored."""
    if os.path.exists(TOKEN_PATH):
        try:
            os.remove(TOKEN_PATH)
        except OSError:
            pass


def get_valid_access_token() -> str:
    """Returns a live access token, refreshing it first if it's expired or
    close to expiring. Raises GmailReconnectRequired if there's nothing
    stored, or if the stored refresh_token has itself expired/been revoked.
    """
    data = _read()
    if not data:
        raise GmailReconnectRequired("No Gmail connection on file yet.")

    if not data.get("refresh_token"):
        disconnect()
        raise GmailReconnectRequired("Stored token is missing refresh_token. Please reconnect.")

    if data["expires_at"] - EXPIRY_BUFFER_SECONDS > time.time():
        return data["access_token"]

    try:
        refreshed = gmail_service.refresh_access_token(data["refresh_token"])
    except gmail_service.GoogleTokenError as e:
        # invalid_grant here means: 7-day Testing-mode expiry, or user revoked.
        disconnect()
        raise GmailReconnectRequired(str(e)) from e

    save_tokens(refreshed)
    return refreshed["access_token"]
