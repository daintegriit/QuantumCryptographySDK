# backend/policy/parameter_validation.py
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional


@dataclass
class NormalizedParams:
    input_scheme: str
    input_parameter_set: str
    scheme: str
    parameter_set: str
    security_level: Optional[str]
    valid: bool
    errors: List[str]
    warnings: List[str]


# ============================================================
# Canonical Catalog
# ============================================================

CANONICAL_PARAMS: Dict[str, List[str]] = {
    # ── KEM ─────────────────────────────────────────────────
    "ML-KEM":   ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"],
    "Kyber":    ["Kyber512", "Kyber768", "Kyber1024"],
    "FrodoKEM": [
        "FrodoKEM-640-AES", "FrodoKEM-640-SHAKE",
        "FrodoKEM-976-AES", "FrodoKEM-976-SHAKE",
        "FrodoKEM-1344-AES", "FrodoKEM-1344-SHAKE",
    ],
    "BIKE": ["BIKE-L1", "BIKE-L3", "BIKE-L5"],
    "NTRU": ["NTRU-HPS-2048-509", "NTRU-HPS-2048-677", "NTRU-HRSS-701"],
    "Classic-McEliece": [
        "Classic-McEliece-348864", "Classic-McEliece-348864f",
        "Classic-McEliece-460896", "Classic-McEliece-460896f",
        "Classic-McEliece-6688128", "Classic-McEliece-6688128f",
        "Classic-McEliece-6960119", "Classic-McEliece-6960119f",
        "Classic-McEliece-8192128", "Classic-McEliece-8192128f",
    ],

    # ── Signatures ──────────────────────────────────────────
    "Dilithium": ["Dilithium2", "Dilithium3", "Dilithium5"],
    "ML-DSA":   ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
    "Falcon":   [
        "Falcon-512", "Falcon-1024",
        "Falcon-padded-512", "Falcon-padded-1024",
    ],
    "SPHINCS+": [
        "SPHINCS+-SHA2-128f-simple", "SPHINCS+-SHA2-128s-simple",
        "SPHINCS+-SHA2-192f-simple", "SPHINCS+-SHA2-192s-simple",
        "SPHINCS+-SHA2-256f-simple", "SPHINCS+-SHA2-256s-simple",
        "SPHINCS+-SHAKE-128f-simple", "SPHINCS+-SHAKE-128s-simple",
        "SPHINCS+-SHAKE-192f-simple", "SPHINCS+-SHAKE-192s-simple",
        "SPHINCS+-SHAKE-256f-simple", "SPHINCS+-SHAKE-256s-simple",
    ],
    "SLH-DSA": [
        "SLH_DSA_PURE_SHA2_128F", "SLH_DSA_PURE_SHA2_128S",
        "SLH_DSA_PURE_SHA2_192F", "SLH_DSA_PURE_SHA2_192S",
        "SLH_DSA_PURE_SHA2_256F", "SLH_DSA_PURE_SHA2_256S",
        "SLH_DSA_PURE_SHAKE_128F", "SLH_DSA_PURE_SHAKE_128S",
        "SLH_DSA_PURE_SHAKE_192F", "SLH_DSA_PURE_SHAKE_192S",
        "SLH_DSA_PURE_SHAKE_256F", "SLH_DSA_PURE_SHAKE_256S",
    ],
    "MAYO": ["MAYO-1", "MAYO-2", "MAYO-3", "MAYO-5"],

    # ── Other ───────────────────────────────────────────────
    "FHE":          ["BFV", "CKKS", "TFHE"],
    "EXPERIMENTAL": ["*"],
}


SCHEME_ALIASES: Dict[str, str] = {
    # KEM
    "MLKEM": "ML-KEM", "ML-KEM": "ML-KEM", "ML_KEM": "ML-KEM", "KEM": "ML-KEM",
    "KYBER": "Kyber",
    "FRODOKEM": "FrodoKEM", "FRODO": "FrodoKEM",
    "BIKE": "BIKE",
    "NTRU": "NTRU",
    "CLASSIC-MCELIECE": "Classic-McEliece", "MCELIECE": "Classic-McEliece",
    "CLASSICMCELIECE": "Classic-McEliece",
    # Signatures
    "DILITHIUM": "Dilithium",
    "MLDSA": "Dilithium", "ML-DSA": "Dilithium", "ML_DSA": "Dilithium",
    "FALCON": "Falcon",
    "SPHINCS": "SPHINCS+", "SPHINCS+": "SPHINCS+",
    "SLHDSA": "SLH-DSA", "SLH-DSA": "SLH-DSA", "SLH_DSA": "SLH-DSA",
    "MAYO": "MAYO",
    "CROSS": "CROSS", "SNOVA": "SNOVA", "OV": "OV",
    # Other
    "FHE": "FHE", "HOMOMORPHIC": "FHE", "EXPERIMENTAL": "EXPERIMENTAL",
}


PARAM_ALIASES: Dict[str, str] = {
    # ── ML-KEM ──────────────────────────────────────────────
    "ML-KEM-512": "ML-KEM-512", "ML-KEM-768": "ML-KEM-768", "ML-KEM-1024": "ML-KEM-1024",
    "MLKEM512": "ML-KEM-512", "MLKEM768": "ML-KEM-768", "MLKEM1024": "ML-KEM-1024",
    # ── Kyber ───────────────────────────────────────────────
    "KYBER512": "Kyber512", "KYBER768": "Kyber768", "KYBER1024": "Kyber1024",
    "KYBER-512": "Kyber512", "KYBER-768": "Kyber768", "KYBER-1024": "Kyber1024",
    # ── BIKE ────────────────────────────────────────────────
    "BIKE-L1": "BIKE-L1", "BIKE-L3": "BIKE-L3", "BIKE-L5": "BIKE-L5",
    "BIKEL1": "BIKE-L1", "BIKEL3": "BIKE-L3", "BIKEL5": "BIKE-L5",
    # ── FrodoKEM ────────────────────────────────────────────
    "FRODOKEM-640-AES": "FrodoKEM-640-AES", "FRODOKEM-640-SHAKE": "FrodoKEM-640-SHAKE",
    "FRODOKEM-976-AES": "FrodoKEM-976-AES", "FRODOKEM-976-SHAKE": "FrodoKEM-976-SHAKE",
    "FRODOKEM-1344-AES": "FrodoKEM-1344-AES", "FRODOKEM-1344-SHAKE": "FrodoKEM-1344-SHAKE",
    # ── NTRU ────────────────────────────────────────────────
    "NTRU-HPS-2048-509": "NTRU-HPS-2048-509", "NTRU-HPS-2048-677": "NTRU-HPS-2048-677",
    "NTRU-HRSS-701": "NTRU-HRSS-701",
    # ── Dilithium / ML-DSA ──────────────────────────────────
    "DILITHIUM2": "Dilithium2", "DILITHIUM3": "Dilithium3", "DILITHIUM5": "Dilithium5",
    "DILITHIUM-2": "Dilithium2", "DILITHIUM-3": "Dilithium3", "DILITHIUM-5": "Dilithium5",
    "ML-DSA-44": "Dilithium2", "ML-DSA-65": "Dilithium3", "ML-DSA-87": "Dilithium5",
    "MLDSA44": "Dilithium2", "MLDSA65": "Dilithium3", "MLDSA87": "Dilithium5",
    # ── Falcon ──────────────────────────────────────────────
    "FALCON512": "Falcon-512", "FALCON1024": "Falcon-1024",
    "FALCON-512": "Falcon-512", "FALCON-1024": "Falcon-1024",
    "FALCON-PADDED-512": "Falcon-padded-512", "FALCON-PADDED-1024": "Falcon-padded-1024",
    "FALCONPADDED512": "Falcon-padded-512", "FALCONPADDED1024": "Falcon-padded-1024",
    # ── SPHINCS+ ────────────────────────────────────────────
    "SPHINCS-SHA2-128F": "SPHINCS+-SHA2-128f-simple",
    "SPHINCS-SHA2-128S": "SPHINCS+-SHA2-128s-simple",
    "SPHINCS-SHA2-192F": "SPHINCS+-SHA2-192f-simple",
    "SPHINCS-SHA2-192S": "SPHINCS+-SHA2-192s-simple",
    "SPHINCS-SHA2-256F": "SPHINCS+-SHA2-256f-simple",
    "SPHINCS-SHA2-256S": "SPHINCS+-SHA2-256s-simple",
    "SPHINCS-SHAKE-128F": "SPHINCS+-SHAKE-128f-simple",
    "SPHINCS-SHAKE-128S": "SPHINCS+-SHAKE-128s-simple",
    "SPHINCS-SHAKE-192F": "SPHINCS+-SHAKE-192f-simple",
    "SPHINCS-SHAKE-192S": "SPHINCS+-SHAKE-192s-simple",
    "SPHINCS-SHAKE-256F": "SPHINCS+-SHAKE-256f-simple",
    "SPHINCS-SHAKE-256S": "SPHINCS+-SHAKE-256s-simple",
    "SPHINCS+-SHA2-128F-SIMPLE": "SPHINCS+-SHA2-128f-simple",
    "SPHINCS+-SHA2-128S-SIMPLE": "SPHINCS+-SHA2-128s-simple",
    "SPHINCS+-SHA2-192F-SIMPLE": "SPHINCS+-SHA2-192f-simple",
    "SPHINCS+-SHA2-192S-SIMPLE": "SPHINCS+-SHA2-192s-simple",
    "SPHINCS+-SHA2-256F-SIMPLE": "SPHINCS+-SHA2-256f-simple",
    "SPHINCS+-SHA2-256S-SIMPLE": "SPHINCS+-SHA2-256s-simple",
    "SPHINCS+-SHAKE-128F-SIMPLE": "SPHINCS+-SHAKE-128f-simple",
    "SPHINCS+-SHAKE-128S-SIMPLE": "SPHINCS+-SHAKE-128s-simple",
    "SPHINCS+-SHAKE-192F-SIMPLE": "SPHINCS+-SHAKE-192f-simple",
    "SPHINCS+-SHAKE-192S-SIMPLE": "SPHINCS+-SHAKE-192s-simple",
    "SPHINCS+-SHAKE-256F-SIMPLE": "SPHINCS+-SHAKE-256f-simple",
    "SPHINCS+-SHAKE-256S-SIMPLE": "SPHINCS+-SHAKE-256s-simple",
    # ── SLH-DSA ─────────────────────────────────────────────
    "SLH_DSA_PURE_SHA2_128F": "SLH_DSA_PURE_SHA2_128F",
    "SLH_DSA_PURE_SHA2_128S": "SLH_DSA_PURE_SHA2_128S",
    "SLH_DSA_PURE_SHA2_192F": "SLH_DSA_PURE_SHA2_192F",
    "SLH_DSA_PURE_SHA2_192S": "SLH_DSA_PURE_SHA2_192S",
    "SLH_DSA_PURE_SHA2_256F": "SLH_DSA_PURE_SHA2_256F",
    "SLH_DSA_PURE_SHA2_256S": "SLH_DSA_PURE_SHA2_256S",
    "SLH_DSA_PURE_SHAKE_128F": "SLH_DSA_PURE_SHAKE_128F",
    "SLH_DSA_PURE_SHAKE_128S": "SLH_DSA_PURE_SHAKE_128S",
    "SLH_DSA_PURE_SHAKE_192F": "SLH_DSA_PURE_SHAKE_192F",
    "SLH_DSA_PURE_SHAKE_192S": "SLH_DSA_PURE_SHAKE_192S",
    "SLH_DSA_PURE_SHAKE_256F": "SLH_DSA_PURE_SHAKE_256F",
    "SLH_DSA_PURE_SHAKE_256S": "SLH_DSA_PURE_SHAKE_256S",
    # Hyphen variants
    "SLH-DSA-SHA2-128F": "SLH_DSA_PURE_SHA2_128F",
    "SLH-DSA-SHA2-128S": "SLH_DSA_PURE_SHA2_128S",
    "SLH-DSA-SHA2-192F": "SLH_DSA_PURE_SHA2_192F",
    "SLH-DSA-SHA2-192S": "SLH_DSA_PURE_SHA2_192S",
    "SLH-DSA-SHA2-256F": "SLH_DSA_PURE_SHA2_256F",
    "SLH-DSA-SHA2-256S": "SLH_DSA_PURE_SHA2_256S",
    "SLH-DSA-SHAKE-128F": "SLH_DSA_PURE_SHAKE_128F",
    "SLH-DSA-SHAKE-128S": "SLH_DSA_PURE_SHAKE_128S",
    "SLH-DSA-SHAKE-192F": "SLH_DSA_PURE_SHAKE_192F",
    "SLH-DSA-SHAKE-192S": "SLH_DSA_PURE_SHAKE_192S",
    "SLH-DSA-SHAKE-256F": "SLH_DSA_PURE_SHAKE_256F",
    "SLH-DSA-SHAKE-256S": "SLH_DSA_PURE_SHAKE_256S",
    # ── MAYO ────────────────────────────────────────────────
    "MAYO-1": "MAYO-1", "MAYO-2": "MAYO-2", "MAYO-3": "MAYO-3", "MAYO-5": "MAYO-5",
    "MAYO1": "MAYO-1", "MAYO2": "MAYO-2", "MAYO3": "MAYO-3", "MAYO5": "MAYO-5",
    # ── FHE ─────────────────────────────────────────────────
    "CKKS": "CKKS", "BFV": "BFV", "TFHE": "TFHE",
}


# ============================================================
# Security Level Heuristic
# ============================================================

def infer_security_level(parameter_set: str) -> Optional[str]:
    p = (parameter_set or "").upper()

    # KEM
    if any(x in p for x in ["ML-KEM-512", "KYBER512", "640", "BIKE-L1"]): return "NIST-L1"
    if any(x in p for x in ["ML-KEM-768", "KYBER768", "976", "BIKE-L3"]): return "NIST-L3"
    if any(x in p for x in ["ML-KEM-1024", "KYBER1024", "1344", "BIKE-L5"]): return "NIST-L5"

    # Dilithium / ML-DSA
    if "DILITHIUM2" in p or "ML-DSA-44" in p: return "NIST-L2"
    if "DILITHIUM3" in p or "ML-DSA-65" in p: return "NIST-L3"
    if "DILITHIUM5" in p or "ML-DSA-87" in p: return "NIST-L5"

    # Falcon
    if "FALCON" in p and "1024" in p: return "NIST-L5"
    if "FALCON" in p and "512" in p:  return "NIST-L1"

    # SPHINCS+ / SLH-DSA
    if "SPHINCS" in p or "SLH_DSA" in p or "SLH-DSA" in p:
        if "256" in p: return "NIST-L5"
        if "192" in p: return "NIST-L3"
        if "128" in p: return "NIST-L1"

    # MAYO
    if "MAYO-1" in p: return "NIST-L1"
    if "MAYO-2" in p: return "NIST-L2"
    if "MAYO-3" in p: return "NIST-L3"
    if "MAYO-5" in p: return "NIST-L5"

    # FrodoKEM
    if "640" in p:  return "NIST-L1"
    if "976" in p:  return "NIST-L3"
    if "1344" in p: return "NIST-L5"

    # Classic McEliece
    if "348864" in p: return "NIST-L1"
    if "460896" in p: return "NIST-L3"
    if any(x in p for x in ["6688128", "6960119", "8192128"]): return "NIST-L5"

    # NTRU
    if "NTRU" in p: return "NIST-L1"

    return None


# ============================================================
# Normalization
# ============================================================

def _clean_token(s: str) -> str:
    s = (s or "").strip()
    if not s: return ""
    s2 = re.sub(r"[^A-Za-z0-9\-\+\_]", "", s)
    return s2.upper()


def normalize_scheme(scheme: str) -> str:
    raw = _clean_token(scheme)
    if not raw: return "EXPERIMENTAL"
    return SCHEME_ALIASES.get(raw, scheme.strip())


def normalize_parameter_set(parameter_set: str) -> str:
    raw = _clean_token(parameter_set)
    if not raw: return ""

    if raw in PARAM_ALIASES:
        return PARAM_ALIASES[raw]

    # ML-KEM
    m = re.match(r"MLKEM\-?(512|768|1024)$", raw)
    if m: return f"ML-KEM-{m.group(1)}"

    # Kyber
    m = re.match(r"KYBER\-?(512|768|1024)$", raw)
    if m: return f"Kyber{m.group(1)}"

    # Dilithium
    m = re.match(r"DILITHIUM\-?(2|3|5)$", raw)
    if m: return f"Dilithium{m.group(1)}"

    # ML-DSA FIPS
    m = re.match(r"ML-DSA-(44|65|87)$", raw)
    if m:
        return {"44": "Dilithium2", "65": "Dilithium3", "87": "Dilithium5"}[m.group(1)]

    # Falcon
    m = re.match(r"FALCON\-?(512|1024)$", raw)
    if m: return f"Falcon-{m.group(1)}"

    m = re.match(r"FALCON-PADDED-?(512|1024)$", raw)
    if m: return f"Falcon-padded-{m.group(1)}"

    # BIKE
    m = re.match(r"BIKE-?L?(1|3|5)$", raw)
    if m: return f"BIKE-L{m.group(1)}"

    # SLH-DSA pure
    m = re.match(r"SLH[-_]DSA[-_](?:PURE[-_])?(SHA2|SHAKE|SHA3)[-_](\d+)(F|S)$", raw)
    if m: return f"SLH_DSA_PURE_{m.group(1)}_{m.group(2)}{m.group(3)}"

    # SPHINCS+
    if raw.startswith("SPHINCS"):
        m = re.match(r"SPHINCS\+?[-_]?(SHA2|SHAKE)[-_](\d+)(F|S)(?:[-_]SIMPLE)?$", raw)
        if m:
            h = m.group(1); bits = m.group(2); v = m.group(3).lower()
            return f"SPHINCS+-{h}-{bits}{v}-simple"
        return parameter_set.strip()

    # FrodoKEM
    m = re.match(r"FRODO(?:KEM)?[-]?(\d+)[-]?(AES|SHAKE)$", raw)
    if m: return f"FrodoKEM-{m.group(1)}-{m.group(2).capitalize()}"

    # MAYO
    m = re.match(r"MAYO[-_]?(\d)$", raw)
    if m: return f"MAYO-{m.group(1)}"

    # NTRU
    if raw.startswith("NTRU"):
        if "509" in raw: return "NTRU-HPS-2048-509"
        if "677" in raw: return "NTRU-HPS-2048-677"
        if "701" in raw: return "NTRU-HRSS-701"

    # Classic McEliece — pass through
    if "MCELIECE" in raw:
        suffix = re.sub(r"CLASSIC[-_]?MCELIECE[-_]?", "", raw)
        return f"Classic-McEliece-{suffix}"

    return parameter_set.strip()


# ============================================================
# Validation
# ============================================================

def validate_and_normalize(scheme: str, parameter_set: str) -> NormalizedParams:
    errors: List[str] = []
    warnings: List[str] = []

    scheme_norm = normalize_scheme(scheme)
    param_norm  = normalize_parameter_set(parameter_set)
    sec_level   = infer_security_level(param_norm)

    if scheme_norm not in CANONICAL_PARAMS:
        errors.append(f"Unknown scheme '{scheme_norm}'.")
        return NormalizedParams(
            input_scheme=scheme, input_parameter_set=parameter_set,
            scheme=scheme_norm, parameter_set=param_norm,
            security_level=sec_level, valid=False,
            errors=errors, warnings=warnings,
        )

    allowed = CANONICAL_PARAMS[scheme_norm]

    if scheme_norm == "EXPERIMENTAL":
        warnings.append("Scheme is EXPERIMENTAL; not suitable for production.")
        return NormalizedParams(
            input_scheme=scheme, input_parameter_set=parameter_set,
            scheme=scheme_norm, parameter_set=param_norm or "*",
            security_level=None, valid=True, errors=[], warnings=warnings,
        )

    if not param_norm:
        errors.append("Missing parameter_set.")
        return NormalizedParams(
            input_scheme=scheme, input_parameter_set=parameter_set,
            scheme=scheme_norm, parameter_set=param_norm,
            security_level=sec_level, valid=False,
            errors=errors, warnings=warnings,
        )

    if "*" not in allowed and param_norm not in allowed:
        errors.append(
            f"Parameter set '{param_norm}' is not allowed for scheme "
            f"'{scheme_norm}'. Allowed: {allowed}"
        )

    valid = len(errors) == 0

    # Scheme-specific warnings
    if scheme_norm == "FHE":
        warnings.append("FHE is for computation, not long-term key durability.")
    if scheme_norm == "Falcon":
        warnings.append("Falcon: prefer padded variants for constant-time safety.")
    if scheme_norm in ("SPHINCS+", "SLH-DSA"):
        warnings.append("SLH-DSA/SPHINCS+ signatures are large (8KB–50KB); verify transport.")
    if scheme_norm == "FrodoKEM":
        warnings.append("FrodoKEM has large keys/ciphertexts; verify transport capacity.")
    if scheme_norm == "BIKE":
        warnings.append("BIKE is a newer NIST standard (2025); verify implementation maturity.")
    if scheme_norm == "MAYO":
        warnings.append("MAYO is a research candidate — NOT approved for production.")
    if scheme_norm == "Classic-McEliece":
        warnings.append("Classic-McEliece has very large public keys (100KB+).")

    return NormalizedParams(
        input_scheme=scheme, input_parameter_set=parameter_set,
        scheme=scheme_norm, parameter_set=param_norm,
        security_level=sec_level, valid=valid,
        errors=errors, warnings=warnings,
    )


def validate_and_normalize_dict(scheme: str, parameter_set: str) -> Dict[str, Any]:
    return asdict(validate_and_normalize(scheme, parameter_set))