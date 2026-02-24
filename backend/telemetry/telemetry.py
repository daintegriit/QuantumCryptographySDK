# backend/telemetry/telemetry.py
from __future__ import annotations

import json
import os
from collections import Counter
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from telemetry.audit_log import read_events, DEFAULT_AUDIT_LOG_PATH


# ============================================================
# Models
# ============================================================

@dataclass(frozen=True)
class KeyTelemetrySummary:
    key_id: str
    scheme: Optional[str]
    parameter_set: Optional[str]
    created_at_utc: Optional[str]

    encrypt_count: int
    decrypt_count: int
    rotation_count: int
    migration_count: int
    policy_denials: int

    last_used_utc: Optional[str]
    age_days: Optional[int]


@dataclass(frozen=True)
class SystemTelemetrySnapshot:
    generated_at_utc: str

    total_keys: int
    active_keys: int

    total_encryptions: int
    total_decryptions: int
    total_rotations: int
    total_migrations: int
    total_policy_denials: int

    per_scheme_usage: Dict[str, int]
    per_event_type: Dict[str, int]


# ============================================================
# Telemetry Engine
# ============================================================

class TelemetryEngine:
    """
    Deterministic telemetry aggregation over append-only audit logs.

    GUARANTEES:
      - Read-only
      - Replayable
      - Audit-safe
      - No heuristics, no guessing
    """

    def __init__(self, audit_path: str = DEFAULT_AUDIT_LOG_PATH):
        self.audit_path = audit_path

    # ------------------------------------------------
    # Load events (canonical)
    # ------------------------------------------------

    def _load_events(self) -> List[Dict]:
        return list(read_events(audit_path=self.audit_path))

    # ------------------------------------------------
    # Per-key telemetry
    # ------------------------------------------------

    def summarize_key(self, key_id: str) -> Optional[KeyTelemetrySummary]:
        events = self._load_events()
        key_events = []

        for e in events:
            payload = e.get("payload") or {}
            result = e.get("result") or {}

            ev_key_id = payload.get("key_id") or result.get("key_id")
            if ev_key_id == key_id:
                key_events.append(e)

        if not key_events:
            return None

        encrypt_count = sum(1 for e in key_events if e["event_type"] == "encrypt")
        decrypt_count = sum(1 for e in key_events if e["event_type"] == "decrypt")
        rotation_count = sum(1 for e in key_events if e["event_type"] == "key_rotated")
        migration_count = sum(1 for e in key_events if e["event_type"] == "key_migrated")

        policy_denials = sum(
            1
            for e in key_events
            if e["event_type"] == "policy_check"
            and not (e.get("result") or {}).get("allowed", True)
        )

        scheme = None
        parameter_set = None
        created_at = None
        last_used = None

        for e in key_events:
            payload = e.get("payload") or {}

            scheme = scheme or payload.get("scheme")
            parameter_set = parameter_set or payload.get("parameter_set")

            ts = e.get("timestamp_utc")
            if ts:
                last_used = max(last_used or ts, ts)

            if e["event_type"] in ("keygen", "key_generated", "key_created"):
                created_at = created_at or ts

        age_days = None
        if created_at:
            try:
                created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                age_days = (datetime.now(timezone.utc) - created_dt).days
            except Exception:
                pass

        return KeyTelemetrySummary(
            key_id=key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            created_at_utc=created_at,
            encrypt_count=encrypt_count,
            decrypt_count=decrypt_count,
            rotation_count=rotation_count,
            migration_count=migration_count,
            policy_denials=policy_denials,
            last_used_utc=last_used,
            age_days=age_days,
        )

    # ------------------------------------------------
    # System-wide telemetry
    # ------------------------------------------------

    def system_snapshot(self) -> SystemTelemetrySnapshot:
        events = self._load_events()

        per_event = Counter(e.get("event_type") for e in events)
        per_scheme = Counter(
            (e.get("payload") or {}).get("scheme")
            for e in events
            if (e.get("payload") or {}).get("scheme")
        )

        total_encryptions = per_event.get("encrypt", 0)
        total_decryptions = per_event.get("decrypt", 0)
        total_rotations = per_event.get("key_rotated", 0)
        total_migrations = per_event.get("key_migrated", 0)

        policy_denials = sum(
            1
            for e in events
            if e.get("event_type") == "policy_check"
            and not (e.get("result") or {}).get("allowed", True)
        )

        key_ids = {
            (e.get("payload") or {}).get("key_id")
            for e in events
            if (e.get("payload") or {}).get("key_id")
        }

        return SystemTelemetrySnapshot(
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
            total_keys=len(key_ids),
            active_keys=len(key_ids),  # refined later via active_key pointer
            total_encryptions=total_encryptions,
            total_decryptions=total_decryptions,
            total_rotations=total_rotations,
            total_migrations=total_migrations,
            total_policy_denials=policy_denials,
            per_scheme_usage=dict(per_scheme),
            per_event_type=dict(per_event),
        )


# ============================================================
# Convenience helpers
# ============================================================

_engine_singleton: Optional[TelemetryEngine] = None


def get_telemetry_engine() -> TelemetryEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = TelemetryEngine()
    return _engine_singleton


def summarize_key(key_id: str) -> Optional[Dict]:
    summary = get_telemetry_engine().summarize_key(key_id)
    return asdict(summary) if summary else None


def system_snapshot() -> Dict:
    snap = get_telemetry_engine().system_snapshot()
    return asdict(snap)