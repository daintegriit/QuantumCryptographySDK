# backend/api/anomaly.py
from __future__ import annotations

from fastapi import APIRouter, Query
from typing import Dict, Any, Optional

from ai.anomaly import (
    get_anomaly_engine,
    run_anomaly_scan,
)

router = APIRouter()


# ============================================================
# Run anomaly scan (system-wide)
# ============================================================

@router.get("/anomalies/scan")
def api_run_anomaly_scan(
    window_hours: int = Query(
        24,
        ge=1,
        le=24 * 365,
        description="Time window (hours) to scan for anomalies",
    ),
    limit_scan: Optional[int] = Query(
        None,
        ge=1,
        description="Optional cap on number of recent audit events to scan",
    ),
) -> Dict[str, Any]:
    """
    Run deterministic anomaly detection across the system.

    Detects:
      - policy denial spikes
      - unjustified migrations
      - early rotations
      - excessive key usage
      - abnormal lifecycle behavior

    SAFE:
      - Read-only
      - Deterministic
      - Audit-log derived
      - No cryptographic operations
    """
    return run_anomaly_scan(
        window_hours=window_hours,
        limit_scan=limit_scan,
    )


# ============================================================
# Anomaly engine readiness / health
# ============================================================

@router.get("/anomalies/status")
def api_anomaly_status() -> Dict[str, Any]:
    """
    Lightweight readiness check for anomaly engine.
    """
    eng = get_anomaly_engine()

    return {
        "anomaly_engine": "ready",
        "detection_model": "deterministic-governance",
        "llm_dependency": False,
        "note": "Anomaly detection is explainable and audit-safe",
    }