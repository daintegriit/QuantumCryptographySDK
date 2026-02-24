# backend/key_management/registry.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Dict, List, Optional


# ============================================================
# Registry Models
# ============================================================

@dataclass(frozen=True)
class CryptoSchemeProfile:
    """
    Canonical registry entry for a cryptographic scheme or family.

    This is NOT an algorithm implementation.
    It is governance metadata used for:
      - policy enforcement
      - lifecycle evaluation
      - future quantum risk modeling
    """
    scheme: str
    family: str
    type: str                  # KEM | SIG | FHE | SYM
    standardized_by: str       # NIST | ISO | EXPERIMENTAL
    parameters: List[str]
    min_security_level: str
    max_security_level: str
    estimated_classical_break_year: Optional[int]
    estimated_quantum_break_year: Optional[int]
    recommended_for_new_systems: bool
    migration_priority: int    # 1 = urgent, 5 = stable
    notes: str = ""


# ============================================================
# Canonical Registry
# ============================================================

_SCHEME_REGISTRY: Dict[str, CryptoSchemeProfile] = {
    # ---------------------------
    # NIST PQC (KEM)
    # ---------------------------
    "ML-KEM": CryptoSchemeProfile(
        scheme="ML-KEM",
        family="Lattice",
        type="KEM",
        standardized_by="NIST",
        parameters=["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"],
        min_security_level="NIST-L1",
        max_security_level="NIST-L5",
        estimated_classical_break_year=None,
        estimated_quantum_break_year=2080,
        recommended_for_new_systems=True,
        migration_priority=5,
        notes="NIST-selected Kyber successor; baseline for post-quantum encryption",
    ),

    "NTRU": CryptoSchemeProfile(
        scheme="NTRU",
        family="Lattice",
        type="KEM",
        standardized_by="NIST",
        parameters=["NTRU-HPS-2048-509", "NTRU-HRSS-701"],
        min_security_level="NIST-L1",
        max_security_level="NIST-L3",
        estimated_classical_break_year=None,
        estimated_quantum_break_year=2070,
        recommended_for_new_systems=True,
        migration_priority=4,
        notes="Alternate lattice KEM; good diversification candidate",
    ),

    # ---------------------------
    # Homomorphic (NOT durability keys)
    # ---------------------------
    "FHE": CryptoSchemeProfile(
        scheme="FHE",
        family="Lattice",
        type="FHE",
        standardized_by="ISO",
        parameters=["BFV", "CKKS", "TFHE"],
        min_security_level="NIST-L1",
        max_security_level="NIST-L3",
        estimated_classical_break_year=None,
        estimated_quantum_break_year=2060,
        recommended_for_new_systems=False,
        migration_priority=2,
        notes="Homomorphic computation only; NOT for long-term key durability",
    ),

    # ---------------------------
    # Experimental / Research
    # ---------------------------
    "EXPERIMENTAL": CryptoSchemeProfile(
        scheme="EXPERIMENTAL",
        family="UNKNOWN",
        type="UNKNOWN",
        standardized_by="EXPERIMENTAL",
        parameters=["*"],
        min_security_level="UNKNOWN",
        max_security_level="UNKNOWN",
        estimated_classical_break_year=None,
        estimated_quantum_break_year=None,
        recommended_for_new_systems=False,
        migration_priority=1,
        notes="Experimental research schemes; never allowed in production policy",
    ),
}


# ============================================================
# Registry API
# ============================================================

def list_schemes() -> List[Dict]:
    """
    List all registered schemes.
    """
    return [asdict(v) for v in _SCHEME_REGISTRY.values()]


def get_scheme_profile(scheme: str) -> Optional[CryptoSchemeProfile]:
    """
    Retrieve a scheme profile by canonical name.
    """
    return _SCHEME_REGISTRY.get(scheme)


def is_scheme_allowed_for_new_systems(scheme: str) -> bool:
    profile = get_scheme_profile(scheme)
    if not profile:
        return False
    return profile.recommended_for_new_systems


def get_migration_priority(scheme: str) -> int:
    profile = get_scheme_profile(scheme)
    if not profile:
        return 1
    return profile.migration_priority


def get_expected_quantum_break_year(scheme: str) -> Optional[int]:
    profile = get_scheme_profile(scheme)
    if not profile:
        return None
    return profile.estimated_quantum_break_year


def registry_snapshot() -> Dict[str, Dict]:
    """
    Immutable snapshot used for:
      - audits
      - reports
      - reproducibility
    """
    return {
        "generated_at_utc": datetime.utcnow().isoformat() + "Z",
        "schemes": {k: asdict(v) for k, v in _SCHEME_REGISTRY.items()},
    }