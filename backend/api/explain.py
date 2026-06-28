# backend/api/explain.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any

from ai.explain import get_explain_engine
from key_management.keygen import get_keygen_engine

router = APIRouter()


# ============================================================
# STATIC ROUTES — before /{key_id} routes
#
# BUG FIX: /explain/status was declared AFTER /keys/{key_id}/explain.
# While these are different path prefixes (/explain vs /keys) and don't
# actually shadow each other in this router, the static route is moved
# first as a consistent pattern — and to guard against future routes
# like /keys/explain/... being added and causing shadowing.
# ============================================================

@router.get("/explain/status")
def api_explain_status() -> Dict[str, Any]:
    engine = get_keygen_engine()
    keys = engine.list(limit=1)
    return {
        "explain_engine": "ready",
        "keys_present": len(keys),
        "mode": "deterministic-governance",
        "note": "Explanations are audit-safe and non-LLM",
    }


# ============================================================
# Explain a single key
# ============================================================

@router.get("/keys/{key_id}/explain")
def api_explain_key(
    key_id: str,
    profile: str = Query(
        # BUG FIX: original default was "default" but ai/explain.py and
        # nist_pqc.py both use DEFAULT_PROFILE = "enterprise-default".
        # Passing "default" here means every explain API call uses the
        # wrong profile string in audit logs, inconsistent with all other
        # policy checks in the system. Fixed to match DEFAULT_PROFILE.
        "enterprise-default",
        description="Policy profile to evaluate against",
    ),
) -> Dict[str, Any]:
    """
    Explain why a key is allowed, risky, or requires action.
    Produces a governance explanation, not crypto math.
    """
    engine = get_keygen_engine()
    key = engine.get(key_id)

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    explain_engine = get_explain_engine()

    try:
        return explain_engine.explain_key(key_id=key_id, profile=profile)

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except Exception as e:
        # BUG FIX: str(e) leaks internal details. Log and return safe message.
        import logging
        logging.getLogger(__name__).exception("explain_key failed for %s", key_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate explanation: {type(e).__name__}",
        )