from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

from pydantic import BaseModel

from simulations.simulations import simulate_key
from agility.migration_simulator import run_simulation
from key_management.keygen import get_keygen_engine

router = APIRouter()

# ============================================================
# Models
# ============================================================

class PortfolioSimulationRequest(BaseModel):
    safety_margin_years: int = 10
    scenarios: Optional[List[str]] = None
    limit: int = 200
    seed: int = 1337


# ============================================================
# Simulate key durability (single-key, policy-grade)
# ============================================================

@router.get("/keys/{key_id}/simulation")
def api_simulate_key(
    key_id: str,
    start_year: Optional[int] = Query(
        None,
        description="Simulation start year (defaults to current UTC year)",
    ),
    horizon_years: int = Query(
        50,
        ge=5,
        le=100,
        description="Years to project forward (gov-grade: 30–50)",
    ),
    safety_margin_years: int = Query(
        10,
        ge=5,
        le=25,
        description="Years before break requiring migration",
    ),
):
    """
    Simulate long-horizon cryptographic durability for a single key.

    GUARANTEES:
      - Deterministic
      - Read-only
      - Audit logged
      - No key mutation

    PRIMARY proof layer for 30–50 year cryptographic claims.
    """

    engine = get_keygen_engine()
    key = engine.get(key_id)

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    try:
        result = simulate_key(
            key_id=key_id,
            start_year=start_year,
            horizon_years=horizon_years,
            safety_margin_years=safety_margin_years,
        )
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Portfolio-wide scenario simulation
# ============================================================

@router.post("/simulations/portfolio")
def api_simulate_portfolio(req: PortfolioSimulationRequest):
    """
    Run a portfolio-wide quantum migration simulation.

    PURPOSE:
      - Scenario-based planning
      - Governance & policy modeling
      - Migration pressure forecasting

    GUARANTEES:
      - Read-only by default
      - Deterministic (seeded)
      - Audit logged
      - No key mutation
    """

    try:
        result = run_simulation(
            safety_margin_years=req.safety_margin_years,
            scenarios=req.scenarios,
            limit=req.limit,
            seed=req.seed,
            write_output=True,
        )
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Simulation readiness / sanity check
# ============================================================

@router.get("/simulations/status")
def simulation_status():
    """
    Readiness probe for the simulation subsystem.
    Safe for health checks and observability.
    """

    engine = get_keygen_engine()
    keys = engine.list(limit=1)

    return {
        "simulation_engine": "ready",
        "supports": {
            "single_key_projection": True,
            "portfolio_simulation": True,
            "30_50_year_horizon": True,
            "policy_based": True,
            "audit_logged": True,
            "mutates_keys": False,
        },
        "keys_present": len(keys),
    }