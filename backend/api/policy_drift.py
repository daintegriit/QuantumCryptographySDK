# backend/api/policy_drift.py
from __future__ import annotations

from fastapi import APIRouter, Query
from typing import Dict, Any, Optional

from telemetry.policy_drift import (
    detect_policy_drift,
    get_policy_drift_engine,
)

router = APIRouter()


# ============================================================
# Detect Policy Drift (Primary Endpoint)
# ============================================================

@router.get("/policy-drift")
def api_policy_drift(
    baseline_days: int = Query(
        90,
        ge=7,
        le=365 * 5,
        description="Baseline window (days) representing historical policy behavior",
    ),
    recent_days: int = Query(
        14,
        ge=1,
        le=365,
        description="Recent window (days) to compare against baseline",
    ),
    limit_scan: Optional[int] = Query(
        None,
        ge=1,
        description="Optional cap on number of audit events scanned (performance control)",
    ),
) -> Dict[str, Any]:
    """
    Detect cryptographic policy drift over time.

    This endpoint answers:
      - Is policy enforcement weakening?
      - Are weaker schemes appearing more often?
      - Is denial behavior changing silently?

    SAFE:
      - Read-only
      - Deterministic
      - Derived strictly from audit logs
      - Suitable for government & compliance review
    """
    return detect_policy_drift(
        baseline_days=baseline_days,
        recent_days=recent_days,
        limit_scan=limit_scan,
    )


# ============================================================
# Policy Drift Readiness / Health
# ============================================================

@router.get("/policy-drift/status")
def api_policy_drift_status() -> Dict[str, Any]:
    """
    Lightweight readiness check for the policy drift engine.
    """
    engine = get_policy_drift_engine()

    # run a minimal scan to verify wiring
    sample = engine.analyze(
        baseline_days=30,
        recent_days=7,
        limit_scan=25,
    )

    return {
        "policy_drift_engine": "ready",
        "baseline_window_days": sample.get("baseline_window_days"),
        "recent_window_days": sample.get("comparison_window_days"),
        "drift_detected": sample.get("drift_detected"),
        "generated_at_utc": sample.get("generated_at_utc"),
    }