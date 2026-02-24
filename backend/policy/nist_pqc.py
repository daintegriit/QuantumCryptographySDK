# backend/policy/nist_pqc.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


# ============================================================
# Helpers
# ============================================================

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# ============================================================
# NIST Policy Models
# ============================================================

@dataclass(frozen=True)
class SchemePolicy:
    """
    A policy entry describing a scheme's supported parameter sets and a baseline risk level.
    This is intentionally conservative and meant to evolve over time.
    """
    scheme: str                   # e.g. "ML-KEM", "Kyber", "NTRU"
    primitive: str                # "KEM" or "SIG" or "FHE" (internal category)
    approved: bool                # whether we treat this as "approved" by this profile
    allowed_params: List[str]     # allowed parameter sets
    default_security_level: str   # e.g. "NIST-L1"
    min_longevity_years: int      # conservative minimum expected longevity in a stable profile
    base_risk: float              # 0.0 best -> 1.0 worst (baseline)
    notes: str = ""


@dataclass
class PolicyDecision:
    """
    Output of a policy evaluation.
    """
    timestamp_utc: str
    profile: str
    allowed: bool
    risk_score: float            # 0..1
    security_level: str
    required_actions: List[str]
    warnings: List[str]
    errors: List[str]
    inputs: Dict[str, Any]


# ============================================================
# Policy Profiles
# ============================================================
# NOTE:
# We keep scheme names flexible because your system will evolve.
# Today you can pass algorithm_lineage.scheme / variant into evaluate().
# Later we can align this to actual NIST naming precisely in one place.

DEFAULT_PROFILE = "enterprise-default"


def get_profile(profile: str = DEFAULT_PROFILE) -> Dict[str, SchemePolicy]:
    """
    Returns policy mapping keyed by scheme name.

    This is a conservative baseline policy:
    - Allows known PQC KEM families by parameter sets
    - Flags unknown schemes/params
    - Supports your 30–50 year system claims by requiring revalidation and migration readiness
    """

    profile = profile or DEFAULT_PROFILE

    # Conservative policy entries (can be expanded later)
    policies: List[SchemePolicy] = [
        # KEMs
        SchemePolicy(
            scheme="ML-KEM",
            primitive="KEM",
            approved=True,
            allowed_params=["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"],
            default_security_level="NIST-L1",
            min_longevity_years=30,
            base_risk=0.15,
            notes="Modern lattice KEM track; parameter choice drives security level.",
        ),
        SchemePolicy(
            scheme="Kyber",
            primitive="KEM",
            approved=True,
            allowed_params=["Kyber512", "Kyber768", "Kyber1024"],
            default_security_level="NIST-L1",
            min_longevity_years=30,
            base_risk=0.20,
            notes="Widely deployed; treat as approved under enterprise profile.",
        ),
        SchemePolicy(
            scheme="NTRU",
            primitive="KEM",
            approved=True,
            allowed_params=["NTRU-HPS-2048-509", "NTRU-HRSS-701"],
            default_security_level="NIST-L1",
            min_longevity_years=25,
            base_risk=0.28,
            notes="Alternative lattice family; approved with parameter validation.",
        ),

        # Placeholder internal categories (for your roadmap)
        SchemePolicy(
            scheme="FHE",
            primitive="FHE",
            approved=False,
            allowed_params=["BFV", "CKKS", "TFHE"],
            default_security_level="N/A",
            min_longevity_years=0,
            base_risk=0.55,
            notes="Not a direct NIST PQC primitive; use for secure computation, not key durability claims.",
        ),
        SchemePolicy(
            scheme="EXPERIMENTAL",
            primitive="EXPERIMENTAL",
            approved=False,
            allowed_params=["*"],
            default_security_level="N/A",
            min_longevity_years=0,
            base_risk=0.85,
            notes="Experimental schemes must be isolated, labeled, and never used for long-term production.",
        ),
    ]

    return {p.scheme: p for p in policies}


# ============================================================
# Core Evaluation
# ============================================================

def infer_security_level_from_param(param: str) -> Optional[str]:
    """
    Heuristic mapping for common parameter sets.
    Conservative: returns None if unknown.
    """
    p = (param or "").upper()

    # ML-KEM style
    if "ML-KEM-512" in p or "KYBER512" in p:
        return "NIST-L1"
    if "ML-KEM-768" in p or "KYBER768" in p:
        return "NIST-L3"
    if "ML-KEM-1024" in p or "KYBER1024" in p:
        return "NIST-L5"

    # NTRU families don't map 1:1 in this heuristic
    if "NTRU" in p:
        return "NIST-L1"

    return None


def evaluate_key_policy(
    *,
    profile: str = DEFAULT_PROFILE,
    scheme: str,
    parameter_set: str,
    claimed_security_level: Optional[str] = None,
    estimated_longevity_years: Optional[int] = None,
    migration_ready: bool = True,
    is_deprecated: bool = False,
    compliance_tags: Optional[List[str]] = None,
) -> PolicyDecision:
    """
    Evaluates whether a key (or intended key) is allowed under the selected policy profile.

    Returns a detailed decision object:
      - allowed
      - risk_score
      - required_actions (e.g., "ROTATE", "REVALIDATE", "MIGRATE")
      - warnings/errors
    """

    compliance_tags = compliance_tags or []
    policies = get_profile(profile)
    ts = utc_now_iso()

    errors: List[str] = []
    warnings: List[str] = []
    required_actions: List[str] = []

    scheme_clean = (scheme or "").strip()
    param_clean = (parameter_set or "").strip()

    # Unknown scheme handling
    if scheme_clean not in policies:
        errors.append(f"Unknown scheme '{scheme_clean}' is not in policy profile '{profile}'.")
        # Treat unknown as high risk and disallow by default
        return PolicyDecision(
            timestamp_utc=ts,
            profile=profile,
            allowed=False,
            risk_score=0.95,
            security_level=claimed_security_level or "UNKNOWN",
            required_actions=["BLOCK", "MIGRATE"],
            warnings=["Add scheme to policy profile if intentional."],
            errors=errors,
            inputs={
                "scheme": scheme,
                "parameter_set": parameter_set,
                "claimed_security_level": claimed_security_level,
                "estimated_longevity_years": estimated_longevity_years,
                "migration_ready": migration_ready,
                "is_deprecated": is_deprecated,
                "compliance_tags": compliance_tags,
            },
        )

    pol = policies[scheme_clean]

    # Parameter validation
    param_allowed = False
    if "*" in pol.allowed_params:
        param_allowed = True
    elif param_clean in pol.allowed_params:
        param_allowed = True

    if not param_allowed:
        errors.append(
            f"Parameter set '{param_clean}' is not allowed for scheme '{scheme_clean}' in profile '{profile}'."
        )

    # Deprecation check
    if is_deprecated:
        errors.append("Key is marked deprecated.")
        required_actions.append("MIGRATE")

    # Security level inference + validation
    inferred_level = infer_security_level_from_param(param_clean)
    effective_level = claimed_security_level or inferred_level or pol.default_security_level

    if inferred_level and claimed_security_level and inferred_level != claimed_security_level:
        warnings.append(
            f"Claimed security level '{claimed_security_level}' does not match inferred '{inferred_level}' for '{param_clean}'."
        )

    # Longevity checks (supports your 30–50 year narrative)
    longevity = int(estimated_longevity_years) if estimated_longevity_years is not None else pol.min_longevity_years

    if pol.approved and longevity < pol.min_longevity_years:
        warnings.append(
            f"Estimated longevity {longevity}y is below conservative policy minimum {pol.min_longevity_years}y for scheme '{scheme_clean}'."
        )
        required_actions.append("REVALIDATE")

    if longevity >= 30:
        required_actions.append("SCHEDULE_REVALIDATION")
    if longevity >= 40:
        # Anything claiming 40–50y must have migration readiness
        if not migration_ready:
            errors.append("Keys claiming >=40y must be migration-ready under long-horizon policy.")
        else:
            required_actions.append("MAINTAIN_MIGRATION_PLAN")

    # Compliance tags
    if "production" in [t.lower() for t in compliance_tags]:
        if not pol.approved:
            errors.append(f"Scheme '{scheme_clean}' is not approved for production use under '{profile}'.")

    # Risk score computation (simple, explainable)
    risk = pol.base_risk

    # Parameter mismatch increases risk
    if not param_allowed:
        risk += 0.35

    # Non-approved schemes are higher risk
    if not pol.approved:
        risk += 0.25

    # Deprecation spikes risk
    if is_deprecated:
        risk += 0.50

    # Migration readiness reduces risk (long-horizon systems)
    if migration_ready:
        risk -= 0.05
    else:
        risk += 0.10

    # Longevity claim increases scrutiny
    if longevity >= 40:
        risk += 0.10
    if longevity >= 50:
        risk += 0.15

    risk = clamp(risk, 0.0, 1.0)

    # Allowed decision
    allowed = (len(errors) == 0)

    # If allowed but risky, add warnings/actions
    if allowed and risk >= 0.70:
        warnings.append("High risk score despite passing validation; consider migration or stronger params.")
        required_actions.append("REVIEW_SECURITY")

    if allowed and "REVALIDATE" not in required_actions:
        # Always enforce periodic checks in your system
        required_actions.append("REVALIDATE_PERIODICALLY")

    return PolicyDecision(
        timestamp_utc=ts,
        profile=profile,
        allowed=allowed,
        risk_score=risk,
        security_level=effective_level,
        required_actions=sorted(list(set(required_actions))),
        warnings=warnings,
        errors=errors,
        inputs={
            "scheme": scheme,
            "parameter_set": parameter_set,
            "claimed_security_level": claimed_security_level,
            "estimated_longevity_years": estimated_longevity_years,
            "migration_ready": migration_ready,
            "is_deprecated": is_deprecated,
            "compliance_tags": compliance_tags,
        },
    )


# ============================================================
# Convenience: dict output for API
# ============================================================

def evaluate_key_policy_dict(**kwargs: Any) -> Dict[str, Any]:
    decision = evaluate_key_policy(**kwargs)
    return asdict(decision)