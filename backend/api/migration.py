# backend/api/migration.py
from fastapi import APIRouter, HTTPException, Request
from typing import Any, Dict, Optional

from key_management.migration import evaluate_migration, migrate_key
from key_management.keygen import get_keygen_engine
from key_management.rotation import get_rotation_engine

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




@router.post("/keys/migrate-active")
def api_migrate_active(request: Request, payload: Optional[Dict[str, Any]] = None):
    payload = payload or {}
    force = bool(payload.get("force", False))
    eng = get_rotation_engine()
    return eng.rotate_active_if_needed(force=force)


@router.get("/keys/{key_id}/migration")
def api_evaluate_migration(request: Request, key_id: str):
    engine = _get_engine(request)
    key = engine.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    return evaluate_migration(key_id)


@router.post("/keys/{key_id}/migrate")
def api_migrate_key(request: Request, key_id: str, payload: Optional[Dict[str, Any]] = None):
    payload = payload or {}
    force = bool(payload.get("force", False))
    engine = _get_engine(request)
    key = engine.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    return migrate_key(key_id, force=force)
