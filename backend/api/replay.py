# backend/api/replay.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, Optional

from telemetry.replay import replay_key_timeline, replay_all
from key_management.keygen import get_keygen_engine

router = APIRouter()
def _get_engine(request):
    token = request.cookies.get('access_token') if request else None
    auth_header = request.headers.get('Authorization', '') if request else ''
    if not token and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    if token:
        try:
            from auth.jwt_handler import decode_token
            from auth.user_context import user_keystore_dir
            from key_management.keygen import KeygenEngine
            payload = decode_token(token)
            if payload and payload.get('sub'):
                return KeygenEngine(keystore_dir=user_keystore_dir(payload['sub']))
        except Exception:
            pass
    from key_management.keygen import get_keygen_engine
    return get_keygen_engine()




@router.get("/keys/{key_id}/replay")
def api_replay_key(request: Request, key_id: str, limit_scan: Optional[int] = None):
    engine = _get_engine(request)
    key = engine.get(key_id)

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    timeline = replay_key_timeline(key_id, limit_scan=limit_scan)

    # BUG FIX: original raised 404 when events list was empty.
    # A fresh key with no usage history has no audit events yet —
    # that's expected, not an error. Return empty timeline so the
    # frontend can show "No audit events recorded yet" instead of
    # crashing with an error banner.
    return {
        "key_id": key_id,
        "timeline": timeline or {"events": [], "final_status": "ACTIVE"},
    }


@router.get("/replay")
def api_replay_all_keys(request: Request, limit_scan: Optional[int] = None):
    return replay_all(limit_scan=limit_scan)


@router.get("/replay/status")
def api_replay_status(request: Request, ):
    engine = _get_engine(request)
    keys = engine.list(limit=1)
    return {
        "replay_engine": "ready",
        "keys_present": len(keys),
        "note": "Replay is read-only and audit-safe",
    }