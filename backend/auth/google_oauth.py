from __future__ import annotations
import os
import uuid
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from auth.database import get_pool
from auth.jwt_handler import create_token
from auth.models import User
from auth.middleware import get_optional_user

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI", "https://api.qsentry.io/auth/google/callback")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "https://qsentry.io")

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_URL  = "https://www.googleapis.com/oauth2/v3/userinfo"

@router.get("/google/login")
async def google_login():
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": str(uuid.uuid4()),
        "access_type": "offline",
        "prompt": "select_account",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{query}")

@router.get("/google/callback")
async def google_callback(code: str, state: str):
    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code, "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="OAuth token exchange failed")
        tokens = token_res.json()
        user_res = await client.get(
            GOOGLE_USER_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info")
        google_user = user_res.json()

    user_id = google_user["sub"]
    email   = google_user["email"]
    name    = google_user.get("name", email)
    avatar  = google_user.get("picture", "")

    pool = await get_pool()
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM users")
        is_admin = (count == 0)
        await conn.execute("""
            INSERT INTO users (user_id, email, name, avatar_url, is_admin)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO UPDATE SET
                name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url, last_login = NOW()
        """, user_id, email, name, avatar, is_admin)
        row = await conn.fetchrow("SELECT * FROM users WHERE user_id = $1", user_id)

    user = User.from_row(row)
    jwt_token = create_token(user.user_id, user.email, user.is_admin)

    # Pass token via URL fragment → stored in localStorage by frontend
    return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?token={jwt_token}")

@router.get("/status")
async def auth_status(request: Request):
    user = await get_optional_user(request, None)
    if user:
        return {"authenticated": True, "user": user.to_public()}
    return {"authenticated": False}

@router.post("/logout")
async def logout():
    return JSONResponse({"message": "Logged out"})

@router.get("/me")
async def get_me(request: Request):
    user = await get_optional_user(request, None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.to_public()
