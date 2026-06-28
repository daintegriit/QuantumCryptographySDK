from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGO   = "HS256"
JWT_EXPIRY = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

def create_token(user_id: str, email: str, is_admin: bool = False) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id, "email": email, "admin": is_admin,
        "iat": now, "exp": now + timedelta(hours=JWT_EXPIRY),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
