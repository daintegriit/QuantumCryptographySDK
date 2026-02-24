# backend/key_management/migration.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from key_management.registry import (
    get_scheme_profile,
    get_expected_quantum_break_year,
)
from key_management.rotation import RotationEngine
from key_management.lifecycle import KeyLifecycleEngine
from policy.security_store import record_key_event


# ============================================================
# Models
# ============================================================

@dataclass(frozen=True)
class MigrationDecision:
    """
    Result of a migration evaluation.
    """
    key_id: str
    scheme: str
    parameter_set: str
    current_year: int
    estimated_quantum_break_year: Optional[int]
    years_of_margin: Optional[int]
    migration_required: bool
    migration_reason: str
    recommended_target_scheme: Optional[str]
    severity: str  # OK | MONITOR | MIGRATE_SOON | EMERGENCY


# ============================================================
# Migration Engine
# ============================================================

class MigrationEngine:
    """
    Long-horizon cryptographic migration engine.

    Purpose:
      - Anticipate quantum capability growth
      - Enforce migration BEFORE cryptographic failure
      - Provide auditable justification for rotations

    This is a GOVERNANCE engine, not crypto math.
    """

    def __init__(self):
        self.rotation = RotationEngine()
        self.lifecycle = KeyLifecycleEngine()

    # ------------------------------------------------
    # Core evaluation
    # ------------------------------------------------

    def evaluate_key_migration(
        self,
        *,
        key_id: str,
        current_year: Optional[int] = None,
        safety_margin_years: int = 10,
    ) -> MigrationDecision:
        """
        Evaluate whether a key must be migrated due to future quantum risk.

        safety_margin_years:
          Number of years BEFORE estimated break that migration is required.
        """
        current_year = current_year or datetime.now(timezone.utc).year

        status = self.lifecycle.evaluate_key_id(key_id, audit=False)

        scheme = status.scheme
        parameter_set = status.parameter_set

        break_year = get_expected_quantum_break_year(scheme)

        if break_year is None:
            return MigrationDecision(
                key_id=key_id,
                scheme=scheme,
                parameter_set=parameter_set,
                current_year=current_year,
                estimated_quantum_break_year=None,
                years_of_margin=None,
                migration_required=False,
                migration_reason="No quantum break estimate available",
                recommended_target_scheme=None,
                severity="MONITOR",
            )

        years_left = break_year - current_year

        # -------------------------------
        # Decision thresholds
        # -------------------------------
        if years_left <= 0:
            severity = "EMERGENCY"
            migrate = True
            reason = "Estimated quantum break year exceeded"
        elif years_left <= safety_margin_years:
            severity = "MIGRATE_SOON"
            migrate = True
            reason = f"Within safety margin ({safety_margin_years}y)"
        elif years_left <= safety_margin_years * 2:
            severity = "MONITOR"
            migrate = False
            reason = "Approaching long-term risk horizon"
        else:
            severity = "OK"
            migrate = False
            reason = "Sufficient quantum safety margin"

        # Recommend next scheme (simple rule: highest-priority PQC)
        recommended = None
        if migrate:
            # Currently ML-KEM is baseline; future-proof for extension
            recommended = "ML-KEM"

        decision = MigrationDecision(
            key_id=key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            current_year=current_year,
            estimated_quantum_break_year=break_year,
            years_of_margin=years_left,
            migration_required=migrate,
            migration_reason=reason,
            recommended_target_scheme=recommended,
            severity=severity,
        )

        # Audit trail (critical for gov compliance)
        record_key_event(
            event_type="migration_evaluation",
            key_id=key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            metadata=asdict(decision),
        )

        return decision

    # ------------------------------------------------
    # Execute migration
    # ------------------------------------------------

    def migrate_key_if_needed(
        self,
        *,
        key_id: str,
        force: bool = False,
    ) -> Dict[str, any]:
        """
        Perform migration if required.
        """
        decision = self.evaluate_key_migration(key_id=key_id)

        if not decision.migration_required and not force:
            return {
                "migrated": False,
                "decision": asdict(decision),
                "message": "Migration not required",
            }

        # Perform rotation (this is the actual migration)
        result = self.rotation.rotate_if_needed(
            key_id,
            target_scheme=decision.recommended_target_scheme,
            force=True,
            set_active=True,
        )

        record_key_event(
            event_type="key_migrated",
            key_id=key_id,
            metadata={
                "decision": asdict(decision),
                "rotation_result": result,
            },
        )

        return {
            "migrated": True,
            "decision": asdict(decision),
            "rotation": result,
        }


# ============================================================
# Convenience helpers
# ============================================================

_engine_singleton: Optional[MigrationEngine] = None


def get_migration_engine() -> MigrationEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = MigrationEngine()
    return _engine_singleton


def evaluate_migration(key_id: str) -> Dict:
    eng = get_migration_engine()
    return asdict(eng.evaluate_key_migration(key_id=key_id))


def migrate_key(key_id: str, force: bool = False) -> Dict:
    eng = get_migration_engine()
    return eng.migrate_key_if_needed(key_id=key_id, force=force)