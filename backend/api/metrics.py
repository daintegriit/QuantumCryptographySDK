# backend/api/metrics.py
from __future__ import annotations

from fastapi import APIRouter, Query
from typing import Dict, Any, Optional
import subprocess
import json
from pathlib import Path

from telemetry.metrics import (
    get_metrics_engine,
    get_metrics,
)

router = APIRouter()


# ============================================================
# CONFIG (Rust Binary Path)
# ============================================================

RUST_BIN = Path(__file__).resolve().parents[2] / "rust_benchmark/target/release/rust_benchmark"


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
    return get_metrics(window_hours=window_hours, limit_scan=limit_scan)


# ============================================================
# Metrics Readiness / Health
# ============================================================

@router.get("/telemetry/metrics/status")
def api_metrics_status() -> Dict[str, Any]:
    eng = get_metrics_engine()
    sample = eng.summarize(window_hours=1, limit_scan=10)

    return {
        "metrics_engine": "ready",
        "audit_log_path": sample.get("audit_log_path"),
        "events_seen": sample.get("audit_log_events_total", 0),
        "generated_at_utc": sample.get("generated_at_utc"),
    }


# ============================================================
# Rust Benchmark Integration (Level 2)
# ============================================================

@router.get("/rust/benchmark")
def api_rust_benchmark(mode: str = "benchmark") -> Dict[str, Any]:
    """
    Executes Rust cryptographic benchmark and returns results.

    Modes:
      - benchmark (default): full run (Kyber + Falcon)
      - kem: Kyber only
      - sig: Falcon only

    SAFE:
      - Read-only
      - Deterministic
      - No key persistence
    """

    if not RUST_BIN.exists():
        return {
            "status": "error",
            "message": f"Rust binary not found at {RUST_BIN}",
        }

    try:
        result = subprocess.run(
            [str(RUST_BIN), mode],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            return {
                "status": "error",
                "stderr": result.stderr.strip(),
            }

        data = json.loads(result.stdout)

        return {
            "status": "ok",
            "mode": mode,
            "results": data,
        }

    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "message": "Rust benchmark timed out",
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
        }