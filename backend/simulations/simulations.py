# backend/simulations/simulations.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from key_management.registry import (
    get_scheme_profile,
    registry_snapshot,
)
from key_management.migration import MigrationEngine
from policy.security_store import record_key_event


# ============================================================
# Models
# ============================================================

@dataclass(frozen=True)
class YearlyRiskPoint:
    year: int
    estimated_quantum_break_year: Optional[int]
    years_of_margin: Optional[int]
    risk_level: str  # SAFE | MONITOR | MIGRATE_SOON | BROKEN


@dataclass(frozen=True)
class SimulationResult:
    key_id: str
    scheme: str
    parameter_set: str
    start_year: int
    horizon_years: int
    safety_margin_years: int
    timeline: List[YearlyRiskPoint]
    first_migration_year: Optional[int]
    worst_risk_level: str
    notes: str


# ============================================================
# Simulation Engine
# ============================================================

class MigrationSimulationEngine:
    """
    Forward-looking cryptographic durability simulator.

    Purpose:
      - Project cryptographic safety over time
      - Detect when migration becomes unavoidable
      - Support long-term (30–50y) planning
      - Provide quantitative backing for governance claims

    This engine does NOT guess cryptography.
    It models POLICY + RISK + TIME.
    """

    def __init__(self):
        self.migration = MigrationEngine()

    # ------------------------------------------------
    # Core simulation
    # ------------------------------------------------

    def simulate_key_lifespan(
        self,
        *,
        key_id: str,
        start_year: Optional[int] = None,
        horizon_years: int = 50,
        safety_margin_years: int = 10,
    ) -> SimulationResult:
        """
        Simulate cryptographic risk year-by-year.

        horizon_years:
          How far into the future to simulate (30–50 typical)

        safety_margin_years:
          How many years before break migration must occur
        """

        start_year = start_year or datetime.now(timezone.utc).year

        # Evaluate once to get scheme + params
        decision = self.migration.evaluate_key_migration(
            key_id=key_id,
            current_year=start_year,
            safety_margin_years=safety_margin_years,
        )

        scheme = decision.scheme
        parameter_set = decision.parameter_set

        profile = get_scheme_profile(scheme)

        break_year = (
            profile.estimated_quantum_break_year
            if profile
            else None
        )

        timeline: List[YearlyRiskPoint] = []
        first_migration_year: Optional[int] = None
        worst_risk = "SAFE"

        for offset in range(horizon_years + 1):
            year = start_year + offset

            if break_year is None:
                years_left = None
                risk = "MONITOR"
            else:
                years_left = break_year - year

                if years_left <= 0:
                    risk = "BROKEN"
                elif years_left <= safety_margin_years:
                    risk = "MIGRATE_SOON"
                elif years_left <= safety_margin_years * 2:
                    risk = "MONITOR"
                else:
                    risk = "SAFE"

            timeline.append(
                YearlyRiskPoint(
                    year=year,
                    estimated_quantum_break_year=break_year,
                    years_of_margin=years_left,
                    risk_level=risk,
                )
            )

            # Track earliest migration trigger
            if risk in ("MIGRATE_SOON", "BROKEN") and first_migration_year is None:
                first_migration_year = year

            # Track worst observed risk
            if risk == "BROKEN":
                worst_risk = "BROKEN"
            elif risk == "MIGRATE_SOON" and worst_risk != "BROKEN":
                worst_risk = "MIGRATE_SOON"
            elif risk == "MONITOR" and worst_risk == "SAFE":
                worst_risk = "MONITOR"

        result = SimulationResult(
            key_id=key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            start_year=start_year,
            horizon_years=horizon_years,
            safety_margin_years=safety_margin_years,
            timeline=timeline,
            first_migration_year=first_migration_year,
            worst_risk_level=worst_risk,
            notes=(
                "Simulation based on registry quantum break estimates "
                "and policy safety margins. Suitable for long-horizon planning."
            ),
        )

        # ------------------------------------------------
        # Audit (critical for gov / research)
        # ------------------------------------------------
        record_key_event(
            event_type="migration_simulation",
            key_id=key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            metadata={
                "start_year": start_year,
                "horizon_years": horizon_years,
                "safety_margin_years": safety_margin_years,
                "first_migration_year": first_migration_year,
                "worst_risk_level": worst_risk,
            },
        )

        return result


# ============================================================
# Convenience helpers
# ============================================================

_engine_singleton: Optional[MigrationSimulationEngine] = None


def get_simulation_engine() -> MigrationSimulationEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = MigrationSimulationEngine()
    return _engine_singleton


def simulate_key(
    key_id: str,
    *,
    start_year: Optional[int] = None,
    horizon_years: int = 50,
    safety_margin_years: int = 10,
) -> Dict:
    eng = get_simulation_engine()
    result = eng.simulate_key_lifespan(
        key_id=key_id,
        start_year=start_year,
        horizon_years=horizon_years,
        safety_margin_years=safety_margin_years,
    )

    return {
        **asdict(result),
        "timeline": [asdict(p) for p in result.timeline],
        "registry_snapshot": registry_snapshot(),
    }