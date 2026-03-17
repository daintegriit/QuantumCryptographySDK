# backend/agility/migration_simulator.py
from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from key_management.keygen import get_keygen_engine
from key_management.lifecycle import KeyLifecycleEngine
from key_management.migration import MigrationEngine
from key_management.registry import get_expected_quantum_break_year, get_scheme_profile
from policy.security_store import record_key_event


# ============================================================
# Config
# ============================================================

DEFAULT_SIM_OUTPUT_DIR = Path(
    os.getenv("QS_SIM_OUTPUT_DIR", "backend/telemetry/simulations")
).resolve()

DEFAULT_SCENARIOS = ["conservative", "baseline", "aggressive", "breakthrough"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


# ============================================================
# Scenario Model
# ============================================================

@dataclass(frozen=True)
class QuantumScenario:
    """
    A scenario describes how early/late quantum capability arrives
    relative to registry estimates.

    shift_years:
      positive => break year later (safer)
      negative => break year earlier (riskier)

    jitter_years:
      stochastic uncertainty around that break year (distribution width).
    """
    name: str
    shift_years: int
    jitter_years: int
    description: str


SCENARIO_CATALOG: Dict[str, QuantumScenario] = {
    "conservative": QuantumScenario(
        name="conservative",
        shift_years=+10,
        jitter_years=3,
        description="Assumes quantum capability arrives later than expected; safest planning curve.",
    ),
    "baseline": QuantumScenario(
        name="baseline",
        shift_years=0,
        jitter_years=5,
        description="Uses registry estimate with moderate uncertainty; realistic planning baseline.",
    ),
    "aggressive": QuantumScenario(
        name="aggressive",
        shift_years=-10,
        jitter_years=7,
        description="Assumes faster-than-expected quantum progress; earlier break risk.",
    ),
    "breakthrough": QuantumScenario(
        name="breakthrough",
        shift_years=-20,
        jitter_years=10,
        description="Assumes a major breakthrough compresses timelines dramatically; worst-case governance test.",
    ),
}


# ============================================================
# Decision Model (per scenario)
# ============================================================

@dataclass(frozen=True)
class ScenarioResult:
    scenario: str
    estimated_break_year: Optional[int]
    sampled_break_year: Optional[int]
    years_left: Optional[int]
    safety_margin_years: int
    severity: str  # OK | MONITOR | MIGRATE_SOON | EMERGENCY | UNKNOWN
    migrate_recommended: bool
    reason: str


@dataclass(frozen=True)
class KeySimulationResult:
    key_id: str
    scheme: str
    parameter_set: str
    claimed_security_level: str
    estimated_longevity_years: int
    created_at_utc: str
    current_year: int
    registry_break_year: Optional[int]
    scenarios: List[ScenarioResult]
    summary: Dict[str, Any]


@dataclass(frozen=True)
class PortfolioSimulationResult:
    generated_at_utc: str
    current_year: int
    seed: int
    safety_margin_years: int
    scenario_names: List[str]
    keys_simulated: int
    results: List[KeySimulationResult]
    rollup: Dict[str, Any]


# ============================================================
# Core simulator
# ============================================================

class MigrationSimulator:
    """
    Forward-looking governance simulator.

    This is the piece that makes IBM/Rigetti/AI integration meaningful later:
      - you now have a time axis, scenario axis, and decision loop
      - external signals can plug in by modifying scenario parameters
    """

    def __init__(
        self,
        *,
        output_dir: Path = DEFAULT_SIM_OUTPUT_DIR,
    ):
        self.output_dir = Path(output_dir).resolve()
        ensure_dir(self.output_dir)

        self.keys = get_keygen_engine()
        self.lifecycle = KeyLifecycleEngine()
        self.migration = MigrationEngine()

    # ----------------------------
    # Decision logic
    # ----------------------------

    @staticmethod
    def _decision_from_years_left(
        years_left: Optional[int],
        safety_margin_years: int,
    ) -> Tuple[str, bool, str]:
        if years_left is None:
            return ("UNKNOWN", False, "No break-year estimate available for this scheme")

        if years_left <= 0:
            return ("EMERGENCY", True, "Estimated break year exceeded")
        if years_left <= safety_margin_years:
            return ("MIGRATE_SOON", True, f"Within safety margin ({safety_margin_years}y)")
        if years_left <= safety_margin_years * 2:
            return ("MONITOR", False, "Approaching long-term risk horizon")
        return ("OK", False, "Sufficient quantum safety margin")

    @staticmethod
    def _sample_break_year(
        base_break_year: Optional[int],
        scenario: QuantumScenario,
        rng: random.Random,
    ) -> Optional[int]:
        if base_break_year is None:
            return None

        # Shift (systematic adjustment) + jitter (uncertainty)
        jitter = rng.randint(-scenario.jitter_years, scenario.jitter_years) if scenario.jitter_years > 0 else 0
        return int(base_break_year + scenario.shift_years + jitter)

    # ----------------------------
    # Single-key simulation
    # ----------------------------

    def simulate_key(
        self,
        *,
        key_id: str,
        current_year: int,
        safety_margin_years: int,
        scenarios: List[str],
        rng: random.Random,
    ) -> KeySimulationResult:
        status = self.lifecycle.evaluate_key_id(key_id, audit=False)

        scheme = (status.scheme or "").strip()
        parameter_set = (status.parameter_set or "").strip()
        claimed_sec = (status.claimed_security_level or "UNKNOWN").strip()
        longevity = int(status.estimated_longevity_years or 40)
        created = status.created_at_utc or ""

        registry_break = get_expected_quantum_break_year(scheme)

        scenario_results: List[ScenarioResult] = []

        for sname in scenarios:
            scen = SCENARIO_CATALOG.get(sname)
            if not scen:
                # Unknown scenario name => ignore safely
                continue

            sampled_break = self._sample_break_year(registry_break, scen, rng)
            years_left = None if sampled_break is None else int(sampled_break - current_year)

            severity, migrate, reason = self._decision_from_years_left(years_left, safety_margin_years)

            scenario_results.append(
                ScenarioResult(
                    scenario=sname,
                    estimated_break_year=registry_break,
                    sampled_break_year=sampled_break,
                    years_left=years_left,
                    safety_margin_years=safety_margin_years,
                    severity=severity,
                    migrate_recommended=migrate,
                    reason=reason,
                )
            )

        # Summary: worst-case severity across scenarios
        severity_rank = {"EMERGENCY": 4, "MIGRATE_SOON": 3, "MONITOR": 2, "OK": 1, "UNKNOWN": 0}
        worst = max(scenario_results, key=lambda r: severity_rank.get(r.severity, 0), default=None)

        summary = {
            "worst_case": asdict(worst) if worst else None,
            "migrate_recommended_any": any(r.migrate_recommended for r in scenario_results),
            "scenarios_count": len(scenario_results),
        }

        return KeySimulationResult(
            key_id=key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            claimed_security_level=claimed_sec,
            estimated_longevity_years=longevity,
            created_at_utc=created,
            current_year=current_year,
            registry_break_year=registry_break,
            scenarios=scenario_results,
            summary=summary,
        )

    # ----------------------------
    # Portfolio simulation
    # ----------------------------

    def simulate_portfolio(
        self,
        *,
        current_year: Optional[int] = None,
        safety_margin_years: int = 10,
        scenarios: Optional[List[str]] = None,
        limit: int = 200,
        seed: int = 1337,
        write_output: bool = True,
        output_name: Optional[str] = None,
        audit: bool = True,
    ) -> PortfolioSimulationResult:
        current_year = current_year or datetime.now(timezone.utc).year
        scenarios = scenarios or DEFAULT_SCENARIOS

        rng = random.Random(seed)

        key_records = self.keys.list(limit=limit)
        key_ids = [k.key_id for k in key_records]

        results: List[KeySimulationResult] = []
        for kid in key_ids:
            try:
                results.append(
                    self.simulate_key(
                        key_id=kid,
                        current_year=current_year,
                        safety_margin_years=safety_margin_years,
                        scenarios=scenarios,
                        rng=rng,
                    )
                )
            except Exception as e:
                # Don't crash whole run if one record is malformed
                results.append(
                    KeySimulationResult(
                        key_id=kid,
                        scheme="UNKNOWN",
                        parameter_set="UNKNOWN",
                        claimed_security_level="UNKNOWN",
                        estimated_longevity_years=0,
                        created_at_utc="",
                        current_year=current_year,
                        registry_break_year=None,
                        scenarios=[],
                        summary={"error": str(e)},
                    )
                )

        # Rollups: counts by worst-case severity
        severity_counts: Dict[str, int] = {"EMERGENCY": 0, "MIGRATE_SOON": 0, "MONITOR": 0, "OK": 0, "UNKNOWN": 0}
        migrate_any = 0
        for r in results:
            worst = (r.summary or {}).get("worst_case") or {}
            sev = worst.get("severity", "UNKNOWN")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            if (r.summary or {}).get("migrate_recommended_any"):
                migrate_any += 1

        rollup = {
            "severity_counts_worst_case": severity_counts,
            "migrate_recommended_any_count": migrate_any,
            "migrate_recommended_any_pct": (migrate_any / max(1, len(results))) * 100.0,
        }

        out = PortfolioSimulationResult(
            generated_at_utc=utc_now_iso(),
            current_year=current_year,
            seed=seed,
            safety_margin_years=safety_margin_years,
            scenario_names=list(scenarios),
            keys_simulated=len(results),
            results=results,
            rollup=rollup,
        )

        if write_output:
            ensure_dir(self.output_dir)
            fname = output_name or f"migration_sim_{current_year}_{seed}.json"
            path = self.output_dir / fname
            path.write_text(json.dumps(asdict(out), indent=2), encoding="utf-8")

        if audit:
            record_key_event(
                event_type="migration_simulation_run",
                metadata={
                    "current_year": current_year,
                    "seed": seed,
                    "safety_margin_years": safety_margin_years,
                    "scenarios": list(scenarios),
                    "keys_simulated": len(results),
                    "rollup": rollup,
                },
            )

        return out

    # ----------------------------
    # Optional: execute migrations from simulation
    # ----------------------------

    def execute_recommended_migrations(
        self,
        sim: PortfolioSimulationResult,
        *,
        scenario_preference: str = "baseline",
        force: bool = False,
        dry_run: bool = True,
        audit: bool = True,
    ) -> Dict[str, Any]:
        """
        Takes a simulation result and migrates keys that are recommended under scenario_preference.

        By default dry_run=True (safe).
        Set dry_run=False to actually rotate/migrate keys.
        """
        migrated: List[Dict[str, Any]] = []
        skipped: List[Dict[str, Any]] = []

        for r in sim.results:
            if not r.scenarios:
                skipped.append({"key_id": r.key_id, "reason": "No scenario results"})
                continue

            pref = next((s for s in r.scenarios if s.scenario == scenario_preference), None)
            if not pref:
                skipped.append({"key_id": r.key_id, "reason": f"No scenario '{scenario_preference}'"})
                continue

            if not pref.migrate_recommended and not force:
                skipped.append({"key_id": r.key_id, "reason": "Migration not recommended"})
                continue

            if dry_run:
                migrated.append(
                    {
                        "key_id": r.key_id,
                        "dry_run": True,
                        "scenario": scenario_preference,
                        "severity": pref.severity,
                        "recommended": True,
                    }
                )
                continue

            # real migration
            try:
                res = self.migration.migrate_key_if_needed(key_id=r.key_id, force=True)
                migrated.append({"key_id": r.key_id, "dry_run": False, "result": res})
            except Exception as e:
                skipped.append({"key_id": r.key_id, "reason": f"migration_failed:{e}"})

        summary = {
            "scenario_preference": scenario_preference,
            "force": force,
            "dry_run": dry_run,
            "migrated_count": len(migrated),
            "skipped_count": len(skipped),
            "migrated": migrated,
            "skipped": skipped,
        }

        if audit:
            record_key_event(event_type="migration_simulation_execute", metadata=summary)

        return summary


# ============================================================
# Convenience (module-level)
# ============================================================

_sim_singleton: Optional[MigrationSimulator] = None


def get_migration_simulator() -> MigrationSimulator:
    global _sim_singleton
    if _sim_singleton is None:
        _sim_singleton = MigrationSimulator()
    return _sim_singleton


def run_simulation(
    *,
    current_year: Optional[int] = None,
    safety_margin_years: int = 10,
    scenarios: Optional[List[str]] = None,
    limit: int = 200,
    seed: int = 1337,
    write_output: bool = True,
) -> Dict[str, Any]:
    sim = get_migration_simulator()
    out = sim.simulate_portfolio(
        current_year=current_year,
        safety_margin_years=safety_margin_years,
        scenarios=scenarios,
        limit=limit,
        seed=seed,
        write_output=write_output,
        audit=True,
    )
    return asdict(out)


# ============================================================
# CLI entry
# ============================================================

if __name__ == "__main__":
    # Example local run:
    #   python -m backend.agility.migration_simulator
    # or:
    #   python backend/agility/migration_simulator.py
    sim = get_migration_simulator()
    result = sim.simulate_portfolio(
        safety_margin_years=int(os.getenv("QS_SAFETY_MARGIN_YEARS", "10")),
        limit=int(os.getenv("QS_SIM_LIMIT", "50")),
        seed=int(os.getenv("QS_SIM_SEED", "1337")),
        scenarios=DEFAULT_SCENARIOS,
        write_output=True,
    )
    print(json.dumps(asdict(result), indent=2))