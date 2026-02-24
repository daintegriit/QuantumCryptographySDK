# backend/policy/parameter_validation.py
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple


# ============================================================
# Models
# ============================================================

@dataclass
class NormalizedParams:
    input_scheme: str
    input_parameter_set: str

    scheme: str                 # canonical scheme name e.g. "ML-KEM", "Kyber", "NTRU"
    parameter_set: str          # canonical parameter e.g. "ML-KEM-768"
    security_level: Optional[str]

    valid: bool
    errors: List[str]
    warnings: List[str]


# ============================================================
# Canonical Catalog
# ============================================================

# Canonical mapping: scheme -> allowed canonical parameter sets
CANONICAL_PARAMS: Dict[str, List[str]] = {
    "ML-KEM": ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"],
    "Kyber": ["Kyber512", "Kyber768", "Kyber1024"],
    "NTRU": ["NTRU-HPS-2048-509", "NTRU-HRSS-701"],
    # Future-ready placeholders:
    "FHE": ["BFV", "CKKS", "TFHE"],
    "EXPERIMENTAL": ["*"],
}

# Aliases for schemes (what users/devs might type)
SCHEME_ALIASES: Dict[str, str] = {
    "MLKEM": "ML-KEM",
    "ML-KEM": "ML-KEM",
    "ML_KEM": "ML-KEM",
    "KEM": "ML-KEM",  # if someone says just "KEM", treat as ML-KEM default
    "KYBER": "Kyber",
    "NTRU": "NTRU",
    "FHE": "FHE",
    "HOMOMORPHIC": "FHE",
    "EXPERIMENTAL": "EXPERIMENTAL",
}

# Aliases for parameter sets (normalize common variations)
PARAM_ALIASES: Dict[str, str] = {
    # ML-KEM
    "MLKEM512": "ML-KEM-512",
    "MLKEM768": "ML-KEM-768",
    "MLKEM1024": "ML-KEM-1024",
    "ML-KEM512": "ML-KEM-512",
    "ML-KEM768": "ML-KEM-768",
    "ML-KEM1024": "ML-KEM-1024",

    # Kyber
    "KYBER512": "Kyber512",
    "KYBER768": "Kyber768",
    "KYBER1024": "Kyber1024",
    "KYBER-512": "Kyber512",
    "KYBER-768": "Kyber768",
    "KYBER-1024": "Kyber1024",

    # NTRU
    "NTRUHPS2048509": "NTRU-HPS-2048-509",
    "NTRU-HPS2048-509": "NTRU-HPS-2048-509",
    "NTRUHRSS701": "NTRU-HRSS-701",
    "NTRU-HRSS701": "NTRU-HRSS-701",

    # FHE
    "CKKS": "CKKS",
    "BFV": "BFV",
    "TFHE": "TFHE",
}

# ============================================================
# Security Level Heuristic
# ============================================================

def infer_security_level(parameter_set: str) -> Optional[str]:
    p = (parameter_set or "").upper()
    if "ML-KEM-512" in p or "KYBER512" in p:
        return "NIST-L1"
    if "ML-KEM-768" in p or "KYBER768" in p:
        return "NIST-L3"
    if "ML-KEM-1024" in p or "KYBER1024" in p:
        return "NIST-L5"
    if "NTRU" in p:
        return "NIST-L1"
    return None


# ============================================================
# Normalization
# ============================================================

def _clean_token(s: str) -> str:
    """
    Uppercase and strip non-alphanumerics except dashes.
    Useful for alias resolution.
    """
    s = (s or "").strip()
    if not s:
        return ""
    # Keep dashes for patterns but remove other separators
    s2 = re.sub(r"[^A-Za-z0-9\-]", "", s)
    return s2.upper()


def normalize_scheme(scheme: str) -> str:
    raw = _clean_token(scheme)
    if not raw:
        return "EXPERIMENTAL"
    return SCHEME_ALIASES.get(raw, scheme.strip())


def normalize_parameter_set(parameter_set: str) -> str:
    raw = _clean_token(parameter_set)
    if not raw:
        return ""
    # Direct alias resolution first
    if raw in PARAM_ALIASES:
        return PARAM_ALIASES[raw]

    # Try to normalize patterns:
    # e.g., "mlkem-768" -> ML-KEM-768
    m = re.match(r"MLKEM\-?(512|768|1024)$", raw)
    if m:
        return f"ML-KEM-{m.group(1)}"

    m = re.match(r"KYBER\-?(512|768|1024)$", raw)
    if m:
        return f"Kyber{m.group(1)}"

    # NTRU patterns (best-effort)
    if raw.startswith("NTRU") and "HPS" in raw and "2048" in raw and "509" in raw:
        return "NTRU-HPS-2048-509"
    if raw.startswith("NTRU") and "HRSS" in raw and "701" in raw:
        return "NTRU-HRSS-701"

    # Otherwise return original trimmed
    return parameter_set.strip()


# ============================================================
# Validation
# ============================================================

def validate_and_normalize(
    scheme: str,
    parameter_set: str,
) -> NormalizedParams:
    errors: List[str] = []
    warnings: List[str] = []

    scheme_norm = normalize_scheme(scheme)
    param_norm = normalize_parameter_set(parameter_set)
    sec_level = infer_security_level(param_norm)

    # Scheme must exist in catalog
    if scheme_norm not in CANONICAL_PARAMS:
        errors.append(f"Unknown scheme '{scheme_norm}'.")
        return NormalizedParams(
            input_scheme=scheme,
            input_parameter_set=parameter_set,
            scheme=scheme_norm,
            parameter_set=param_norm,
            security_level=sec_level,
            valid=False,
            errors=errors,
            warnings=warnings,
        )

    allowed = CANONICAL_PARAMS[scheme_norm]

    # Experimental scheme: allow anything but warn hard
    if scheme_norm == "EXPERIMENTAL":
        warnings.append("Scheme is EXPERIMENTAL; not suitable for long-term production.")
        return NormalizedParams(
            input_scheme=scheme,
            input_parameter_set=parameter_set,
            scheme=scheme_norm,
            parameter_set=param_norm or "*",
            security_level=None,
            valid=True,
            errors=[],
            warnings=warnings,
        )

    # Parameter required
    if not param_norm:
        errors.append("Missing parameter_set.")
        return NormalizedParams(
            input_scheme=scheme,
            input_parameter_set=parameter_set,
            scheme=scheme_norm,
            parameter_set=param_norm,
            security_level=sec_level,
            valid=False,
            errors=errors,
            warnings=warnings,
        )

    # Parameter must match scheme
    if "*" not in allowed and param_norm not in allowed:
        errors.append(
            f"Parameter set '{param_norm}' is not allowed for scheme '{scheme_norm}'. Allowed: {allowed}"
        )

    valid = (len(errors) == 0)

    # Soft warnings for safety
    if scheme_norm in ("FHE",):
        warnings.append("FHE params validated, but FHE is for computation, not long-term key durability claims.")

    return NormalizedParams(
        input_scheme=scheme,
        input_parameter_set=parameter_set,
        scheme=scheme_norm,
        parameter_set=param_norm,
        security_level=sec_level,
        valid=valid,
        errors=errors,
        warnings=warnings,
    )


def validate_and_normalize_dict(scheme: str, parameter_set: str) -> Dict[str, Any]:
    return asdict(validate_and_normalize(scheme, parameter_set))