# backend/api/explain.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any

from ai.explain import (
    get_explain_engine,
)
from key_management.keygen import get_keygen_engine


router = APIRouter()


# ============================================================
# Explain a single key (governance narrative)
# ============================================================

@router.get("/keys/{key_id}/explain")
def api_explain_key(
    key_id: str,
    profile: str = Query(
        "default",
        description="Policy profile to evaluate against (e.g. default, gov, financial)",
    ),
) -> Dict[str, Any]:
    """
    Explain *why* a key is allowed, risky, or requires action.

    This endpoint produces a GOVERNANCE EXPLANATION, not crypto math.

    Includes:
      - lifecycle severity
      - policy allow/deny rationale
      - quantum migration horizon
      - telemetry-based risk signals
      - REQUIRED vs RECOMMENDED actions
      - executive-readable narrative

    SAFE:
      - Read-only
      - Deterministic
      - Fully auditable
      - No LLM hallucination
    """
    engine = get_keygen_engine()
    key = engine.get(key_id)

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    explain_engine = get_explain_engine()

    try:
        explanation = explain_engine.explain_key(
            key_id=key_id,
            profile=profile,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate explanation: {str(e)}",
        )

    return explanation


# ============================================================
# Explain engine readiness / health
# ============================================================

@router.get("/explain/status")
def api_explain_status() -> Dict[str, Any]:
    """
    Lightweight readiness check for explainability engine.
    """
    engine = get_keygen_engine()
    keys = engine.list(limit=1)

    return {
        "explain_engine": "ready",
        "keys_present": len(keys),
        "mode": "deterministic-governance",
        "note": "Explanations are audit-safe and non-LLM",
    }