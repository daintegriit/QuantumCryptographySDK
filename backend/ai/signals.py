# backend/ai/signals.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, Optional

from key_management.lifecycle import KeyLifecycleEngine
from key_management.migration import MigrationEngine
from telemetry.telemetry import get_telemetry_engine
from key_management.keygen import get_keygen_engine


# ============================================================
# Models
# ============================================================

@dataclass(frozen=True)
class KeySignals:
    key_id: str

    # lifecycle
    lifecycle_severity: str
    lifecycle_reason: str

    # quantum horizon
    quantum_break_year: Optional[int]
    quantum_margin_years: Optional[int]
    quantum_risk: bool

    # usage / behavior
    encrypt_count: int
    decrypt_count: int
    policy_denials: int
    last_used_utc: Optional[str]

    # governance conclusions
    early_rotation: bool
    migration_required: bool
    overall_risk_level: str   # LOW | MEDIUM | HIGH | CRITICAL

    generated_at_utc: str


# ============================================================
# Signals Engine
# ============================================================

class SignalsEngine:
    """
    Deterministic explainability signals for cryptographic governance.

    This engine:
      - NEVER mutates keys
      - NEVER guesses
      - ONLY derives facts from existing engines
    """

    def __init__(self):
        self.lifecycle = KeyLifecycleEngine()
        self.migration = MigrationEngine()
        self.telemetry = get_telemetry_engine()
        self.keygen = get_keygen_engine()

    # ------------------------------------------------
    # Per-key signals
    # ------------------------------------------------

    def derive_key_signals(self, key_id: str) -> Dict[str, any]:
        key = self.keygen.get(key_id)
        if not key:
            raise ValueError("Key not found")

        lifecycle = self.lifecycle.evaluate_key_id(key_id, audit=False)
        migration = self.migration.evaluate_key_migration(key_id=key_id)
        telemetry = self.telemetry.summarize_key(key_id)

        quantum_margin = migration.years_of_margin
        quantum_risk = (
            quantum_margin is not None
            and quantum_margin <= 10
        )

        early_rotation = lifecycle.severity in (
            "ROTATE_SOON",
            "DEPRECATED",
            "BLOCKED",
        )

        # Risk synthesis (deterministic rules)
        if lifecycle.severity == "BLOCKED" or quantum_margin is not None and quantum_margin <= 0:
            risk = "CRITICAL"
        elif quantum_risk or lifecycle.severity == "ROTATE_SOON":
            risk = "HIGH"
        elif telemetry and telemetry.policy_denials > 0:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        signals = KeySignals(
            key_id=key_id,

            lifecycle_severity=lifecycle.severity,
            lifecycle_reason=lifecycle.reason,

            quantum_break_year=migration.estimated_quantum_break_year,
            quantum_margin_years=quantum_margin,
            quantum_risk=quantum_risk,

            encrypt_count=telemetry.encrypt_count if telemetry else 0,
            decrypt_count=telemetry.decrypt_count if telemetry else 0,
            policy_denials=telemetry.policy_denials if telemetry else 0,
            last_used_utc=telemetry.last_used_utc if telemetry else None,

            early_rotation=early_rotation,
            migration_required=migration.migration_required,
            overall_risk_level=risk,

            generated_at_utc=datetime.now(timezone.utc).isoformat(),
        )

        return asdict(signals)


# ============================================================
# Convenience helpers
# ============================================================

_engine_singleton: Optional[SignalsEngine] = None


def get_signals_engine() -> SignalsEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = SignalsEngine()
    return _engine_singleton


def get_key_signals(key_id: str) -> Dict[str, any]:
    return get_signals_engine().derive_key_signals(key_id)