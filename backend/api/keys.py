# backend/api/keys.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional

from key_management.keygen import (
    generate_key,
    get_keygen_engine,
)
from key_management.rotation import (
    get_rotation_engine,
)
from policy.security_store import (
    check_key_allowed,
)
from key_management.lifecycle import evaluate_key_status, scan_key_status


router = APIRouter()

# ==================================================
# SECURITY: Strip sensitive fields
# ==================================================

SENSITIVE_FIELDS = {"private_key"}


def sanitize_key(record) -> Dict[str, Any]:
    # BUG FIX: handle both dict and dataclass/object uniformly
    if hasattr(record, "__dict__"):
        data = vars(record)
    elif hasattr(record, "_asdict"):
        data = record._asdict()
    elif isinstance(record, dict):
        data = record
    else:
        # dataclass — try asdict fallback
        try:
            from dataclasses import asdict
            data = asdict(record)
        except Exception:
            data = dict(record)

    safe = {k: v for k, v in data.items() if k not in SENSITIVE_FIELDS}
    safe["key_reference_only"] = True
    return safe


# ==================================================
# Key Generation
# ==================================================

@router.post("/keygen", tags=["keys"])
def api_generate_key(payload: Optional[Dict[str, Any]] = None):
    payload = payload or {}

    # generate_key returns a dict (via serialize_public)
    record = generate_key(payload)

    policy = check_key_allowed(
        scheme=record["algorithm"],
        parameter_set=record["parameter_set"],
        claimed_security_level=record["security_level"],
        estimated_longevity_years=record["estimated_longevity_years"],
    )

    return {
        "key": sanitize_key(record),
        "policy": policy,
    }


# ==================================================
# STATIC ROUTES — must come before /{key_id} routes
# ==================================================

# BUG FIX: /keys/active and /keys/lifecycle/scan must be declared
# BEFORE /keys/{key_id} or FastAPI routes "active" and "lifecycle"
# as key_id values, making them unreachable.

@router.get("/keys/active", tags=["lifecycle"])
def api_get_active_key():
    rotation = get_rotation_engine()
    keygen = get_keygen_engine()

    active_id = rotation.get_active_key_id()
    if not active_id:
        return {"active": False, "key": None}

    record = keygen.get(active_id)
    if not record:
        return {
            "active": False,
            "key_id": active_id,
            "error": "Active key pointer exists but key record not found",
        }

    return {
        "active": True,
        "key": sanitize_key(record),
    }


@router.post("/keys/active/rotate", tags=["lifecycle"])
def api_rotate_active_key(force: bool = Query(False)):
    rotation = get_rotation_engine()
    return rotation.rotate_active_if_needed(force=force)


# BUG FIX: was declared after /keys/{key_id} — FastAPI would capture
# "lifecycle" as the key_id param, making /keys/lifecycle/scan 404.
@router.get("/keys/lifecycle/scan", tags=["lifecycle"])
def api_scan_lifecycle(limit: int = Query(50, ge=1, le=500)):
    return {"items": scan_key_status(limit=limit)}


# ==================================================
# Key Inventory
# ==================================================

@router.get("/keys", tags=["keys"])
def api_list_keys(limit: int = Query(25, ge=1, le=500)):
    engine = get_keygen_engine()
    keys = engine.list(limit=limit)
    return {"keys": [sanitize_key(k) for k in keys]}


# ==================================================
# Dynamic /{key_id} routes — AFTER all static routes
# ==================================================

@router.get("/keys/{key_id}", tags=["keys"])
def api_get_key(key_id: str):
    engine = get_keygen_engine()
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail="Key not found")
    return sanitize_key(record)


@router.post("/keys/{key_id}/activate", tags=["lifecycle"])
def api_activate_key(key_id: str):
    engine = get_keygen_engine()
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail="Key not found")

    rotation = get_rotation_engine()
    rotation.set_active_key_id(key_id, reason="manual_activate")

    return {
        "active": True,
        "active_key_id": key_id,
        "reason": "manual_activate",
    }


# ==================================================
# Policy Status
# ==================================================

@router.get("/keys/{key_id}/status", tags=["policy"])
def api_key_status(key_id: str):
    engine = get_keygen_engine()
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail="Key not found")

    # BUG FIX: record is a KeyRecord dataclass — use attribute access consistently
    policy = check_key_allowed(
        scheme=record.algorithm,
        parameter_set=record.parameter_set,
        claimed_security_level=record.security_level,
        estimated_longevity_years=record.estimated_longevity_years,
    )

    return {
        "key_id": key_id,
        "policy": policy,
    }


# ==================================================
# Lifecycle & Governance
# ==================================================

@router.get("/keys/{key_id}/lifecycle", tags=["lifecycle"])
def api_key_lifecycle(key_id: str):
    try:
        return {"key_id": key_id, "lifecycle": evaluate_key_status(key_id)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Key not found")


# ==================================================
# Rotation (Per-Key)
# ==================================================

@router.post("/keys/{key_id}/rotate", tags=["lifecycle"])
def api_rotate_key(
    key_id: str,
    force: bool = Query(False),
):
    engine = get_keygen_engine()
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail="Key not found")

    rotation = get_rotation_engine()
    return rotation.rotate_if_needed(
        key_id=key_id,
        force=force,
        set_active=True,
    )