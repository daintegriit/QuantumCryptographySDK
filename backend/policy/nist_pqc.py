# backend/policy/nist_pqc.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def normalize_scheme(s: str) -> str:
    raw = (s or "").strip().lower()
    _MAP = {
        # KEM
        "kyber": "Kyber", "ml-kem": "ML-KEM", "mlkem": "ML-KEM",
        "frodokem": "FrodoKEM", "frodo": "FrodoKEM",
        "bike": "BIKE",
        "ntru": "NTRU",
        "classic-mceliece": "Classic-McEliece", "mceliece": "Classic-McEliece",
        "sntrup": "sntrup761",
        # Signatures
        "dilithium": "Dilithium", "ml-dsa": "Dilithium", "mldsa": "Dilithium",
        "falcon": "Falcon",
        "sphincs": "SPHINCS+", "sphincs+": "SPHINCS+",
        "slh-dsa": "SLH-DSA", "slhdsa": "SLH-DSA", "slh_dsa": "SLH-DSA",
        "mayo": "MAYO",
        "cross": "CROSS",
        "snova": "SNOVA",
        "ov": "OV",
        # Other
        "fhe": "FHE", "experimental": "EXPERIMENTAL",
    }
    return _MAP.get(raw, s.strip().capitalize())


def normalize_param(p: str) -> str:
    if not p:
        return p
    p = p.strip()
    pl = p.lower().replace("_", "-")

    # Kyber
    if pl.startswith("kyber"):
        num = pl.replace("kyber", "").replace("-", "")
        if num in ("512", "768", "1024"): return f"Kyber{num}"
    # ML-KEM
    if pl.startswith("ml-kem-"):
        num = pl.replace("ml-kem-", "")
        if num in ("512", "768", "1024"): return f"ML-KEM-{num}"
    # Dilithium
    if pl.startswith("dilithium"):
        num = pl.replace("dilithium", "").replace("-", "")
        if num in ("2", "3", "5"): return f"Dilithium{num}"
    # ML-DSA
    if pl.startswith("ml-dsa-"):
        mapping = {"44": "Dilithium2", "65": "Dilithium3", "87": "Dilithium5"}
        n = pl.replace("ml-dsa-", "")
        if n in mapping: return mapping[n]
    # Falcon
    if pl.startswith("falcon"):
        if "padded" in pl:
            num = "1024" if "1024" in pl else "512"
            return f"Falcon-padded-{num}"
        num = "1024" if "1024" in pl else "512" if "512" in pl else ""
        if num: return f"Falcon-{num}"
    # SPHINCS+
    if pl.startswith("sphincs"):
        import re
        m = re.match(r"sphincs[+-]?(sha2|shake)-(\d+)(f|s)(?:-simple)?$", pl)
        if m:
            return f"SPHINCS+-{m.group(1).upper()}-{m.group(2)}{m.group(3).lower()}-simple"
        return p
    # SLH-DSA pure (FIPS 205)
    if pl.startswith("slh-dsa") or pl.startswith("slh_dsa"):
        import re
        # already canonical underscore format
        if p.startswith("SLH_DSA_PURE_"): return p
        m = re.match(r"slh[-_]dsa[-_](?:pure[-_])?(sha2|shake|sha3)[-_](\d+)(f|s)$", pl)
        if m:
            return f"SLH_DSA_PURE_{m.group(1).upper()}_{m.group(2)}{m.group(3).upper()}"
    # BIKE
    if pl.startswith("bike"):
        if "l1" in pl or "1" in pl: return "BIKE-L1"
        if "l3" in pl or "3" in pl: return "BIKE-L3"
        if "l5" in pl or "5" in pl: return "BIKE-L5"
    # MAYO
    if pl.startswith("mayo"):
        import re
        m = re.match(r"mayo[-_]?(\d)", pl)
        if m: return f"MAYO-{m.group(1)}"
    # FrodoKEM
    if pl.startswith("frodokem") or pl.startswith("frodo"):
        import re
        m = re.match(r"frodo(?:kem)?[-]?(\d+)[-]?(aes|shake)$", pl)
        if m:
            return f"FrodoKEM-{m.group(1)}-{m.group(2).upper()}"
    # NTRU
    if pl.startswith("ntru"):
        if "509" in pl: return "NTRU-HPS-2048-509"
        if "677" in pl: return "NTRU-HPS-2048-677"
        if "701" in pl: return "NTRU-HRSS-701"
    # Classic McEliece
    if "mceliece" in pl:
        suffix = p.replace("Classic-McEliece-", "").replace("classic-mceliece-", "")
        return f"Classic-McEliece-{suffix}"

    return p.strip()


@dataclass(frozen=True)
class SchemePolicy:
    scheme: str
    primitive: str
    approved: bool
    allowed_params: List[str]
    default_security_level: str
    min_longevity_years: int
    base_risk: float
    notes: str = ""


@dataclass
class PolicyDecision:
    timestamp_utc: str
    profile: str
    allowed: bool
    risk_score: float
    security_level: str
    required_actions: List[str]
    warnings: List[str]
    errors: List[str]
    inputs: Dict[str, Any]
    normalized: Dict[str, Any]


DEFAULT_PROFILE = "enterprise-default"


def get_profile(profile: str = DEFAULT_PROFILE) -> Dict[str, SchemePolicy]:
    policies = [

        # ── KEMs ────────────────────────────────────────────

        SchemePolicy(
            scheme="Kyber", primitive="KEM", approved=True,
            allowed_params=["Kyber512", "Kyber768", "Kyber1024"],
            default_security_level="NIST-L1", min_longevity_years=30, base_risk=0.15,
            notes="CRYSTALS-Kyber / ML-KEM predecessor name",
        ),
        SchemePolicy(
            scheme="ML-KEM", primitive="KEM", approved=True,
            allowed_params=["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"],
            default_security_level="NIST-L1", min_longevity_years=30, base_risk=0.12,
            notes="FIPS 203 standardized KEM — preferred over Kyber name",
        ),
        SchemePolicy(
            scheme="FrodoKEM", primitive="KEM", approved=True,
            allowed_params=[
                "FrodoKEM-640-AES", "FrodoKEM-640-SHAKE",
                "FrodoKEM-976-AES", "FrodoKEM-976-SHAKE",
                "FrodoKEM-1344-AES", "FrodoKEM-1344-SHAKE",
            ],
            default_security_level="NIST-L1", min_longevity_years=30, base_risk=0.18,
            notes="Conservative LWE-based KEM; larger ciphertexts",
        ),
        SchemePolicy(
            scheme="BIKE", primitive="KEM", approved=True,
            allowed_params=["BIKE-L1", "BIKE-L3", "BIKE-L5"],
            default_security_level="NIST-L1", min_longevity_years=25, base_risk=0.22,
            notes="NIST additional KEM (2025); code-based; conservative diversification choice",
        ),
        SchemePolicy(
            scheme="NTRU", primitive="KEM", approved=True,
            allowed_params=["NTRU-HPS-2048-509", "NTRU-HPS-2048-677", "NTRU-HRSS-701"],
            default_security_level="NIST-L1", min_longevity_years=25, base_risk=0.22,
            notes="Lattice-based KEM; good diversification candidate",
        ),
        SchemePolicy(
            scheme="Classic-McEliece", primitive="KEM", approved=True,
            allowed_params=[
                "Classic-McEliece-348864", "Classic-McEliece-348864f",
                "Classic-McEliece-460896", "Classic-McEliece-460896f",
                "Classic-McEliece-6688128", "Classic-McEliece-6688128f",
                "Classic-McEliece-6960119", "Classic-McEliece-6960119f",
                "Classic-McEliece-8192128", "Classic-McEliece-8192128f",
            ],
            default_security_level="NIST-L1", min_longevity_years=30, base_risk=0.15,
            notes="Code-based KEM; very large keys but 50-year security track record",
        ),

        # ── Signatures ──────────────────────────────────────

        SchemePolicy(
            scheme="Dilithium", primitive="SIG", approved=True,
            allowed_params=["Dilithium2", "Dilithium3", "Dilithium5",
                            "ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
            default_security_level="NIST-L2", min_longevity_years=30, base_risk=0.12,
            notes="FIPS 204 ML-DSA / CRYSTALS-Dilithium; primary PQC signature",
        ),
        SchemePolicy(
            scheme="Falcon", primitive="SIG", approved=True,
            allowed_params=["Falcon-512", "Falcon-1024",
                            "Falcon-padded-512", "Falcon-padded-1024"],
            default_security_level="NIST-L1", min_longevity_years=30, base_risk=0.18,
            notes="FIPS 206; compact signatures; padded variants for constant-time",
        ),
        SchemePolicy(
            scheme="SPHINCS+", primitive="SIG", approved=True,
            allowed_params=[
                "SPHINCS+-SHA2-128f-simple", "SPHINCS+-SHA2-128s-simple",
                "SPHINCS+-SHA2-192f-simple", "SPHINCS+-SHA2-192s-simple",
                "SPHINCS+-SHA2-256f-simple", "SPHINCS+-SHA2-256s-simple",
                "SPHINCS+-SHAKE-128f-simple", "SPHINCS+-SHAKE-128s-simple",
                "SPHINCS+-SHAKE-192f-simple", "SPHINCS+-SHAKE-192s-simple",
                "SPHINCS+-SHAKE-256f-simple", "SPHINCS+-SHAKE-256s-simple",
            ],
            default_security_level="NIST-L1", min_longevity_years=30, base_risk=0.20,
            notes="FIPS 205 / SLH-DSA predecessor name; deprecated in liboqs 0.16",
        ),
        SchemePolicy(
            scheme="SLH-DSA", primitive="SIG", approved=True,
            allowed_params=[
                "SLH_DSA_PURE_SHA2_128F", "SLH_DSA_PURE_SHA2_128S",
                "SLH_DSA_PURE_SHA2_192F", "SLH_DSA_PURE_SHA2_192S",
                "SLH_DSA_PURE_SHA2_256F", "SLH_DSA_PURE_SHA2_256S",
                "SLH_DSA_PURE_SHAKE_128F", "SLH_DSA_PURE_SHAKE_128S",
                "SLH_DSA_PURE_SHAKE_192F", "SLH_DSA_PURE_SHAKE_192S",
                "SLH_DSA_PURE_SHAKE_256F", "SLH_DSA_PURE_SHAKE_256S",
            ],
            default_security_level="NIST-L1", min_longevity_years=30, base_risk=0.20,
            notes="FIPS 205 standardized SLH-DSA; pure = no prehash; replaces SPHINCS+",
        ),
        SchemePolicy(
            scheme="MAYO", primitive="SIG", approved=False,
            allowed_params=["MAYO-1", "MAYO-2", "MAYO-3", "MAYO-5"],
            default_security_level="NIST-L1", min_longevity_years=10, base_risk=0.35,
            notes="NIST Additional Signatures Round 2 candidate; not yet standardized",
        ),

        # ── Other ────────────────────────────────────────────

        SchemePolicy(
            scheme="FHE", primitive="FHE", approved=False,
            allowed_params=["BFV", "CKKS", "TFHE"],
            default_security_level="N/A", min_longevity_years=0, base_risk=0.55,
        ),
        SchemePolicy(
            scheme="EXPERIMENTAL", primitive="EXPERIMENTAL", approved=False,
            allowed_params=["*"],
            default_security_level="N/A", min_longevity_years=0, base_risk=0.85,
        ),
    ]
    return {p.scheme: p for p in policies}


def infer_security_level_from_param(param: str) -> Optional[str]:
    p = (param or "").upper()

    # KEM by key size
    if "ML-KEM-512" in p or "KYBER512" in p or "640" in p or "BIKE-L1" in p: return "NIST-L1"
    if "ML-KEM-768" in p or "KYBER768" in p or "976" in p or "BIKE-L3" in p: return "NIST-L3"
    if "ML-KEM-1024" in p or "KYBER1024" in p or "1344" in p or "BIKE-L5" in p: return "NIST-L5"

    # Dilithium / ML-DSA
    if "DILITHIUM2" in p or "ML-DSA-44" in p: return "NIST-L2"
    if "DILITHIUM3" in p or "ML-DSA-65" in p: return "NIST-L3"
    if "DILITHIUM5" in p or "ML-DSA-87" in p: return "NIST-L5"

    # Falcon
    if "FALCON" in p and "1024" in p: return "NIST-L5"
    if "FALCON" in p and "512"  in p: return "NIST-L1"

    # SPHINCS+ / SLH-DSA — by bit security
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

    # NTRU
    if "NTRU" in p: return "NIST-L1"

    # Classic McEliece — by parameter
    if "348864" in p: return "NIST-L1"
    if "460896" in p: return "NIST-L3"
    if "6688128" in p or "6960119" in p or "8192128" in p: return "NIST-L5"

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
    compliance_tags = compliance_tags or []
    policies = get_profile(profile)
    ts = utc_now_iso()
    errors: List[str] = []
    warnings: List[str] = []
    actions: List[str] = []

    scheme_raw = scheme
    param_raw = parameter_set
    scheme = normalize_scheme(scheme)
    param = normalize_param(parameter_set)

    if scheme not in policies:
        return PolicyDecision(
            timestamp_utc=ts, profile=profile,
            allowed=False, risk_score=0.95,
            security_level="UNKNOWN",
            required_actions=["BLOCK"],
            warnings=[f"Unknown scheme '{scheme}'"],
            errors=[f"'{scheme}' not in policy matrix"],
            inputs={"scheme": scheme_raw, "parameter_set": param_raw},
            normalized={"scheme": scheme, "parameter_set": param},
        )

    pol = policies[scheme]

    if "*" not in pol.allowed_params and param not in pol.allowed_params:
        errors.append(
            f"Parameter '{param}' not allowed for '{scheme}'. "
            f"Allowed: {pol.allowed_params}"
        )

    inferred = infer_security_level_from_param(param)
    level = claimed_security_level or inferred or pol.default_security_level
    longevity = estimated_longevity_years or pol.min_longevity_years

    if longevity >= 40:
        if not migration_ready:
            errors.append("40+ year keys must be migration ready")
        else:
            actions.append("MAINTAIN_MIGRATION_PLAN")
    if longevity >= 30:
        actions.append("SCHEDULE_REVALIDATION")

    risk = pol.base_risk
    if not pol.approved:   risk += 0.25
    if is_deprecated:      risk += 0.40
    if not migration_ready: risk += 0.10
    if longevity >= 40:    risk += 0.10

    # Scheme-specific warnings
    if scheme == "Falcon":
        warnings.append("Falcon requires careful constant-time implementation; prefer padded variants")
    if scheme in ("SPHINCS+", "SLH-DSA"):
        warnings.append("SLH-DSA/SPHINCS+ signatures are large (8KB–50KB); verify transport capacity")
    if scheme == "FrodoKEM":
        warnings.append("FrodoKEM has large key/ciphertext sizes; verify transport capacity")
    if scheme == "MAYO":
        warnings.append("MAYO is a research candidate — not approved for production")
    if scheme == "Classic-McEliece":
        warnings.append("Classic-McEliece has very large public keys (100KB+); verify storage capacity")
    if scheme == "BIKE":
        warnings.append("BIKE is a newer NIST standard (2025); verify implementation maturity before deployment")

    risk = clamp(risk, 0, 1)
    allowed = len(errors) == 0
    if allowed:
        actions.append("REVALIDATE_PERIODICALLY")

    return PolicyDecision(
        timestamp_utc=ts, profile=profile,
        allowed=allowed, risk_score=risk,
        security_level=level,
        required_actions=list(set(actions)),
        warnings=warnings, errors=errors,
        inputs={"scheme": scheme_raw, "parameter_set": param_raw, "longevity": longevity},
        normalized={"scheme": scheme, "parameter_set": param,
                    "inferred_security_level": inferred, "primitive": pol.primitive},
    )


def evaluate_key_policy_dict(**kwargs: Any) -> Dict[str, Any]:
    return asdict(evaluate_key_policy(**kwargs))