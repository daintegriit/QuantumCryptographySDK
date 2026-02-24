# backend/api/replay.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional

from telemetry.replay import (
    replay_key_timeline,
    replay_all,
)
from key_management.keygen import get_keygen_engine


router = APIRouter()


# ============================================================
# Replay single key timeline
# ============================================================

@router.get("/keys/{key_id}/replay")
def api_replay_key(
    key_id: str,
    limit_scan: Optional[int] = None,
):
    """
    Reconstruct the full lifecycle of a single key.

    Use cases:
      - Compliance audits
      - Incident response
      - Explaining rotations / migrations
      - Government certification evidence

    SAFE:
      - Read-only
      - No cryptographic operations
    """
    engine = get_keygen_engine()
    key = engine.get(key_id)

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    timeline = replay_key_timeline(key_id, limit_scan=limit_scan)

    if not timeline or not timeline.get("events"):
        raise HTTPException(
            status_code=404,
            detail="No replay data found for this key",
        )

    return {
        "key_id": key_id,
        "timeline": timeline,
    }


# ============================================================
# Replay entire portfolio
# ============================================================

@router.get("/replay")
def api_replay_all_keys(
    limit_scan: Optional[int] = None,
):
    """
    Reconstruct timelines for ALL keys in the system.

    Use cases:
      - System-wide audits
      - Governance reports
      - Regulatory snapshots
      - AI / anomaly analysis

    WARNING:
      - Can be heavy if audit log is very large
      - Use limit_scan for sampling
    """
    result = replay_all(limit_scan=limit_scan)

    return result


# ============================================================
# Replay system summary (lightweight)
# ============================================================

@router.get("/replay/status")
def api_replay_status():
    """
    Sanity check endpoint for replay engine readiness.
    """
    engine = get_keygen_engine()
    keys = engine.list(limit=1)

    return {
        "replay_engine": "ready",
        "keys_present": len(keys),
        "note": "Replay is read-only and audit-safe",
    }