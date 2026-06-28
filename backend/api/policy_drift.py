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
# STATIC ROUTES — before any future parameterized routes
# ============================================================

# BUG FIX: /policy-drift/status must be declared BEFORE any future
# /policy-drift/{id} route. Currently safe, but moved to top as a
# guard against future additions shadowing it.

@router.get("/policy-drift/status")
def api_policy_drift_status() -> Dict[str, Any]:
    """
    Lightweight readiness check for the policy drift engine.

    BUG FIX: original called engine.analyze() on every health probe —
    a full audit log scan on every GET /policy-drift/status call.
    Health probes are called frequently (load balancers, k8s liveness,
    dashboards polling). Running a log scan on each one is O(n) in
    audit log size and will slow down or block under load.

    Fixed: return a static capability declaration. The /policy-drift
    endpoint itself is the correct place to run actual analysis.
    """
    return {
        "policy_drift_engine": "ready",
        "features": {
            "baseline_comparison": True,
            "deny_rate_tracking": True,
            "audit_derived": True,
            "read_only": True,
        },
    }


# ============================================================
# Primary endpoint
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
        description="Optional cap on audit events scanned (performance control)",
    ),
) -> Dict[str, Any]:
    """
    Detect cryptographic policy drift over time.
    """
    return detect_policy_drift(
        baseline_days=baseline_days,
        recent_days=recent_days,
        limit_scan=limit_scan,
    )