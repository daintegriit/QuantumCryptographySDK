# backend/ai/anomaly.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from telemetry.telemetry import get_telemetry_engine
from telemetry.replay import get_replay_engine
from telemetry.metrics import get_metrics_engine


# ============================================================
# Models
# ============================================================

@dataclass(frozen=True)
class AnomalyFinding:
    anomaly_type: str
    severity: str               # LOW | MEDIUM | HIGH | CRITICAL
    key_id: Optional[str]
    detected_at_utc: str
    reason: str
    evidence: Dict[str, Any]


@dataclass(frozen=True)
class AnomalyReport:
    generated_at_utc: str
    window_hours: int
    total_findings: int
    findings: List[AnomalyFinding]


# ============================================================
# Anomaly Engine
# ============================================================

class AnomalyEngine:
    """
    Deterministic anomaly detection for cryptographic governance.

    DESIGN PRINCIPLES:
      - No probabilistic ML
      - No hallucination risk
      - Fully explainable findings
      - Replay & audit derived
    """

    def __init__(self):
        self.telemetry = get_telemetry_engine()
        self.replay = get_replay_engine()
        self.metrics = get_metrics_engine()

    # ------------------------------------------------
    # Public API
    # ------------------------------------------------

    def scan(
        self,
        *,
        window_hours: int = 24,
        limit_scan: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Run anomaly detection over recent governance activity.
        """
        findings: List[AnomalyFinding] = []
        now = datetime.now(timezone.utc)

        # --------------------------------------------
        # 1. Metrics-based anomalies
        # --------------------------------------------
        metrics = self.metrics.summarize(
            window_hours=window_hours,
            limit_scan=limit_scan,
        )

        findings.extend(self._detect_metrics_anomalies(metrics, now))

        # --------------------------------------------
        # 2. Key-level telemetry anomalies
        # --------------------------------------------
        system = self.telemetry.system_snapshot()

        for key_id in self._list_seen_keys():
            summary = self.telemetry.summarize_key(key_id)
            if summary:
                findings.extend(
                    self._detect_key_anomalies(summary, now)
                )

        # --------------------------------------------
        # 3. Replay-based lifecycle anomalies
        # --------------------------------------------
        findings.extend(
            self._detect_replay_anomalies(now)
        )

        report = AnomalyReport(
            generated_at_utc=now.isoformat(),
            window_hours=window_hours,
            total_findings=len(findings),
            findings=findings,
        )

        return asdict(report)

    # ============================================================
    # Detection Layers
    # ============================================================

    # ------------------------------------------------
    # Metrics anomalies (system-wide)
    # ------------------------------------------------

    def _detect_metrics_anomalies(
        self,
        metrics: Dict[str, Any],
        now: datetime,
    ) -> List[AnomalyFinding]:
        findings: List[AnomalyFinding] = []

        # Sudden policy denial spike
        if metrics.get("policy_deny", 0) > 0:
            ratio = 0.0
            if metrics.get("policy_checks", 0) > 0:
                ratio = metrics["policy_deny"] / metrics["policy_checks"]

            if ratio > 0.1:
                findings.append(
                    AnomalyFinding(
                        anomaly_type="POLICY_DENIAL_SPIKE",
                        severity="HIGH" if ratio > 0.25 else "MEDIUM",
                        key_id=None,
                        detected_at_utc=now.isoformat(),
                        reason="Unusual rate of policy denials detected",
                        evidence={
                            "policy_checks": metrics["policy_checks"],
                            "policy_denials": metrics["policy_deny"],
                            "deny_ratio": round(ratio, 3),
                        },
                    )
                )

        # Excessive migrations in short window
        if metrics.get("migrate_count", 0) >= 3:
            findings.append(
                AnomalyFinding(
                    anomaly_type="MASS_KEY_MIGRATION",
                    severity="CRITICAL",
                    key_id=None,
                    detected_at_utc=now.isoformat(),
                    reason="Multiple key migrations occurred in a short time window",
                    evidence={
                        "migrations": metrics["migrate_count"],
                        "window_hours": metrics["window_hours"],
                    },
                )
            )

        return findings

    # ------------------------------------------------
    # Per-key telemetry anomalies
    # ------------------------------------------------

    def _detect_key_anomalies(
        self,
        summary,
        now: datetime,
    ) -> List[AnomalyFinding]:
        findings: List[AnomalyFinding] = []

        # Excessive encryption volume (possible misuse)
        if summary.encrypt_count > 10_000:
            findings.append(
                AnomalyFinding(
                    anomaly_type="EXCESSIVE_KEY_USAGE",
                    severity="MEDIUM",
                    key_id=summary.key_id,
                    detected_at_utc=now.isoformat(),
                    reason="Key used for unusually high number of encryptions",
                    evidence={
                        "encrypt_count": summary.encrypt_count,
                    },
                )
            )

        # Repeated rotations
        if summary.rotation_count >= 3:
            findings.append(
                AnomalyFinding(
                    anomaly_type="FREQUENT_ROTATIONS",
                    severity="HIGH",
                    key_id=summary.key_id,
                    detected_at_utc=now.isoformat(),
                    reason="Key has been rotated unusually often",
                    evidence={
                        "rotation_count": summary.rotation_count,
                    },
                )
            )

        # Policy denials tied to a single key
        if summary.policy_denials > 0:
            findings.append(
                AnomalyFinding(
                    anomaly_type="KEY_POLICY_DENIAL",
                    severity="MEDIUM",
                    key_id=summary.key_id,
                    detected_at_utc=now.isoformat(),
                    reason="Policy denial associated with key usage",
                    evidence={
                        "policy_denials": summary.policy_denials,
                    },
                )
            )

        return findings

    # ------------------------------------------------
    # Replay-based anomalies (lifecycle logic)
    # ------------------------------------------------

    def _detect_replay_anomalies(
        self,
        now: datetime,
    ) -> List[AnomalyFinding]:
        findings: List[AnomalyFinding] = []

        timelines = self.replay.replay_all_keys().get("timelines", {})

        for key_id, tl in timelines.items():
            events = tl.get("events", [])

            # Migration without prior evaluation
            has_eval = any(e["event_type"] == "migration_evaluation" for e in events)
            has_migration = any(e["event_type"] == "key_migrated" for e in events)

            if has_migration and not has_eval:
                findings.append(
                    AnomalyFinding(
                        anomaly_type="UNJUSTIFIED_MIGRATION",
                        severity="CRITICAL",
                        key_id=key_id,
                        detected_at_utc=now.isoformat(),
                        reason="Key was migrated without a recorded migration evaluation",
                        evidence={
                            "events": [e["event_type"] for e in events],
                        },
                    )
                )

            # Rotation shortly after creation
            created = tl.get("created_at_utc")
            if created:
                try:
                    created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    for e in events:
                        if e["event_type"] == "key_rotated":
                            rotated_dt = datetime.fromisoformat(
                                e["timestamp_utc"].replace("Z", "+00:00")
                            )
                            if (rotated_dt - created_dt) < timedelta(minutes=10):
                                findings.append(
                                    AnomalyFinding(
                                        anomaly_type="EARLY_ROTATION",
                                        severity="HIGH",
                                        key_id=key_id,
                                        detected_at_utc=now.isoformat(),
                                        reason="Key rotated shortly after creation",
                                        evidence={
                                            "created_at": created,
                                            "rotated_at": e["timestamp_utc"],
                                        },
                                    )
                                )
                except Exception:
                    continue

        return findings

    # ============================================================
    # Helpers
    # ============================================================

    def _list_seen_keys(self) -> List[str]:
        snap = self.telemetry.system_snapshot()
        # Keys are inferred from audit logs; replay engine already enumerates them
        timelines = self.replay.replay_all_keys().get("timelines", {})
        return list(timelines.keys())


# ============================================================
# Convenience helpers
# ============================================================

_engine_singleton: Optional[AnomalyEngine] = None


def get_anomaly_engine() -> AnomalyEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = AnomalyEngine()
    return _engine_singleton


def run_anomaly_scan(
    window_hours: int = 24,
    limit_scan: Optional[int] = None,
) -> Dict[str, Any]:
    return get_anomaly_engine().scan(
        window_hours=window_hours,
        limit_scan=limit_scan,
    )