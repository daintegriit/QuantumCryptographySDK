# backend/api/metrics.py
from __future__ import annotations

from fastapi import APIRouter, Query
from typing import Dict, Any, Optional

from telemetry.metrics import (
    get_metrics_engine,
    get_metrics,
)

router = APIRouter()


# ============================================================
# System Metrics (Aggregated)
# ============================================================

@router.get("/telemetry/metrics")
def api_system_metrics(
    window_hours: int = Query(
        24,
        ge=1,
        le=24 * 365,
        description="Time window (hours) to aggregate metrics over",
    ),
    limit_scan: Optional[int] = Query(
        None,
        ge=1,
        description="Optional cap on number of recent audit events to scan",
    ),
) -> Dict[str, Any]:
    """
    Aggregated governance metrics derived from audit logs.

    Includes:
      - event volumes
      - crypto operation counts
      - key lifecycle activity
      - policy allow / deny statistics
      - unique keys / schemes seen

    SAFE:
      - Read-only
      - Deterministic
      - Audit-derived
    """
    return get_metrics(window_hours=window_hours, limit_scan=limit_scan)


# ============================================================
# Metrics Readiness / Health
# ============================================================

@router.get("/telemetry/metrics/status")
def api_metrics_status() -> Dict[str, Any]:
    """
    Lightweight readiness check for metrics engine.
    """
    eng = get_metrics_engine()
    sample = eng.summarize(window_hours=1, limit_scan=10)

    return {
        "metrics_engine": "ready",
        "audit_log_path": sample.get("audit_log_path"),
        "events_seen": sample.get("audit_log_events_total", 0),
        "generated_at_utc": sample.get("generated_at_utc"),
    }