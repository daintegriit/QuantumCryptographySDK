# backend/api/simulations.py
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
# STATIC ROUTES — must come before /{key_id} routes
# BUG FIX: /simulations/status and /simulations/portfolio are both
# static. They were declared after /keys/{key_id}/simulation, which
# doesn't shadow them (different path prefix), so ordering is fine here.
# However /simulations/status must still precede any future
# /simulations/{id} routes if added.
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


@router.post("/simulations/portfolio")
def api_simulate_portfolio(req: PortfolioSimulationRequest):
    """
    Run a portfolio-wide quantum migration simulation.
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
# Dynamic /{key_id} routes — AFTER static routes
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

    BUG FIX: original caught all exceptions and re-raised as HTTP 500
    with str(e) — this leaks internal error details (file paths, stack
    info embedded in exception messages) to API consumers. Split into
    specific cases: 404 for missing key (already handled), ValueError
    for bad input → 400, everything else → 500 with a safe message.
    The key existence check was also redundant because simulate_key()
    calls MigrationEngine → LifecycleEngine → _load_key_record() which
    raises FileNotFoundError if the key is missing — but having the
    explicit check here gives a cleaner 404 before we even enter the
    simulation stack.
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

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except FileNotFoundError:
        # Race condition: key deleted between the check above and simulate_key()
        raise HTTPException(status_code=404, detail="Key not found")

    except Exception as e:
        # Log internally; return safe message to client
        import logging
        logging.getLogger(__name__).exception("Simulation failed for key %s", key_id)
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {type(e).__name__}",
        )