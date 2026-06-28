# backend/telemetry/telemetry.py
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from telemetry.audit_log import read_events, DEFAULT_AUDIT_LOG_PATH


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


class TelemetryEngine:

    def __init__(self, audit_path: str = DEFAULT_AUDIT_LOG_PATH):
        self.audit_path = audit_path

    def _load_events(self) -> List[Dict]:
        # BUG FIX: normalize=True (default) ensures both flat and
        # payload-wrapped events are readable via the same field names.
        return list(read_events(audit_path=self.audit_path))

    def summarize_key(self, key_id: str) -> Optional[KeyTelemetrySummary]:
        events = self._load_events()

        # BUG FIX: original used e.get("payload", {}).get("key_id") which
        # only matched payload-wrapped events. After normalization, key_id
        # is always at top level regardless of original writer.
        key_events = [e for e in events if e.get("key_id") == key_id]

        if not key_events:
            return None

        et = lambda name: sum(1 for e in key_events if e["event_type"] == name)

        encrypt_count  = et("encrypt")
        decrypt_count  = et("decrypt")
        rotation_count = et("key_rotated")
        migration_count = et("key_migrated")

        policy_denials = sum(
            1 for e in key_events
            if e["event_type"] == "policy_check"
            and e.get("result", {}).get("allowed") is False
        )

        scheme = next((e["scheme"] for e in key_events if e.get("scheme")), None)
        parameter_set = next((e["parameter_set"] for e in key_events if e.get("parameter_set")), None)

        timestamps = [e["timestamp_utc"] for e in key_events if e.get("timestamp_utc")]
        last_used = max(timestamps) if timestamps else None

        created_at = next(
            (e["timestamp_utc"] for e in key_events
             if e["event_type"] in ("keygen", "key_generated", "key_created")),
            None,
        )

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

    def system_snapshot(self) -> SystemTelemetrySnapshot:
        events = self._load_events()

        # BUG FIX: original used e.get("payload", {}).get("scheme") —
        # missed all flat events. After normalization, scheme is top-level.
        per_event = Counter(e.get("event_type") for e in events)
        per_scheme = Counter(e["scheme"] for e in events if e.get("scheme"))

        policy_denials = sum(
            1 for e in events
            if e.get("event_type") == "policy_check"
            and e.get("result", {}).get("allowed") is False
        )

        # BUG FIX: original used e.get("payload", {}).get("key_id")
        key_ids = {e["key_id"] for e in events if e.get("key_id")}

        return SystemTelemetrySnapshot(
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
            total_keys=len(key_ids),
            active_keys=len(key_ids),
            total_encryptions=per_event.get("encrypt", 0),
            total_decryptions=per_event.get("decrypt", 0),
            total_rotations=per_event.get("key_rotated", 0),
            total_migrations=per_event.get("key_migrated", 0),
            total_policy_denials=policy_denials,
            per_scheme_usage=dict(per_scheme),
            per_event_type=dict(per_event),
        )


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
    return asdict(get_telemetry_engine().system_snapshot())