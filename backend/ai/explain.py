# backend/ai/explain.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ai.signals import get_signals_engine
from key_management.keygen import get_keygen_engine
from policy.security_store import check_key_allowed
from key_management.migration import get_migration_engine
from key_management.lifecycle import KeyLifecycleEngine


# ============================================================
# Models
# ============================================================

@dataclass(frozen=True)
class ExplanationLine:
    level: str            # INFO | WARN | CRITICAL
    category: str         # POLICY | LIFECYCLE | QUANTUM | USAGE | GOVERNANCE
    message: str


@dataclass(frozen=True)
class KeyExplanation:
    key_id: str
    overall_risk_level: str
    headline: str

    # Derived facts
    lifecycle_severity: str
    quantum_margin_years: Optional[int]
    migration_required: bool
    policy_allowed: Optional[bool]

    # Actionable output
    required_actions: List[str]
    recommended_actions: List[str]
    warnings: List[str]

    # Human-readable narrative
    explanation: List[ExplanationLine]

    generated_at_utc: str


# ============================================================
# Explain Engine
# ============================================================

class ExplainEngine:
    """
    Deterministic governance explanations.

    Inputs:
      - key record (keystore)
      - policy decision (security_store)
      - migration decision (migration engine)
      - lifecycle status (lifecycle engine)
      - telemetry signals (signals engine)

    Output:
      - structured explanation suitable for:
          * dashboards
          * audits
          * professor / gov compliance narrative
    """

    def __init__(self):
        self.keys = get_keygen_engine()
        self.signals = get_signals_engine()
        self.migration = get_migration_engine()
        self.lifecycle = KeyLifecycleEngine()

    def explain_key(self, key_id: str, profile: str = "default") -> Dict[str, Any]:
        key = self.keys.get(key_id)
        if not key:
            raise ValueError("Key not found")

        # -----------------------------
        # Gather deterministic facts
        # -----------------------------
        sig = self.signals.derive_key_signals(key_id)
        mig = self.migration.evaluate_key_migration(key_id=key_id)
        life = self.lifecycle.evaluate_key_id(key_id, audit=False)

        # Policy decision (use stored metadata)
        policy = check_key_allowed(
            profile=profile,
            scheme=key.algorithm,
            parameter_set=key.parameter_set,
            claimed_security_level=key.security_level,
            estimated_longevity_years=key.estimated_longevity_years,
            migration_ready=True,
            is_deprecated=(life.severity in ("DEPRECATED", "BLOCKED")),
            compliance_tags=[],
            audit=True,  # keep evidence trail
        )
        policy_allowed = bool(policy.get("allowed", True))

        # -----------------------------
        # Build explanation lines
        # -----------------------------
        lines: List[ExplanationLine] = []
        required_actions: List[str] = []
        recommended_actions: List[str] = []
        warnings: List[str] = []

        # LIFECYCLE
        if life.severity == "BLOCKED":
            lines.append(ExplanationLine(
                level="CRITICAL",
                category="LIFECYCLE",
                message=f"Lifecycle status is BLOCKED: {life.reason}",
            ))
            required_actions.append("BLOCK_USAGE")
            required_actions.append("ROTATE_IMMEDIATELY")
        elif life.severity == "DEPRECATED":
            lines.append(ExplanationLine(
                level="CRITICAL",
                category="LIFECYCLE",
                message=f"Key is DEPRECATED: {life.reason}",
            ))
            required_actions.append("ROTATE_IMMEDIATELY")
        elif life.severity == "ROTATE_SOON":
            lines.append(ExplanationLine(
                level="WARN",
                category="LIFECYCLE",
                message=f"Key should rotate soon: {life.reason}",
            ))
            recommended_actions.append("ROTATE_SOON")
        else:
            lines.append(ExplanationLine(
                level="INFO",
                category="LIFECYCLE",
                message=f"Lifecycle status OK: {life.reason}",
            ))

        # QUANTUM / MIGRATION
        if mig.estimated_quantum_break_year is None:
            lines.append(ExplanationLine(
                level="WARN",
                category="QUANTUM",
                message="No quantum break estimate is available for this scheme; treat as MONITOR until registry is expanded.",
            ))
            warnings.append("NO_QUANTUM_BREAK_ESTIMATE")
        else:
            margin = mig.years_of_margin
            if margin is not None and margin <= 0:
                lines.append(ExplanationLine(
                    level="CRITICAL",
                    category="QUANTUM",
                    message=f"Quantum break horizon exceeded (break year {mig.estimated_quantum_break_year}); migration is emergency-required.",
                ))
                required_actions.append("MIGRATE_IMMEDIATELY")
            elif mig.migration_required:
                lines.append(ExplanationLine(
                    level="WARN",
                    category="QUANTUM",
                    message=f"Migration required within safety margin: {mig.migration_reason} (break year {mig.estimated_quantum_break_year}).",
                ))
                recommended_actions.append("MIGRATE_SOON")
            else:
                lines.append(ExplanationLine(
                    level="INFO",
                    category="QUANTUM",
                    message=f"Quantum horizon acceptable: {mig.migration_reason} (break year {mig.estimated_quantum_break_year}).",
                ))

        # POLICY
        if policy_allowed is False:
            lines.append(ExplanationLine(
                level="CRITICAL",
                category="POLICY",
                message="Policy engine DENIED this key configuration for the selected profile.",
            ))
            required_actions.append("BLOCK_USAGE")
            required_actions.append("FIX_PARAMETERS")
            warnings.extend(policy.get("warnings", []) or [])
        else:
            lines.append(ExplanationLine(
                level="INFO",
                category="POLICY",
                message="Policy engine ALLOWED this key configuration for the selected profile.",
            ))
            warnings.extend(policy.get("warnings", []) or [])

        # USAGE / TELEMETRY
        if sig.get("policy_denials", 0) > 0:
            lines.append(ExplanationLine(
                level="WARN",
                category="USAGE",
                message=f"Telemetry shows {sig['policy_denials']} policy denials associated with this key’s context.",
            ))
            recommended_actions.append("REVIEW_POLICY_DENIALS")

        if sig.get("encrypt_count", 0) + sig.get("decrypt_count", 0) == 0:
            lines.append(ExplanationLine(
                level="INFO",
                category="USAGE",
                message="Key has no recorded encryption/decryption usage yet (fresh or unused).",
            ))
        else:
            lines.append(ExplanationLine(
                level="INFO",
                category="USAGE",
                message=(
                    f"Usage counts: encrypt={sig.get('encrypt_count', 0)}, "
                    f"decrypt={sig.get('decrypt_count', 0)}; last_used={sig.get('last_used_utc')}"
                ),
            ))

        # GOVERNANCE synthesis
        overall_risk = sig.get("overall_risk_level", "LOW")
        headline = _headline_from_risk(overall_risk, policy_allowed, mig.migration_required, life.severity)

        # Safety defaults: dedupe lists
        required_actions = _uniq(required_actions)
        recommended_actions = _uniq(recommended_actions)
        warnings = _uniq([w for w in warnings if isinstance(w, str) and w.strip()])

        explanation = KeyExplanation(
            key_id=key_id,
            overall_risk_level=overall_risk,
            headline=headline,
            lifecycle_severity=life.severity,
            quantum_margin_years=mig.years_of_margin,
            migration_required=mig.migration_required,
            policy_allowed=policy_allowed,
            required_actions=required_actions,
            recommended_actions=recommended_actions,
            warnings=warnings,
            explanation=lines,
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
        )

        return asdict(explanation)


# ============================================================
# Helpers
# ============================================================

def _uniq(items: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def _headline_from_risk(
    risk: str,
    policy_allowed: bool,
    migration_required: bool,
    lifecycle_severity: str,
) -> str:
    if risk == "CRITICAL":
        return "CRITICAL: Key must be rotated/migrated immediately to remain compliant."
    if policy_allowed is False:
        return "DENIED: Key parameters are not allowed under the current policy profile."
    if migration_required:
        return "HIGH RISK: Migration is required within the defined quantum safety margin."
    if lifecycle_severity in ("ROTATE_SOON", "DEPRECATED"):
        return "WARNING: Key is approaching a governance threshold and should be rotated soon."
    return "OK: Key currently meets governance requirements and has acceptable risk posture."


# ============================================================
# Convenience helpers
# ============================================================

_engine_singleton: Optional[ExplainEngine] = None


def get_explain_engine() -> ExplainEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = ExplainEngine()
    return _engine_singleton


def explain_key(key_id: str, profile: str = "default") -> Dict[str, Any]:
    return get_explain_engine().explain_key(key_id=key_id, profile=profile)