# backend/api/migration.py
from fastapi import APIRouter, HTTPException
from typing import Any, Dict, Optional

from key_management.migration import evaluate_migration, migrate_key
from key_management.keygen import get_keygen_engine
from key_management.rotation import get_rotation_engine

router = APIRouter()


@router.post("/keys/migrate-active")
def api_migrate_active(payload: Optional[Dict[str, Any]] = None):
    payload = payload or {}
    force = bool(payload.get("force", False))
    eng = get_rotation_engine()
    return eng.rotate_active_if_needed(force=force)


@router.get("/keys/{key_id}/migration")
def api_evaluate_migration(key_id: str):
    engine = get_keygen_engine()
    key = engine.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    return evaluate_migration(key_id)


@router.post("/keys/{key_id}/migrate")
def api_migrate_key(key_id: str, payload: Optional[Dict[str, Any]] = None):
    payload = payload or {}
    force = bool(payload.get("force", False))
    engine = get_keygen_engine()
    key = engine.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    return migrate_key(key_id, force=force)
