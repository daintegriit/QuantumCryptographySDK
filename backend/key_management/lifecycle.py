# backend/key_management/lifecycle.py
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from key_management.keygen import (
    DEFAULT_KEYSTORE_DIR,
    _key_path,  # ok to reuse internal helper
)

from policy.security_store import (
    check_key_allowed,
    record_key_event,
)

# ============================================================
# Helpers
# ============================================================

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

def _parse_iso(dt_str: str) -> datetime:
    # Handles "2025-01-01T00:00:00+00:00"
    return datetime.fromisoformat(dt_str)

def _safe_int(x: Any, default: int = 0) -> int:
    try:
        return int(x)
    except Exception:
        return default

def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return default

def _pct(a: float, b: float) -> float:
    if b <= 0:
        return 0.0
    return max(0.0, min(1.0, a / b))


# ============================================================
# Lifecycle status model
# ============================================================

@dataclass(frozen=True)
class KeyLifecycleStatus:
    key_id: str

    # Identity
    scheme: str
    parameter_set: str
    claimed_security_level: str

    # Time
    created_at_utc: str
    age_days: int

    # Longevity + rotation
    estimated_longevity_years: int
    expires_at_utc: str
    rotation_recommended_at_utc: str
    rotation_due_in_days: int

    # Policy outcome (current, re-evaluated)
    allowed: bool
    risk_score: float
    severity: str                 # OK | MONITOR | ROTATE_SOON | DEPRECATED | BLOCKED
    warnings: List[str]
    required_actions: List[str]

    # Explainability
    reason: str                   # one-line summary
    evaluated_at_utc: str


# ============================================================
# Core evaluator
# ============================================================

class KeyLifecycleEngine:
    """
    Re-evaluates stored keys against *current* policy to support 30–50 year claims.

    - Reads keystore JSON
    - Runs policy check
    - Computes rotation schedule + severity
    - Emits audit events when key becomes risky/deprecated
    """

    def __init__(self, keystore_dir: Path = DEFAULT_KEYSTORE_DIR):
        self.keystore_dir = Path(keystore_dir).resolve()
        self.keystore_dir.mkdir(parents=True, exist_ok=True)

        # You can tune these later without changing callers:
        self.rotation_fraction = float(os.getenv("QS_ROTATION_FRACTION", "0.70"))
        # e.g. rotate at 70% of claimed longevity
        self.rotate_soon_threshold = float(os.getenv("QS_ROTATE_SOON_THRESHOLD", "0.85"))
        # e.g. "rotate soon" after 85% of claimed longevity
        self.deprecate_threshold = float(os.getenv("QS_DEPRECATE_THRESHOLD", "1.00"))
        # e.g. "deprecated" at >= 100% of claimed longevity

        # Optional: add a fixed minimum rotation lead time (days)
        self.minimum_rotation_lead_days = _safe_int(
            os.getenv("QS_MIN_ROTATION_LEAD_DAYS", "30"),
            default=30,
        )

    # -------------------------
    # Public API
    # -------------------------

    def evaluate_key_id(
        self,
        key_id: str,
        compliance_tags: Optional[List[str]] = None,
        audit: bool = True,
    ) -> KeyLifecycleStatus:
        record = self._load_key_record(key_id)
        if record is None:
            raise FileNotFoundError(f"Key not found: {key_id}")
        return self.evaluate_record(record, compliance_tags=compliance_tags, audit=audit)

    def evaluate_record(
        self,
        record: Dict[str, Any],
        compliance_tags: Optional[List[str]] = None,
        audit: bool = True,
    ) -> KeyLifecycleStatus:
        compliance_tags = compliance_tags or []

        key_id = str(record.get("key_id", ""))
        scheme = str(record.get("algorithm", record.get("scheme", "unknown")))

        parameter_set = str(record.get("parameter_set", "unknown"))
        claimed_security_level = str(record.get("security_level", "unknown"))

        created_at_utc = str(record.get("created_at_utc") or record.get("created_at") or "")
        if not created_at_utc:
            # If missing, treat as now (but flag)
            created_dt = _utc_now()
            created_at_utc = created_dt.isoformat()
        else:
            created_dt = _parse_iso(created_at_utc)

        estimated_longevity_years = _safe_int(record.get("estimated_longevity_years", 0), default=0)

        now = _utc_now()
        age_days = max(0, (now - created_dt).days)

        # Longevity timeline (conservative scaffolding)
        longevity_days = max(1, estimated_longevity_years * 365)
        expires_at = created_dt + timedelta(days=longevity_days)

        # Rotate at fraction of longevity, but never less than minimum lead time
        rotate_at = created_dt + timedelta(days=int(longevity_days * self.rotation_fraction))
        min_rotate_at = expires_at - timedelta(days=self.minimum_rotation_lead_days)
        if rotate_at > min_rotate_at:
            rotate_at = min_rotate_at

        rotation_due_in_days = (rotate_at - now).days

        # -------------------------
        # Policy re-check (current truth)
        # -------------------------
        policy = check_key_allowed(
            scheme=scheme,
            parameter_set=parameter_set,
            claimed_security_level=claimed_security_level,
            estimated_longevity_years=estimated_longevity_years,
            migration_ready=True,
            is_deprecated=False,
            compliance_tags=compliance_tags,
            audit=audit,
        )

        allowed = bool(policy.get("allowed", False))
        risk_score = _safe_float(policy.get("risk_score", 0.0), default=0.0)
        warnings = list(policy.get("warnings", [])) if policy.get("warnings") else []
        required_actions = list(policy.get("required_actions", [])) if policy.get("required_actions") else []

        # -------------------------
        # Severity based on BOTH:
        # - policy allowed/block
        # - time into longevity
        # -------------------------
        used_fraction = _pct(age_days, float(longevity_days))

        if not allowed:
            severity = "BLOCKED"
            reason = "Policy no longer permits this key configuration."
        else:
            if used_fraction >= self.deprecate_threshold:
                severity = "DEPRECATED"
                reason = "Key has reached end-of-life window; rotate immediately."
            elif used_fraction >= self.rotate_soon_threshold:
                severity = "ROTATE_SOON"
                reason = "Key is approaching end-of-life; schedule rotation."
            elif now >= rotate_at:
                severity = "MONITOR"
                reason = "Rotation recommended; key still allowed but should be replaced."
            else:
                severity = "OK"
                reason = "Key is within acceptable policy and longevity window."

        evaluated_at_utc = now.isoformat()

        status = KeyLifecycleStatus(
            key_id=key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            claimed_security_level=claimed_security_level,
            created_at_utc=created_at_utc,
            age_days=age_days,
            estimated_longevity_years=estimated_longevity_years,
            expires_at_utc=expires_at.isoformat(),
            rotation_recommended_at_utc=rotate_at.isoformat(),
            rotation_due_in_days=rotation_due_in_days,
            allowed=allowed,
            risk_score=risk_score,
            severity=severity,
            warnings=warnings,
            required_actions=required_actions,
            reason=reason,
            evaluated_at_utc=evaluated_at_utc,
        )

        # -------------------------
        # Audit transitions (optional)
        # -------------------------
        if audit and severity in ("ROTATE_SOON", "DEPRECATED", "BLOCKED"):
            record_key_event(
                event_type="key_lifecycle_alert",
                key_id=key_id,
                scheme=scheme,
                parameter_set=parameter_set,
                metadata={
                    "severity": severity,
                    "reason": reason,
                    "risk_score": risk_score,
                    "required_actions": required_actions,
                    "warnings": warnings,
                    "age_days": age_days,
                    "estimated_longevity_years": estimated_longevity_years,
                    "rotation_recommended_at_utc": status.rotation_recommended_at_utc,
                    "expires_at_utc": status.expires_at_utc,
                },
            )

        return status

    def scan_keystore(
        self,
        limit: int = 200,
        compliance_tags: Optional[List[str]] = None,
        audit: bool = False,
    ) -> List[KeyLifecycleStatus]:
        """
        Evaluate many keys (newest first). Audit disabled by default for scans.
        """
        compliance_tags = compliance_tags or []
        files = sorted(
            self.keystore_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        out: List[KeyLifecycleStatus] = []
        for p in files[: max(1, int(limit))]:
            try:
                record = json.loads(p.read_text(encoding="utf-8"))
                out.append(self.evaluate_record(record, compliance_tags=compliance_tags, audit=audit))
            except Exception:
                continue
        return out

    # -------------------------
    # Internals
    # -------------------------

    def _load_key_record(self, key_id: str) -> Optional[Dict[str, Any]]:
        path = _key_path(key_id, self.keystore_dir)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))


# ============================================================
# Convenience helpers (API wiring later)
# ============================================================

_engine_singleton: Optional[KeyLifecycleEngine] = None

def get_lifecycle_engine() -> KeyLifecycleEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = KeyLifecycleEngine()
    return _engine_singleton

def evaluate_key_status(key_id: str) -> Dict[str, Any]:
    eng = get_lifecycle_engine()
    status = eng.evaluate_key_id(key_id, audit=True)
    return asdict(status)

def scan_key_status(limit: int = 100) -> List[Dict[str, Any]]:
    eng = get_lifecycle_engine()
    statuses = eng.scan_keystore(limit=limit, audit=False)
    return [asdict(s) for s in statuses]