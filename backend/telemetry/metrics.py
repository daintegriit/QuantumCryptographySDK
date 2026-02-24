# backend/telemetry/metrics.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
import os

from telemetry.audit_log import read_events, DEFAULT_AUDIT_LOG_PATH


# ============================================================
# Helpers
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(ts: str) -> Optional[datetime]:
    """
    Parse ISO timestamp from our audit log.
    Returns None if parsing fails.
    """
    if not ts:
        return None
    try:
        # handles "...+00:00"
        return datetime.fromisoformat(ts)
    except Exception:
        # handles "...Z"
        try:
            if ts.endswith("Z"):
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _within_window(ts: Optional[datetime], since: datetime) -> bool:
    return (ts is not None) and (ts >= since)


def _safe_get(d: Dict[str, Any], path: List[str], default=None):
    cur = d
    for k in path:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


# ============================================================
# Metric Models
# ============================================================

@dataclass(frozen=True)
class MetricsSummary:
    generated_at_utc: str
    audit_log_path: str
    audit_log_events_total: int
    window_hours: int

    # event volumes
    events_in_window: int
    events_by_type: Dict[str, int]

    # key lifecycle / governance activity
    keygen_count: int
    rotate_count: int
    migrate_count: int
    active_key_set_count: int
    active_key_bootstrap_count: int
    migration_evaluation_count: int

    # crypto operations
    encrypt_count: int
    decrypt_count: int

    # policy
    policy_checks: int
    policy_allow: int
    policy_deny: int

    # misc
    unique_key_ids_seen: int
    unique_schemes_seen: int
    unique_parameter_sets_seen: int


# ============================================================
# Core Metrics Engine
# ============================================================

class MetricsEngine:
    """
    Derives aggregated metrics from the append-only audit log.
    """

    def __init__(self, audit_path: str = DEFAULT_AUDIT_LOG_PATH):
        self.audit_path = audit_path

    def summarize(self, window_hours: int = 24, limit_scan: Optional[int] = None) -> Dict[str, Any]:
        """
        Build a metrics summary over the last window_hours.

        limit_scan:
          Optional cap on how many most-recent events to scan (speed knob).
          If None, scans all events (fine for dev).
        """
        now = _utcnow()
        since = now - timedelta(hours=int(window_hours))

        events = list(read_events(audit_path=self.audit_path, limit=limit_scan))

        events_total = len(events)

        # window filter
        in_window: List[Dict[str, Any]] = []
        for e in events:
            ts = _parse_ts(e.get("timestamp_utc", ""))
            if _within_window(ts, since):
                in_window.append(e)

        # aggregate
        by_type: Dict[str, int] = {}
        key_ids = set()
        schemes = set()
        params = set()

        # counters
        keygen = rotate = migrate = 0
        active_key_set = active_key_bootstrap = 0
        migration_eval = 0

        encrypt = decrypt = 0

        policy_checks = policy_allow = policy_deny = 0

        for e in in_window:
            et = str(e.get("event_type", "unknown")).strip() or "unknown"
            by_type[et] = by_type.get(et, 0) + 1

            payload = e.get("payload") or {}

            # Common fields (if present)
            kid = payload.get("key_id")
            if kid:
                key_ids.add(kid)

            scheme = payload.get("scheme")
            if scheme:
                schemes.add(str(scheme))

            pset = payload.get("parameter_set")
            if pset:
                params.add(str(pset))

            # Classify major event types
            if et in ("keygen", "key_generated", "key_created"):
                keygen += 1
            elif et in ("key_rotated",):
                rotate += 1
            elif et in ("key_migrated",):
                migrate += 1
            elif et in ("active_key_set",):
                active_key_set += 1
            elif et in ("active_key_bootstrap",):
                active_key_bootstrap += 1
            elif et in ("migration_evaluation",):
                migration_eval += 1
            elif et in ("encrypt",):
                encrypt += 1
            elif et in ("decrypt",):
                decrypt += 1

            # Policy checks can show up in your security_store JSONL too;
            # we support both shapes:
            # 1) audit_log.py wrapper: {event_type:"policy_check", payload:{...}}
            # 2) security_store append: {event_type:"policy_check", result:{allowed:...}}
            if et.startswith("policy_check"):
                policy_checks += 1

                # try both patterns
                allowed = _safe_get(e, ["payload", "allowed"], None)
                if allowed is None:
                    allowed = _safe_get(e, ["result", "allowed"], None)

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
            events_by_type=dict(sorted(by_type.items(), key=lambda kv: kv[0])),

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


# ============================================================
# Convenience helper
# ============================================================

_engine_singleton: Optional[MetricsEngine] = None


def get_metrics_engine() -> MetricsEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = MetricsEngine()
    return _engine_singleton


def get_metrics(window_hours: int = 24, limit_scan: Optional[int] = None) -> Dict[str, Any]:
    return get_metrics_engine().summarize(window_hours=window_hours, limit_scan=limit_scan)