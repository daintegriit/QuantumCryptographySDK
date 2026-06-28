# backend/telemetry/metrics.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from telemetry.audit_log import read_events, DEFAULT_AUDIT_LOG_PATH


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts)
    except Exception:
        try:
            if ts.endswith("Z"):
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _within_window(ts: Optional[datetime], since: datetime) -> bool:
    return (ts is not None) and (ts >= since)


@dataclass(frozen=True)
class MetricsSummary:
    generated_at_utc: str
    audit_log_path: str
    audit_log_events_total: int
    window_hours: int
    events_in_window: int
    events_by_type: Dict[str, int]
    keygen_count: int
    rotate_count: int
    migrate_count: int
    active_key_set_count: int
    active_key_bootstrap_count: int
    migration_evaluation_count: int
    encrypt_count: int
    decrypt_count: int
    policy_checks: int
    policy_allow: int
    policy_deny: int
    unique_key_ids_seen: int
    unique_schemes_seen: int
    unique_parameter_sets_seen: int


class MetricsEngine:

    def __init__(self, audit_path: str = DEFAULT_AUDIT_LOG_PATH):
        self.audit_path = audit_path

    def summarize(self, window_hours: int = 24, limit_scan: Optional[int] = None) -> Dict[str, Any]:
        now = _utcnow()
        since = now - timedelta(hours=int(window_hours))

        # BUG FIX: read_events() now normalizes events by default,
        # so e["key_id"], e["scheme"], e["parameter_set"], e["result"]
        # are all top-level regardless of which writer produced the event.
        # Original code used e.get("payload", {}).get(...) which silently
        # dropped all flat events from security_store.
        events = list(read_events(audit_path=self.audit_path, limit=limit_scan))
        events_total = len(events)

        in_window: List[Dict[str, Any]] = [
            e for e in events
            if _within_window(_parse_ts(e.get("timestamp_utc", "")), since)
        ]

        by_type: Dict[str, int] = {}
        key_ids = set()
        schemes = set()
        params = set()

        keygen = rotate = migrate = 0
        active_key_set = active_key_bootstrap = 0
        migration_eval = 0
        encrypt = decrypt = 0
        policy_checks = policy_allow = policy_deny = 0

        for e in in_window:
            et = str(e.get("event_type", "unknown")).strip() or "unknown"
            by_type[et] = by_type.get(et, 0) + 1

            # BUG FIX: all fields now normalized to top level
            kid = e.get("key_id")
            if kid:
                key_ids.add(kid)

            scheme = e.get("scheme")
            if scheme:
                schemes.add(str(scheme))

            pset = e.get("parameter_set")
            if pset:
                params.add(str(pset))

            if et in ("keygen", "key_generated", "key_created"):
                keygen += 1
            elif et == "key_rotated":
                rotate += 1
            elif et == "key_migrated":
                migrate += 1
            elif et == "active_key_set":
                active_key_set += 1
            elif et == "active_key_bootstrap":
                active_key_bootstrap += 1
            elif et == "migration_evaluation":
                migration_eval += 1
            elif et == "encrypt":
                encrypt += 1
            elif et == "decrypt":
                decrypt += 1

            if et.startswith("policy_check"):
                policy_checks += 1
                # BUG FIX: result is now always top-level after normalization
                allowed = e.get("result", {}).get("allowed")
                if allowed is True:
                    policy_allow += 1
                elif allowed is False:
                    policy_deny += 1

        summary = MetricsSummary(
            generated_at_utc=now.isoformat(),
            audit_log_path=self.audit_path,
            audit_log_events_total=events_total,
            window_hours=int(window_hours),
            events_in_window=len(in_window),
            events_by_type=dict(sorted(by_type.items())),
            keygen_count=keygen,
            rotate_count=rotate,
            migrate_count=migrate,
            active_key_set_count=active_key_set,
            active_key_bootstrap_count=active_key_bootstrap,
            migration_evaluation_count=migration_eval,
            encrypt_count=encrypt,
            decrypt_count=decrypt,
            policy_checks=policy_checks,
            policy_allow=policy_allow,
            policy_deny=policy_deny,
            unique_key_ids_seen=len(key_ids),
            unique_schemes_seen=len(schemes),
            unique_parameter_sets_seen=len(params),
        )

        return asdict(summary)


_engine_singleton: Optional[MetricsEngine] = None


def get_metrics_engine() -> MetricsEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = MetricsEngine()
    return _engine_singleton


def get_metrics(window_hours: int = 24, limit_scan: Optional[int] = None) -> Dict[str, Any]:
    return get_metrics_engine().summarize(window_hours=window_hours, limit_scan=limit_scan)