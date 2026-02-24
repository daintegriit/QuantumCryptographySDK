# backend/api/telemetry.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional

from telemetry.telemetry import (
    get_telemetry_engine,
    summarize_key,
    system_snapshot,
)
from telemetry.replay import (
    replay_key_timeline,
    replay_all,
)
from key_management.keygen import get_keygen_engine

router = APIRouter()


# ============================================================
# System-wide telemetry
# ============================================================

@router.get("/telemetry/system")
def api_system_telemetry() -> Dict[str, Any]:
    """
    High-level governance telemetry snapshot.

    SAFE:
      - Read-only
      - Deterministic
      - Derived strictly from audit logs

    Answers:
      - How many keys exist?
      - How often crypto is used?
      - Are policies being violated?
    """
    return system_snapshot()


# ============================================================
# Per-key telemetry
# ============================================================

@router.get("/telemetry/keys/{key_id}")
def api_key_telemetry(key_id: str) -> Dict[str, Any]:
    """
    Telemetry summary for a single key.

    Includes:
      - encryption/decryption counts
      - rotations & migrations
      - policy denials
      - age + last use
    """
    engine = get_keygen_engine()
    key = engine.get(key_id)

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    summary = summarize_key(key_id)
    if not summary:
        raise HTTPException(
            status_code=404,
            detail="No telemetry available for this key",
        )

    return summary


# ============================================================
# Key lifecycle replay (audit / compliance)
# ============================================================

@router.get("/telemetry/keys/{key_id}/replay")
def api_replay_key(
    key_id: str,
    limit_scan: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Deterministic replay of a key’s lifecycle.

    Used for:
      - audits
      - incident response
      - compliance justification
      - future AI explanations
    """
    engine = get_keygen_engine()
    if not engine.get(key_id):
        raise HTTPException(status_code=404, detail="Key not found")

    return replay_key_timeline(key_id, limit_scan=limit_scan)


# ============================================================
# Portfolio replay (ALL keys)
# ============================================================

@router.get("/telemetry/replay")
def api_replay_all(limit_scan: Optional[int] = None) -> Dict[str, Any]:
    """
    Replay timelines for ALL observed keys.

    WARNING:
      - Heavy endpoint
      - Intended for audits, offline analysis, research
    """
    return replay_all(limit_scan=limit_scan)


# ============================================================
# Telemetry health / readiness
# ============================================================

@router.get("/telemetry/status")
def api_telemetry_status() -> Dict[str, Any]:
    """
    Lightweight readiness check for telemetry pipeline.
    """
    eng = get_telemetry_engine()
    snap = eng.system_snapshot()

    return {
        "telemetry_engine": "ready",
        "audit_events_present": snap.total_keys > 0,
        "total_keys_seen": snap.total_keys,
        "generated_at_utc": snap.generated_at_utc,
    }