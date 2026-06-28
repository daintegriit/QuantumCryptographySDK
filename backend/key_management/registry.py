# backend/key_management/registry.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional


# ============================================================
# Registry Models
# ============================================================

@dataclass(frozen=True)
class CryptoSchemeProfile:
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

    # ── Kyber / ML-KEM ──────────────────────────────────────
    "kyber": CryptoSchemeProfile(
        scheme="kyber", family="Lattice", type="KEM", standardized_by="NIST",
        parameters=["Kyber512", "Kyber768", "Kyber1024"],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2080,
        recommended_for_new_systems=True, migration_priority=5,
        notes="CRYSTALS-Kyber / ML-KEM; primary NIST PQC KEM",
    ),
    "Kyber": CryptoSchemeProfile(
        scheme="Kyber", family="Lattice", type="KEM", standardized_by="NIST",
        parameters=["Kyber512", "Kyber768", "Kyber1024"],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2080,
        recommended_for_new_systems=True, migration_priority=5,
        notes="Alias for kyber",
    ),
    "ML-KEM": CryptoSchemeProfile(
        scheme="ML-KEM", family="Lattice", type="KEM", standardized_by="NIST",
        parameters=["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2080,
        recommended_for_new_systems=True, migration_priority=5,
        notes="FIPS 203 standardized name for Kyber",
    ),

    # ── Dilithium / ML-DSA ──────────────────────────────────
    "dilithium": CryptoSchemeProfile(
        scheme="dilithium", family="Lattice", type="SIG", standardized_by="NIST",
        parameters=["Dilithium2", "Dilithium3", "Dilithium5"],
        min_security_level="NIST-L2", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2080,
        recommended_for_new_systems=True, migration_priority=5,
        notes="CRYSTALS-Dilithium / ML-DSA; primary NIST PQC signature",
    ),
    "Dilithium": CryptoSchemeProfile(
        scheme="Dilithium", family="Lattice", type="SIG", standardized_by="NIST",
        parameters=["Dilithium2", "Dilithium3", "Dilithium5"],
        min_security_level="NIST-L2", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2080,
        recommended_for_new_systems=True, migration_priority=5,
        notes="Alias for dilithium",
    ),
    "ML-DSA": CryptoSchemeProfile(
        scheme="ML-DSA", family="Lattice", type="SIG", standardized_by="NIST",
        parameters=["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
        min_security_level="NIST-L2", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2080,
        recommended_for_new_systems=True, migration_priority=5,
        notes="FIPS 204 standardized name for Dilithium",
    ),

    # ── Falcon ──────────────────────────────────────────────
    "falcon": CryptoSchemeProfile(
        scheme="falcon", family="Lattice", type="SIG", standardized_by="NIST",
        parameters=["Falcon-512", "Falcon-1024", "Falcon-padded-512", "Falcon-padded-1024"],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2075,
        recommended_for_new_systems=True, migration_priority=4,
        notes="NTRU-lattice signatures; smallest sig sizes of NIST PQC schemes",
    ),
    "Falcon": CryptoSchemeProfile(
        scheme="Falcon", family="Lattice", type="SIG", standardized_by="NIST",
        parameters=["Falcon-512", "Falcon-1024", "Falcon-padded-512", "Falcon-padded-1024"],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2075,
        recommended_for_new_systems=True, migration_priority=4,
        notes="Alias for falcon",
    ),

    # ── SPHINCS+ / SLH-DSA ──────────────────────────────────
    "sphincs": CryptoSchemeProfile(
        scheme="sphincs", family="Hash", type="SIG", standardized_by="NIST",
        parameters=[
            "SPHINCS+-SHA2-128f-simple", "SPHINCS+-SHA2-128s-simple",
            "SPHINCS+-SHA2-192f-simple", "SPHINCS+-SHA2-192s-simple",
            "SPHINCS+-SHA2-256f-simple", "SPHINCS+-SHA2-256s-simple",
            "SPHINCS+-SHAKE-128f-simple", "SPHINCS+-SHAKE-128s-simple",
            "SPHINCS+-SHAKE-192f-simple", "SPHINCS+-SHAKE-192s-simple",
            "SPHINCS+-SHAKE-256f-simple", "SPHINCS+-SHAKE-256s-simple",
        ],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2090,
        recommended_for_new_systems=True, migration_priority=4,
        notes="Hash-based stateless signatures; FIPS 205 / SLH-DSA. Conservative — only hash security assumptions.",
    ),
    "SPHINCS+": CryptoSchemeProfile(
        scheme="SPHINCS+", family="Hash", type="SIG", standardized_by="NIST",
        parameters=[
            "SPHINCS+-SHA2-128f-simple", "SPHINCS+-SHA2-128s-simple",
            "SPHINCS+-SHA2-192f-simple", "SPHINCS+-SHA2-192s-simple",
            "SPHINCS+-SHA2-256f-simple", "SPHINCS+-SHA2-256s-simple",
            "SPHINCS+-SHAKE-128f-simple", "SPHINCS+-SHAKE-128s-simple",
            "SPHINCS+-SHAKE-192f-simple", "SPHINCS+-SHAKE-192s-simple",
            "SPHINCS+-SHAKE-256f-simple", "SPHINCS+-SHAKE-256s-simple",
        ],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2090,
        recommended_for_new_systems=True, migration_priority=4,
        notes="Alias for sphincs",
    ),
    "SLH-DSA": CryptoSchemeProfile(
        scheme="SLH-DSA", family="Hash", type="SIG", standardized_by="NIST",
        parameters=["SLH-DSA-SHA2-128s", "SLH-DSA-SHA2-256s"],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2090,
        recommended_for_new_systems=True, migration_priority=4,
        notes="FIPS 205 standardized name for SPHINCS+",
    ),

    # ── FrodoKEM ────────────────────────────────────────────
    "frodokem": CryptoSchemeProfile(
        scheme="frodokem", family="Lattice", type="KEM", standardized_by="ISO",
        parameters=[
            "FrodoKEM-640-AES", "FrodoKEM-640-SHAKE",
            "FrodoKEM-976-AES", "FrodoKEM-976-SHAKE",
            "FrodoKEM-1344-AES", "FrodoKEM-1344-SHAKE",
        ],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2085,
        recommended_for_new_systems=True, migration_priority=3,
        notes="LWE-based KEM; conservative alternative to Kyber; larger keys/ciphertexts",
    ),
    "FrodoKEM": CryptoSchemeProfile(
        scheme="FrodoKEM", family="Lattice", type="KEM", standardized_by="ISO",
        parameters=[
            "FrodoKEM-640-AES", "FrodoKEM-640-SHAKE",
            "FrodoKEM-976-AES", "FrodoKEM-976-SHAKE",
            "FrodoKEM-1344-AES", "FrodoKEM-1344-SHAKE",
        ],
        min_security_level="NIST-L1", max_security_level="NIST-L5",
        estimated_classical_break_year=None, estimated_quantum_break_year=2085,
        recommended_for_new_systems=True, migration_priority=3,
        notes="Alias for frodokem",
    ),

    # ── NTRU ────────────────────────────────────────────────
    "NTRU": CryptoSchemeProfile(
        scheme="NTRU", family="Lattice", type="KEM", standardized_by="NIST",
        parameters=["NTRU-HPS-2048-509", "NTRU-HRSS-701"],
        min_security_level="NIST-L1", max_security_level="NIST-L3",
        estimated_classical_break_year=None, estimated_quantum_break_year=2070,
        recommended_for_new_systems=True, migration_priority=4,
        notes="Alternate lattice KEM; good diversification candidate",
    ),

    # ── Classical (baseline/migration context) ───────────────
    "rsa": CryptoSchemeProfile(
        scheme="rsa", family="Integer Factorization", type="KEM", standardized_by="NIST",
        parameters=["RSA-2048", "RSA-4096"],
        min_security_level="112-bit", max_security_level="140-bit",
        estimated_classical_break_year=2030, estimated_quantum_break_year=2030,
        recommended_for_new_systems=False, migration_priority=1,
        notes="Broken by Shor's algorithm; migrate immediately",
    ),
    "RSA": CryptoSchemeProfile(
        scheme="RSA", family="Integer Factorization", type="KEM", standardized_by="NIST",
        parameters=["RSA-2048", "RSA-4096"],
        min_security_level="112-bit", max_security_level="140-bit",
        estimated_classical_break_year=2030, estimated_quantum_break_year=2030,
        recommended_for_new_systems=False, migration_priority=1,
        notes="Alias for rsa",
    ),
    "ecc": CryptoSchemeProfile(
        scheme="ecc", family="Elliptic Curve", type="SIG", standardized_by="NIST",
        parameters=["ECC-P256", "ECC-P384"],
        min_security_level="128-bit", max_security_level="192-bit",
        estimated_classical_break_year=2035, estimated_quantum_break_year=2030,
        recommended_for_new_systems=False, migration_priority=1,
        notes="Broken by Shor's algorithm; migrate immediately",
    ),
    "ECC": CryptoSchemeProfile(
        scheme="ECC", family="Elliptic Curve", type="SIG", standardized_by="NIST",
        parameters=["ECC-P256", "ECC-P384"],
        min_security_level="128-bit", max_security_level="192-bit",
        estimated_classical_break_year=2035, estimated_quantum_break_year=2030,
        recommended_for_new_systems=False, migration_priority=1,
        notes="Alias for ecc",
    ),

    # ── Homomorphic ─────────────────────────────────────────
    "FHE": CryptoSchemeProfile(
        scheme="FHE", family="Lattice", type="FHE", standardized_by="ISO",
        parameters=["BFV", "CKKS", "TFHE"],
        min_security_level="NIST-L1", max_security_level="NIST-L3",
        estimated_classical_break_year=None, estimated_quantum_break_year=2060,
        recommended_for_new_systems=False, migration_priority=2,
        notes="Homomorphic computation only; not for key durability",
    ),

    # ── Experimental ────────────────────────────────────────
    "EXPERIMENTAL": CryptoSchemeProfile(
        scheme="EXPERIMENTAL", family="UNKNOWN", type="UNKNOWN",
        standardized_by="EXPERIMENTAL", parameters=["*"],
        min_security_level="UNKNOWN", max_security_level="UNKNOWN",
        estimated_classical_break_year=None, estimated_quantum_break_year=None,
        recommended_for_new_systems=False, migration_priority=1,
        notes="Never allowed in production policy",
    ),
}


# ============================================================
# Registry API
# ============================================================

def list_schemes() -> List[Dict]:
    return [asdict(v) for v in _SCHEME_REGISTRY.values()]


def get_scheme_profile(scheme: str) -> Optional[CryptoSchemeProfile]:
    if scheme in _SCHEME_REGISTRY:
        return _SCHEME_REGISTRY[scheme]
    lower = scheme.lower()
    for k, v in _SCHEME_REGISTRY.items():
        if k.lower() == lower:
            return v
    return None


def is_scheme_allowed_for_new_systems(scheme: str) -> bool:
    profile = get_scheme_profile(scheme)
    return profile.recommended_for_new_systems if profile else False


def get_migration_priority(scheme: str) -> int:
    profile = get_scheme_profile(scheme)
    return profile.migration_priority if profile else 1


def get_expected_quantum_break_year(scheme: str) -> Optional[int]:
    profile = get_scheme_profile(scheme)
    return profile.estimated_quantum_break_year if profile else None


def registry_snapshot() -> Dict[str, Dict]:
    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "schemes": {k: asdict(v) for k, v in _SCHEME_REGISTRY.items()},
    }