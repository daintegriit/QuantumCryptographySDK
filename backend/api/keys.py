# backend/api/keys.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Dict, Any, Optional
from pathlib import Path

from key_management.keygen import (
    generate_key, get_keygen_engine, KeygenEngine,
)
from key_management.rotation import get_rotation_engine, RotationEngine
from policy.security_store import check_key_allowed
from key_management.lifecycle import evaluate_key_status, scan_key_status

router = APIRouter()

# ── Per-user keystore isolation ──────────────────────────────
def _get_user_id(request: Request) -> Optional[str]:
    """Extract user_id from JWT cookie — returns None if not authenticated."""
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        return None
    try:
        from auth.jwt_handler import decode_token
        payload = decode_token(token)
        return payload.get("sub") if payload else None
    except Exception:
        return None

def _get_engine(request: Request) -> KeygenEngine:
    """Return per-user KeygenEngine if authenticated, else shared."""
    user_id = _get_user_id(request)
    if user_id:
        from auth.user_context import user_keystore_dir
        return KeygenEngine(keystore_dir=user_keystore_dir(user_id))
    return get_keygen_engine()

def _get_rotation(request: Request) -> RotationEngine:
    """Return per-user RotationEngine if authenticated, else shared."""
    user_id = _get_user_id(request)
    if user_id:
        from auth.user_context import user_keystore_dir
        from key_management.rotation import RotationEngine
        keystore = user_keystore_dir(user_id)
        return RotationEngine(keystore_dir=keystore)
    return get_rotation_engine()

# ── Security ─────────────────────────────────────────────────
SENSITIVE_FIELDS = {"private_key"}

def sanitize_key(record) -> Dict[str, Any]:
    if hasattr(record, "__dict__"):
        data = vars(record)
    elif hasattr(record, "_asdict"):
        data = record._asdict()
    elif isinstance(record, dict):
        data = record
    else:
        try:
            from dataclasses import asdict
            data = asdict(record)
        except Exception:
            data = dict(record)
    safe = {k: v for k, v in data.items() if k not in SENSITIVE_FIELDS}
    safe["key_reference_only"] = True
    return safe

# ── Keygen ───────────────────────────────────────────────────
@router.post("/keygen", tags=["keys"])
def api_generate_key(request: Request, payload: Optional[Dict[str, Any]] = None):
    payload = payload or {}
    user_id = _get_user_id(request)

    if user_id:
        from auth.user_context import user_keystore_dir
        engine = KeygenEngine(keystore_dir=user_keystore_dir(user_id))
        record_obj = engine.generate(
            algorithm=payload.get("algorithm", "kyber"),
            parameter_set=payload.get("parameter_set", "kyber768"),
            security_level=payload.get("security_level"),
            estimated_longevity_years=payload.get("estimated_longevity_years", 40),
            notes=payload.get("notes", ""),
        )
        from dataclasses import asdict
        record = {k: v for k, v in asdict(record_obj).items() if k != "private_key"}
    else:
        record = generate_key(payload)

    policy = check_key_allowed(
        scheme=record["algorithm"],
        parameter_set=record["parameter_set"],
        claimed_security_level=record["security_level"],
        estimated_longevity_years=record["estimated_longevity_years"],
    )
    return {"key": sanitize_key(record), "policy": policy}

# ── Static routes (before /{key_id}) ─────────────────────────
@router.get("/keys/active", tags=["lifecycle"])
def api_get_active_key(request: Request):
    rotation = _get_rotation(request)
    engine   = _get_engine(request)
    active_id = rotation.get_active_key_id()
    if not active_id:
        return {"active": False, "key": None}
    record = engine.get(active_id)
    if not record:
        return {"active": False, "key_id": active_id,
                "error": "Active key pointer exists but key record not found"}
    return {"active": True, "key": sanitize_key(record)}

@router.post("/keys/active/rotate", tags=["lifecycle"])
def api_rotate_active_key(request: Request, force: bool = Query(False)):
    return _get_rotation(request).rotate_active_if_needed(force=force)

@router.get("/keys/lifecycle/scan", tags=["lifecycle"])
def api_scan_lifecycle(request: Request, limit: int = Query(50, ge=1, le=500)):
    engine = _get_engine(request)
    keys = engine.list(limit=limit)
    from key_management.lifecycle import evaluate_key_status
    return {"items": [evaluate_key_status(k) for k in keys]}

@router.get("/keys", tags=["keys"])
def api_list_keys(request: Request, limit: int = Query(25, ge=1, le=500)):
    engine = _get_engine(request)
    keys = engine.list(limit=limit)
    return {"keys": [sanitize_key(k) for k in keys]}

# ── Dynamic /{key_id} routes ─────────────────────────────────
@router.get("/keys/{key_id}", tags=["keys"])
def api_get_key(key_id: str, request: Request):
    engine = _get_engine(request)
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Key {key_id} not found")
    return sanitize_key(record)

@router.post("/keys/{key_id}/activate", tags=["lifecycle"])
def api_activate_key(key_id: str, request: Request):
    engine   = _get_engine(request)
    rotation = _get_rotation(request)
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Key {key_id} not found")
    rotation.set_active_key_id(key_id)
    return {"activated": True, "key_id": key_id, "key": sanitize_key(record)}

@router.get("/keys/{key_id}/status", tags=["policy"])
def api_key_status(key_id: str, request: Request):
    engine = _get_engine(request)
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Key {key_id} not found")
    policy = check_key_allowed(
        scheme=record.algorithm,
        parameter_set=record.parameter_set,
        claimed_security_level=record.security_level,
        estimated_longevity_years=record.estimated_longevity_years,
    )
    return {"key_id": key_id, "policy": policy, "key": sanitize_key(record)}

@router.get("/keys/{key_id}/lifecycle", tags=["lifecycle"])
def api_key_lifecycle(key_id: str, request: Request):
    engine = _get_engine(request)
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Key {key_id} not found")
    return evaluate_key_status(record)

@router.post("/keys/{key_id}/rotate", tags=["lifecycle"])
def api_rotate_key(key_id: str, request: Request, force: bool = Query(False)):
    rotation = _get_rotation(request)
    return rotation.rotate_key(key_id, force=force)

@router.get("/keys/{key_id}/simulation", tags=["simulation"])
def api_key_simulation(key_id: str, request: Request,
                        horizon_years: int = Query(50, ge=1, le=100),
                        safety_margin_years: int = Query(10, ge=0, le=30)):
    engine = _get_engine(request)
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Key {key_id} not found")
    from simulations.simulations import simulate_key_longevity
    return simulate_key_longevity(record, horizon_years=horizon_years,
                                   safety_margin_years=safety_margin_years)

@router.get("/keys/{key_id}/migration", tags=["migration"])
def api_key_migration(key_id: str, request: Request):
    engine = _get_engine(request)
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Key {key_id} not found")
    from key_management.migration import evaluate_migration as assess_migration
    return assess_migration(record)

@router.get("/keys/{key_id}/explain", tags=["explain"])
def api_key_explain(key_id: str, request: Request,
                     profile: str = Query("enterprise-default")):
    engine = _get_engine(request)
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Key {key_id} not found")
    from dataclasses import asdict
    from policy.nist_pqc import evaluate_key_policy_dict as check_key_allowed
    rec = asdict(record)
    policy = check_key_allowed(
        scheme=rec["algorithm"],
        parameter_set=rec["parameter_set"],
        claimed_security_level=rec["security_level"],
        estimated_longevity_years=rec["estimated_longevity_years"],
    )
    status = "ALLOWED" if policy.get("allowed") else "BLOCKED"
    return {
        "key_id": key_id,
        "profile": profile,
        "algorithm": rec["algorithm"],
        "parameter_set": rec["parameter_set"],
        "security_level": rec["security_level"],
        "key_type": rec.get("key_type", "unknown"),
        "created_at": rec.get("created_at", ""),
        "policy_status": status,
        "policy": policy,
        "risk_score": rec.get("policy_risk_score", 0),
        "warnings": rec.get("policy_warnings", []),
        "required_actions": rec.get("policy_required_actions", []),
        "explanation": [{"level": "INFO", "message": f"{rec['algorithm']} ({rec['parameter_set']}) rated {rec['security_level']}. Policy: {status}. Risk score: {rec.get('policy_risk_score', 0):.2f}."}],
        "nist_standard": policy.get("nist_standard", ""),
        "recommendation": policy.get("recommendation", ""),
    }

@router.get("/keys/{key_id}/replay", tags=["replay"])
def api_key_replay(key_id: str, request: Request):
    engine = _get_engine(request)
    record = engine.get(key_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Key {key_id} not found")
    from telemetry.replay import replay_key_timeline as replay_key_events
    return replay_key_events(key_id)
