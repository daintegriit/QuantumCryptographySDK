# backend/telemetry/policy_drift.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from collections import Counter

from telemetry.audit_log import read_events, DEFAULT_AUDIT_LOG_PATH


@dataclass(frozen=True)
class PolicyDriftResult:
    generated_at_utc: str
    baseline_window_days: int
    comparison_window_days: int
    policy_checks_baseline: int
    policy_checks_recent: int
    deny_rate_baseline: float
    deny_rate_recent: float
    deny_rate_delta: float
    scheme_usage_baseline: Dict[str, int]
    scheme_usage_recent: Dict[str, int]
    drift_detected: bool
    drift_severity: str
    explanation: List[str]


class PolicyDriftEngine:

    def __init__(self, audit_path: str = DEFAULT_AUDIT_LOG_PATH):
        self.audit_path = audit_path

    def analyze(
        self,
        *,
        baseline_days: int = 90,
        recent_days: int = 14,
        limit_scan: Optional[int] = None,
    ) -> Dict[str, Any]:

        now = datetime.now(timezone.utc)
        baseline_since = now - timedelta(days=baseline_days)
        recent_since = now - timedelta(days=recent_days)

        # BUG FIX: read_events() now normalizes by default.
        # Original used e.get("result", {}).get("allowed") which worked
        # for flat security_store events but failed for payload-wrapped
        # events where "result" was nested under "payload".
        # After normalization, "result" is always top-level.
        events = list(read_events(audit_path=self.audit_path, limit=limit_scan))

        baseline_events = []
        recent_events = []

        for e in events:
            ts = e.get("timestamp_utc")
            if not ts:
                continue
            try:
                ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                continue

            if ts_dt >= recent_since:
                recent_events.append(e)
            elif ts_dt >= baseline_since:
                baseline_events.append(e)

        def _extract_policy_stats(evts: List[Dict[str, Any]]):
            checks = 0
            denies = 0
            schemes: Counter = Counter()

            for e in evts:
                if e.get("event_type") != "policy_check":
                    continue

                checks += 1

                # BUG FIX: after normalization, result is top-level
                allowed = e.get("result", {}).get("allowed")
                if allowed is False:
                    denies += 1

                # BUG FIX: after normalization, scheme is top-level
                scheme = e.get("scheme")
                if scheme:
                    schemes[str(scheme)] += 1

            deny_rate = denies / checks if checks > 0 else 0.0
            return checks, deny_rate, dict(schemes)

        b_checks, b_deny_rate, b_schemes = _extract_policy_stats(baseline_events)
        r_checks, r_deny_rate, r_schemes = _extract_policy_stats(recent_events)

        delta = r_deny_rate - b_deny_rate

        explanations: List[str] = []
        drift = False
        severity = "NONE"

        if abs(delta) > 0.05:
            drift = True
            explanations.append(
                f"Policy deny rate changed by {delta:+.2%} (baseline → recent)"
            )

        new_schemes = set(r_schemes) - set(b_schemes)
        if new_schemes:
            drift = True
            explanations.append(
                f"New cryptographic schemes observed: {sorted(new_schemes)}"
            )

        if drift:
            if abs(delta) > 0.15 or new_schemes:
                severity = "HIGH"
            elif abs(delta) > 0.08:
                severity = "MEDIUM"
            else:
                severity = "LOW"

        if not explanations:
            explanations.append("No significant policy drift detected")

        return asdict(PolicyDriftResult(
            generated_at_utc=now.isoformat(),
            baseline_window_days=baseline_days,
            comparison_window_days=recent_days,
            policy_checks_baseline=b_checks,
            policy_checks_recent=r_checks,
            deny_rate_baseline=b_deny_rate,
            deny_rate_recent=r_deny_rate,
            deny_rate_delta=delta,
            scheme_usage_baseline=b_schemes,
            scheme_usage_recent=r_schemes,
            drift_detected=drift,
            drift_severity=severity,
            explanation=explanations,
        ))


_engine: Optional[PolicyDriftEngine] = None


def get_policy_drift_engine() -> PolicyDriftEngine:
    global _engine
    if _engine is None:
        _engine = PolicyDriftEngine()
    return _engine


def detect_policy_drift(
    baseline_days: int = 90,
    recent_days: int = 14,
    limit_scan: Optional[int] = None,
) -> Dict[str, Any]:
    return get_policy_drift_engine().analyze(
        baseline_days=baseline_days,
        recent_days=recent_days,
        limit_scan=limit_scan,
    )