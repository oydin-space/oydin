"""Google OAuth 2 (server-side code flow + PKCE + nonce). id_token проверяется через Google tokeninfo."""

import base64
import hashlib
import secrets
import time
from urllib.parse import urlencode

import httpx
from django.conf import settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
TIMEOUT = 10


class GoogleAuthError(Exception):
    """code — машинный код ошибки для редиректа на фронт."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def is_configured():
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def new_flow(next_url):
    verifier = secrets.token_urlsafe(64)
    return {
        "state": secrets.token_urlsafe(32),
        "nonce": secrets.token_urlsafe(32),
        "verifier": verifier,
        "next": next_url,
    }


def authorize_url(flow, redirect_uri):
    challenge = base64.urlsafe_b64encode(hashlib.sha256(flow["verifier"].encode()).digest()).rstrip(b"=").decode()
    return AUTH_URL + "?" + urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": flow["state"],
        "nonce": flow["nonce"],
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    })


def exchange_code(code, verifier, redirect_uri):
    try:
        resp = httpx.post(TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        }, timeout=TIMEOUT)
    except httpx.HTTPError:
        raise GoogleAuthError("google_unavailable") from None
    if resp.status_code != 200:
        raise GoogleAuthError("token_exchange_failed")
    id_token = resp.json().get("id_token")
    if not id_token:
        raise GoogleAuthError("token_exchange_failed")
    return id_token


def verify_id_token(id_token, nonce, *, now=None):
    """Проверка подписи — на стороне Google tokeninfo; aud/iss/exp/email_verified/nonce проверяем сами."""
    try:
        resp = httpx.get(TOKENINFO_URL, params={"id_token": id_token}, timeout=TIMEOUT)
    except httpx.HTTPError:
        raise GoogleAuthError("google_unavailable") from None
    if resp.status_code != 200:
        raise GoogleAuthError("invalid_token")
    claims = resp.json()
    if claims.get("aud") != settings.GOOGLE_CLIENT_ID or claims.get("iss") not in ISSUERS:
        raise GoogleAuthError("invalid_token")
    try:
        expired = int(claims.get("exp", 0)) <= (now if now is not None else time.time())
    except (TypeError, ValueError):
        expired = True
    if expired:
        raise GoogleAuthError("invalid_token")
    if not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise GoogleAuthError("invalid_token")
    if str(claims.get("email_verified")).lower() != "true" or not claims.get("email") or not claims.get("sub"):
        raise GoogleAuthError("email_not_verified")
    return claims
