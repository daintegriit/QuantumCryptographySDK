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


@dataclass(frozen=True)
class MigrationDecision:
    key_id: str
    scheme: str
    parameter_set: str
    current_year: int
    estimated_quantum_break_year: Optional[int]
    years_of_margin: Optional[int]
    migration_required: bool
    migration_reason: str
    recommended_target_scheme: Optional[str]
    severity: str


class MigrationEngine:

    def __init__(self):
        self.rotation = RotationEngine()
        self.lifecycle = KeyLifecycleEngine()

    def evaluate_key_migration(
        self,
        *,
        key_id: str,
        current_year: Optional[int] = None,
        safety_margin_years: int = 10,
    ) -> MigrationDecision:
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

        recommended = "ML-KEM" if migrate else None

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

        record_key_event(
            event_type="migration_evaluation",
            key_id=key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            metadata=asdict(decision),
        )

        return decision

    def migrate_key_if_needed(
        self,
        *,
        key_id: str,
        force: bool = False,
    ) -> Dict:
        decision = self.evaluate_key_migration(key_id=key_id)

        if not decision.migration_required and not force:
            return {
                "migrated": False,
                "decision": asdict(decision),
                "message": "Migration not required",
            }

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


_engine_singleton: Optional[MigrationEngine] = None


def get_migration_engine() -> MigrationEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = MigrationEngine()
    return _engine_singleton


def evaluate_migration(key_id: str) -> Dict:
    return asdict(get_migration_engine().evaluate_key_migration(key_id=key_id))


def migrate_key(key_id: str, force: bool = False) -> Dict:
    return get_migration_engine().migrate_key_if_needed(key_id=key_id, force=force)
