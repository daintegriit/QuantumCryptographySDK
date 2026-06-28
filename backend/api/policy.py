# backend/api/policy.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from policy.security_store import check_key_allowed

router = APIRouter()


# ============================================================
# Request Models
# ============================================================

class PolicyCheckRequest(BaseModel):
    scheme: str
    parameter_set: str
    claimed_security_level: Optional[str] = None
    estimated_longevity_years: Optional[int] = 30
    migration_ready: bool = True
    is_deprecated: bool = False
    compliance_tags: Optional[List[str]] = None


# ============================================================
# POLICY CHECK (PRIMARY ENDPOINT)
# ============================================================

@router.post("/policy/check")
def api_policy_check(req: PolicyCheckRequest) -> Dict[str, Any]:
    """
    Evaluate whether a cryptographic configuration is allowed.
    """
    try:
        result = check_key_allowed(
            scheme=req.scheme,
            parameter_set=req.parameter_set,
            claimed_security_level=req.claimed_security_level,
            estimated_longevity_years=req.estimated_longevity_years,
            migration_ready=req.migration_ready,
            is_deprecated=req.is_deprecated,
            compliance_tags=req.compliance_tags,
            audit=True,
        )
        return result

    except Exception as e:
        # BUG FIX: str(e) leaks internal details to API consumers.
        # Log and return a safe message. The result dict from
        # check_key_allowed() already has structured errors inside it
        # for normal validation failures — exceptions here are truly
        # unexpected, so treat them as 500.
        import logging
        logging.getLogger(__name__).exception("Policy check failed")
        raise HTTPException(status_code=500, detail=f"Policy engine error: {type(e).__name__}")


# ============================================================
# POLICY QUICK CHECK (CLI FRIENDLY)
# ============================================================

# BUG FIX: GET and POST both mapped to /policy/check. FastAPI registers
# them as separate operations (different HTTP methods) so there is no
# conflict — but the CLI's cmd_policy_check() calls POST, and the GET
# version is only for curl/browser convenience. Both are fine as-is.
# No change needed here, but noted for clarity.

@router.get("/policy/check")
def api_policy_check_simple(
    scheme: str,
    parameter_set: str,
    longevity: int = 30,
) -> Dict[str, Any]:
    """
    Lightweight GET version for CLI / curl usage.
    Example: GET /policy/check?scheme=kyber&parameter_set=kyber768
    """
    try:
        return check_key_allowed(
            scheme=scheme,
            parameter_set=parameter_set,
            estimated_longevity_years=longevity,
            audit=True,
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("Policy quick-check failed")
        raise HTTPException(status_code=500, detail=f"Policy engine error: {type(e).__name__}")


# ============================================================
# POLICY STATUS / HEALTH
# ============================================================

@router.get("/policy/status")
def api_policy_status() -> Dict[str, Any]:
    return {
        "policy_engine": "ready",
        "features": {
            "normalization": True,
            "risk_scoring": True,
            "nist_alignment": True,
            "longevity_enforcement": True,
            "migration_ready_check": True,
            "audit_logging": True,
        },
    }