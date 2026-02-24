# backend/telemetry/replay.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from telemetry.audit_log import read_events, DEFAULT_AUDIT_LOG_PATH


# ============================================================
# Helpers
# ============================================================

def _parse_ts(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


def _safe(d: Dict[str, Any], key: str, default=None):
    return d.get(key, default)


# ============================================================
# Replay Models
# ============================================================

@dataclass(frozen=True)
class ReplayEvent:
    timestamp_utc: str
    event_type: str
    key_id: Optional[str]
    scheme: Optional[str]
    parameter_set: Optional[str]
    summary: str
    raw_event: Dict[str, Any]


@dataclass(frozen=True)
class KeyTimeline:
    key_id: str
    created_at_utc: Optional[str]
    scheme: Optional[str]
    parameter_set: Optional[str]
    events: List[ReplayEvent]
    final_status: str
    superseded_by: Optional[str]


# ============================================================
# Replay Engine
# ============================================================

class ReplayEngine:
    """
    Deterministic cryptographic replay engine.

    Guarantees:
      - Read-only
      - Chronologically ordered
      - Fully auditable
      - Explains WHY actions occurred
    """

    def __init__(self, audit_path: str = DEFAULT_AUDIT_LOG_PATH):
        self.audit_path = audit_path

    # ------------------------------------------------
    # Load + order events
    # ------------------------------------------------

    def _load_events(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        events = list(read_events(audit_path=self.audit_path, limit=limit))
        events.sort(key=lambda e: _parse_ts(e.get("timestamp_utc")) or datetime.min)
        return events

    # ------------------------------------------------
    # Key replay
    # ------------------------------------------------

    def replay_key(self, key_id: str, limit_scan: Optional[int] = None) -> Dict[str, Any]:
        events = self._load_events(limit=limit_scan)

        timeline: List[ReplayEvent] = []

        created_at = None
        scheme = None
        parameter_set = None
        superseded_by = None
        final_status = "ACTIVE"

        for e in events:
            ev_key_id = e.get("key_id")
            if ev_key_id != key_id:
                continue

            ts = e.get("timestamp_utc")
            et = e.get("event_type", "unknown")

            scheme = scheme or e.get("scheme")
            parameter_set = parameter_set or e.get("parameter_set")

            # ------------------------------------
            # Human-readable summaries
            # ------------------------------------
            if et == "keygen":
                created_at = created_at or ts
                summary = "Key generated"
            elif et == "encrypt":
                summary = "Encryption operation"
            elif et == "decrypt":
                summary = "Decryption operation"
            elif et == "policy_check":
                allowed = e.get("result", {}).get("allowed", True)
                summary = f"Policy check: {'ALLOWED' if allowed else 'DENIED'}"
                if not allowed:
                    final_status = "RESTRICTED"
            elif et == "key_rotated":
                parent = e.get("metadata", {}).get("parent_key_id")
                summary = f"Key rotated from {parent}"
            elif et == "key_migrated":
                summary = "Key migrated due to quantum risk"
            elif et == "migration_evaluation":
                sev = e.get("metadata", {}).get("severity")
                summary = f"Migration evaluated ({sev})"
            elif et == "active_key_set":
                summary = "Key set as active"
            elif et == "active_key_bootstrap":
                summary = "Key bootstrapped as active"
            else:
                summary = et.replace("_", " ").title()

            # Detect supersession
            if et == "key_rotated":
                parent = e.get("metadata", {}).get("parent_key_id")
                if parent == key_id:
                    final_status = "SUPERSEDED"
                    superseded_by = e.get("key_id")

            timeline.append(
                ReplayEvent(
                    timestamp_utc=ts,
                    event_type=et,
                    key_id=key_id,
                    scheme=scheme,
                    parameter_set=parameter_set,
                    summary=summary,
                    raw_event=e,
                )
            )

        return asdict(
            KeyTimeline(
                key_id=key_id,
                created_at_utc=created_at,
                scheme=scheme,
                parameter_set=parameter_set,
                events=timeline,
                final_status=final_status,
                superseded_by=superseded_by,
            )
        )

    # ------------------------------------------------
    # Portfolio replay
    # ------------------------------------------------

    def replay_all_keys(self, limit_scan: Optional[int] = None) -> Dict[str, Any]:
        events = self._load_events(limit=limit_scan)

        key_ids = sorted({e.get("key_id") for e in events if e.get("key_id")})

        timelines = {
            kid: self.replay_key(kid, limit_scan=limit_scan)
            for kid in key_ids
        }

        return {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "total_keys": len(timelines),
            "timelines": timelines,
        }


# ============================================================
# Convenience helpers
# ============================================================

_engine_singleton: Optional[ReplayEngine] = None


def get_replay_engine() -> ReplayEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = ReplayEngine()
    return _engine_singleton


def replay_key_timeline(key_id: str, limit_scan: Optional[int] = None) -> Dict[str, Any]:
    return get_replay_engine().replay_key(key_id, limit_scan=limit_scan)


def replay_all(limit_scan: Optional[int] = None) -> Dict[str, Any]:
    return get_replay_engine().replay_all_keys(limit_scan=limit_scan)