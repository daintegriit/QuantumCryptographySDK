# backend/key_management/keygen.py
from __future__ import annotations

import base64
import json
import os
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Any, List

import oqs

from policy.security_store import check_key_allowed, record_key_event
from policy.nist_pqc import infer_security_level_from_param

# ── Rust bridge ───────────────────────────────────────────────
try:
    from crypto_core_rust.rust_bridge import get_bridge as _get_rust_bridge
    _RUST_BRIDGE = _get_rust_bridge()
except ImportError:
    _RUST_BRIDGE = None

def _rust_available() -> bool:
    return _RUST_BRIDGE is not None and getattr(_RUST_BRIDGE, "available", False)


# ============================================================
# Keystore
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DEFAULT_KEYSTORE_DIR = Path(
    os.getenv("QS_KEYSTORE_DIR", BASE_DIR / "_keystore" / "keys")
)

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)

def _key_path(key_id: str, keystore_dir: Path) -> Path:
    return keystore_dir / f"{key_id}.json"


# ============================================================
# RUNTIME MECHANISM DISCOVERY
# ============================================================

_KEM_MECHS = set(oqs.get_enabled_kem_mechanisms())
_SIG_MECHS = set(oqs.get_enabled_sig_mechanisms())

def _resolve_kem_scheme(name: str) -> str:
    _KEM_FALLBACKS = {
        "ML-KEM-512":  "Kyber512",  "ML-KEM-768":  "Kyber768",  "ML-KEM-1024": "Kyber1024",
        "Kyber512": "ML-KEM-512",   "Kyber768": "ML-KEM-768",   "Kyber1024": "ML-KEM-1024",
    }
    if name in _KEM_MECHS:
        return name
    fallback = _KEM_FALLBACKS.get(name)
    if fallback and fallback in _KEM_MECHS:
        return fallback
    return name

def _resolve_sig_scheme(name: str) -> str:
    _SIG_FALLBACKS = {
        "Dilithium2": "ML-DSA-44", "Dilithium3": "ML-DSA-65", "Dilithium5": "ML-DSA-87",
        "ML-DSA-44": "Dilithium2", "ML-DSA-65": "Dilithium3", "ML-DSA-87": "Dilithium5",
        # SPHINCS+ → SLH-DSA
        "SPHINCS+-SHA2-128f-simple":  "SLH_DSA_PURE_SHA2_128F",
        "SPHINCS+-SHA2-128s-simple":  "SLH_DSA_PURE_SHA2_128S",
        "SPHINCS+-SHA2-192f-simple":  "SLH_DSA_PURE_SHA2_192F",
        "SPHINCS+-SHA2-192s-simple":  "SLH_DSA_PURE_SHA2_192S",
        "SPHINCS+-SHA2-256f-simple":  "SLH_DSA_PURE_SHA2_256F",
        "SPHINCS+-SHA2-256s-simple":  "SLH_DSA_PURE_SHA2_256S",
        "SPHINCS+-SHAKE-128f-simple": "SLH_DSA_PURE_SHAKE_128F",
        "SPHINCS+-SHAKE-128s-simple": "SLH_DSA_PURE_SHAKE_128S",
        "SPHINCS+-SHAKE-192f-simple": "SLH_DSA_PURE_SHAKE_192F",
        "SPHINCS+-SHAKE-192s-simple": "SLH_DSA_PURE_SHAKE_192S",
        "SPHINCS+-SHAKE-256f-simple": "SLH_DSA_PURE_SHAKE_256F",
        "SPHINCS+-SHAKE-256s-simple": "SLH_DSA_PURE_SHAKE_256S",
        # SLH-DSA → SPHINCS+
        "SLH_DSA_PURE_SHA2_128F": "SPHINCS+-SHA2-128f-simple",
        "SLH_DSA_PURE_SHA2_128S": "SPHINCS+-SHA2-128s-simple",
        "SLH_DSA_PURE_SHA2_192F": "SPHINCS+-SHA2-192f-simple",
        "SLH_DSA_PURE_SHA2_192S": "SPHINCS+-SHA2-192s-simple",
        "SLH_DSA_PURE_SHA2_256F": "SPHINCS+-SHA2-256f-simple",
        "SLH_DSA_PURE_SHA2_256S": "SPHINCS+-SHA2-256s-simple",
        "SLH_DSA_PURE_SHAKE_128F": "SPHINCS+-SHAKE-128f-simple",
        "SLH_DSA_PURE_SHAKE_128S": "SPHINCS+-SHAKE-128s-simple",
        "SLH_DSA_PURE_SHAKE_192F": "SPHINCS+-SHAKE-192f-simple",
        "SLH_DSA_PURE_SHAKE_192S": "SPHINCS+-SHAKE-192s-simple",
        "SLH_DSA_PURE_SHAKE_256F": "SPHINCS+-SHAKE-256f-simple",
        "SLH_DSA_PURE_SHAKE_256S": "SPHINCS+-SHAKE-256s-simple",
    }
    if name in _SIG_MECHS:
        return name
    fallback = _SIG_FALLBACKS.get(name)
    if fallback and fallback in _SIG_MECHS:
        return fallback
    return name


# ============================================================
# PARAM MAP — user input → canonical oqs mechanism name
# ============================================================

PARAM_MAP: Dict[str, str] = {
    # ── Kyber / ML-KEM ──────────────────────────────────────
    "kyber512":       "Kyber512",
    "kyber768":       "Kyber768",
    "kyber1024":      "Kyber1024",
    "ml-kem-512":     "ML-KEM-512",
    "ml-kem-768":     "ML-KEM-768",
    "ml-kem-1024":    "ML-KEM-1024",
    "ML-KEM-512":     "ML-KEM-512",
    "ML-KEM-768":     "ML-KEM-768",
    "ML-KEM-1024":    "ML-KEM-1024",
    "mlkem512":       "ML-KEM-512",
    "mlkem768":       "ML-KEM-768",
    "mlkem1024":      "ML-KEM-1024",

    # ── FrodoKEM ────────────────────────────────────────────
    "frodokem-640-aes":    "FrodoKEM-640-AES",
    "frodokem-640-shake":  "FrodoKEM-640-SHAKE",
    "frodokem-976-aes":    "FrodoKEM-976-AES",
    "frodokem-976-shake":  "FrodoKEM-976-SHAKE",
    "frodokem-1344-aes":   "FrodoKEM-1344-AES",
    "frodokem-1344-shake": "FrodoKEM-1344-SHAKE",
    "frodokem640aes":      "FrodoKEM-640-AES",
    "frodokem640shake":    "FrodoKEM-640-SHAKE",
    "frodokem976aes":      "FrodoKEM-976-AES",
    "frodokem976shake":    "FrodoKEM-976-SHAKE",
    "frodokem1344aes":     "FrodoKEM-1344-AES",
    "frodokem1344shake":   "FrodoKEM-1344-SHAKE",

    # ── BIKE ────────────────────────────────────────────────
    "bike-l1":  "BIKE-L1",
    "bike-l3":  "BIKE-L3",
    "bike-l5":  "BIKE-L5",
    "BIKE-L1":  "BIKE-L1",
    "BIKE-L3":  "BIKE-L3",
    "BIKE-L5":  "BIKE-L5",
    "bikel1":   "BIKE-L1",
    "bikel3":   "BIKE-L3",
    "bikel5":   "BIKE-L5",

    # ── Dilithium / ML-DSA ──────────────────────────────────
    "dilithium2":  "Dilithium2",
    "dilithium3":  "Dilithium3",
    "dilithium5":  "Dilithium5",
    "ml-dsa-44":   "ML-DSA-44",
    "ml-dsa-65":   "ML-DSA-65",
    "ml-dsa-87":   "ML-DSA-87",
    "ML-DSA-44":   "ML-DSA-44",
    "ML-DSA-65":   "ML-DSA-65",
    "ML-DSA-87":   "ML-DSA-87",
    "mldsa44":     "ML-DSA-44",
    "mldsa65":     "ML-DSA-65",
    "mldsa87":     "ML-DSA-87",

    # ── Falcon ──────────────────────────────────────────────
    "falcon512":           "Falcon-512",
    "falcon1024":          "Falcon-1024",
    "falcon-512":          "Falcon-512",
    "falcon-1024":         "Falcon-1024",
    "falcon-padded-512":   "Falcon-padded-512",
    "falcon-padded-1024":  "Falcon-padded-1024",
    "falconpadded512":     "Falcon-padded-512",
    "falconpadded1024":    "Falcon-padded-1024",

    # ── SPHINCS+ (legacy) ───────────────────────────────────
    "sphincs-sha2-128f":          "SPHINCS+-SHA2-128f-simple",
    "sphincs-sha2-128s":          "SPHINCS+-SHA2-128s-simple",
    "sphincs-sha2-192f":          "SPHINCS+-SHA2-192f-simple",
    "sphincs-sha2-192s":          "SPHINCS+-SHA2-192s-simple",
    "sphincs-sha2-256f":          "SPHINCS+-SHA2-256f-simple",
    "sphincs-sha2-256s":          "SPHINCS+-SHA2-256s-simple",
    "sphincs+-sha2-128f-simple":  "SPHINCS+-SHA2-128f-simple",
    "sphincs+-sha2-128s-simple":  "SPHINCS+-SHA2-128s-simple",
    "sphincs+-sha2-192f-simple":  "SPHINCS+-SHA2-192f-simple",
    "sphincs+-sha2-192s-simple":  "SPHINCS+-SHA2-192s-simple",
    "sphincs+-sha2-256f-simple":  "SPHINCS+-SHA2-256f-simple",
    "sphincs+-sha2-256s-simple":  "SPHINCS+-SHA2-256s-simple",
    "sphincs-shake-128f":         "SPHINCS+-SHAKE-128f-simple",
    "sphincs-shake-128s":         "SPHINCS+-SHAKE-128s-simple",
    "sphincs-shake-192f":         "SPHINCS+-SHAKE-192f-simple",
    "sphincs-shake-192s":         "SPHINCS+-SHAKE-192s-simple",
    "sphincs-shake-256f":         "SPHINCS+-SHAKE-256f-simple",
    "sphincs-shake-256s":         "SPHINCS+-SHAKE-256s-simple",
    "sphincs+-shake-128f-simple": "SPHINCS+-SHAKE-128f-simple",
    "sphincs+-shake-128s-simple": "SPHINCS+-SHAKE-128s-simple",
    "sphincs+-shake-192f-simple": "SPHINCS+-SHAKE-192f-simple",
    "sphincs+-shake-256f-simple": "SPHINCS+-SHAKE-256f-simple",
    "sphincs+-shake-256s-simple": "SPHINCS+-SHAKE-256s-simple",

    # ── SLH-DSA Pure (FIPS 205) ─────────────────────────────
    "SLH_DSA_PURE_SHA2_128F":  "SLH_DSA_PURE_SHA2_128F",
    "SLH_DSA_PURE_SHA2_128S":  "SLH_DSA_PURE_SHA2_128S",
    "SLH_DSA_PURE_SHA2_192F":  "SLH_DSA_PURE_SHA2_192F",
    "SLH_DSA_PURE_SHA2_192S":  "SLH_DSA_PURE_SHA2_192S",
    "SLH_DSA_PURE_SHA2_256F":  "SLH_DSA_PURE_SHA2_256F",
    "SLH_DSA_PURE_SHA2_256S":  "SLH_DSA_PURE_SHA2_256S",
    "SLH_DSA_PURE_SHAKE_128F": "SLH_DSA_PURE_SHAKE_128F",
    "SLH_DSA_PURE_SHAKE_128S": "SLH_DSA_PURE_SHAKE_128S",
    "SLH_DSA_PURE_SHAKE_192F": "SLH_DSA_PURE_SHAKE_192F",
    "SLH_DSA_PURE_SHAKE_192S": "SLH_DSA_PURE_SHAKE_192S",
    "SLH_DSA_PURE_SHAKE_256F": "SLH_DSA_PURE_SHAKE_256F",
    "SLH_DSA_PURE_SHAKE_256S": "SLH_DSA_PURE_SHAKE_256S",
    # hyphen input aliases
    "slh-dsa-sha2-128f":  "SLH_DSA_PURE_SHA2_128F",
    "slh-dsa-sha2-128s":  "SLH_DSA_PURE_SHA2_128S",
    "slh-dsa-sha2-192f":  "SLH_DSA_PURE_SHA2_192F",
    "slh-dsa-sha2-192s":  "SLH_DSA_PURE_SHA2_192S",
    "slh-dsa-sha2-256f":  "SLH_DSA_PURE_SHA2_256F",
    "slh-dsa-sha2-256s":  "SLH_DSA_PURE_SHA2_256S",
    "slh-dsa-shake-128f": "SLH_DSA_PURE_SHAKE_128F",
    "slh-dsa-shake-128s": "SLH_DSA_PURE_SHAKE_128S",
    "slh-dsa-shake-192f": "SLH_DSA_PURE_SHAKE_192F",
    "slh-dsa-shake-192s": "SLH_DSA_PURE_SHAKE_192S",
    "slh-dsa-shake-256f": "SLH_DSA_PURE_SHAKE_256F",
    "slh-dsa-shake-256s": "SLH_DSA_PURE_SHAKE_256S",

    # ── MAYO ────────────────────────────────────────────────
    "MAYO-1": "MAYO-1", "MAYO-2": "MAYO-2", "MAYO-3": "MAYO-3", "MAYO-5": "MAYO-5",
    "mayo-1": "MAYO-1", "mayo-2": "MAYO-2", "mayo-3": "MAYO-3", "mayo-5": "MAYO-5",

    # ── Classical (baseline only) ────────────────────────────
    "rsa2048":  "RSA-2048",
    "rsa4096":  "RSA-4096",
    "ecc-p256": "ECC-P256",
    "ecc-p384": "ECC-P384",
}


def normalize_param(param: str) -> str:
    """Normalize user input to canonical oqs mechanism name."""
    return PARAM_MAP.get(param, PARAM_MAP.get(param.lower(), param))


def infer_key_type(param: str) -> str:
    """Infer whether a param is KEM or signature."""
    p = param.lower()

    # KEM families
    if any(x in p for x in ["kyber", "ml-kem", "mlkem", "frodokem", "bike",
                              "ntru", "mceliece", "sntrup"]):
        return "kem"

    # Signature families
    if any(x in p for x in [
        "dilithium", "falcon", "sphincs", "slh_dsa", "slh-dsa",
        "ml-dsa", "mldsa", "mayo", "cross", "ov-", "snova",
    ]):
        return "signature"

    # Classical
    if any(x in p for x in ["rsa", "ecc"]):
        return "asymmetric"

    raise ValueError(f"Unknown key type for param: {param}")


# ============================================================
# DATA MODEL
# ============================================================

@dataclass(frozen=True)
class KeyRecord:
    key_id: str
    algorithm: str
    parameter_set: str
    security_level: str
    estimated_longevity_years: int
    key_type: str
    public_key: str
    private_key: str
    created_at_utc: str
    policy_allowed: bool
    policy_risk_score: float
    policy_required_actions: List[str]
    policy_warnings: List[str]
    notes: str = ""
    rotation: Optional[Dict[str, Any]] = None


def serialize_public(record: KeyRecord) -> Dict[str, Any]:
    data = asdict(record)
    data.pop("private_key", None)
    return data


# ============================================================
# KEY GENERATION
# Always uses Python/liboqs — private keys never leave the process.
# ============================================================

def _generate_kem_keypair_python(param: str):
    resolved = _resolve_kem_scheme(param)
    if resolved not in _KEM_MECHS:
        raise RuntimeError(
            f"KEM '{param}' (resolved: '{resolved}') not supported. "
            f"Available: {sorted(_KEM_MECHS)[:10]}..."
        )
    kem = oqs.KeyEncapsulation(resolved)
    public_key_bytes = kem.generate_keypair()
    private_key_bytes = kem.export_secret_key()
    return public_key_bytes, private_key_bytes


def _generate_sig_keypair_python(param: str):
    resolved = _resolve_sig_scheme(param)
    if resolved not in _SIG_MECHS:
        raise RuntimeError(
            f"Signature '{param}' (resolved: '{resolved}') not supported. "
            f"Available: {sorted(_SIG_MECHS)[:10]}..."
        )
    sig = oqs.Signature(resolved)
    public_key_bytes = sig.generate_keypair()
    private_key_bytes = sig.export_secret_key()
    return public_key_bytes, private_key_bytes


# ============================================================
# ENGINE
# ============================================================

class KeygenEngine:

    def __init__(self, keystore_dir: Path = DEFAULT_KEYSTORE_DIR):
        self.keystore_dir = keystore_dir
        _ensure_dir(self.keystore_dir)

    def generate(
        self,
        algorithm: str = "kyber",
        parameter_set: str = "kyber768",
        security_level: Optional[str] = None,
        estimated_longevity_years: int = 40,
        notes: str = "",
        compliance_tags: Optional[List[str]] = None,
    ) -> KeyRecord:

        compliance_tags = compliance_tags or []
        param = normalize_param(parameter_set)
        key_type = infer_key_type(param)

        policy = check_key_allowed(
            scheme=algorithm,
            parameter_set=param,
            claimed_security_level=security_level,
            estimated_longevity_years=estimated_longevity_years,
            migration_ready=True,
            is_deprecated=False,
            compliance_tags=compliance_tags,
            audit=True,
        )

        if not policy["allowed"]:
            raise ValueError(f"Key generation blocked: {policy['required_actions']}")

        key_id = str(uuid.uuid4())

        try:
            if key_type == "kem":
                public_key_bytes, private_key_bytes = _generate_kem_keypair_python(param)
            elif key_type == "signature":
                public_key_bytes, private_key_bytes = _generate_sig_keypair_python(param)
            else:
                raise RuntimeError(f"Unsupported key type: {key_type}")
        except Exception as e:
            raise RuntimeError(f"PQC key generation failed: {e}")

        public_key  = _b64url(public_key_bytes)
        private_key = _b64url(private_key_bytes)

        inferred_level = infer_security_level_from_param(param) or "UNKNOWN"
        final_security_level = (
            policy.get("security_level") or
            policy.get("normalized", {}).get("inferred_security_level") or
            inferred_level
        )

        record = KeyRecord(
            key_id=key_id,
            algorithm=algorithm,
            parameter_set=param,
            security_level=final_security_level,
            estimated_longevity_years=int(estimated_longevity_years),
            key_type=key_type,
            public_key=public_key,
            private_key=private_key,
            created_at_utc=_utc_now_iso(),
            policy_allowed=True,
            policy_risk_score=float(policy["risk_score"]),
            policy_required_actions=list(policy["required_actions"]),
            policy_warnings=list(policy.get("warnings", [])),
            notes=notes.strip(),
        )

        self._save(record)

        record_key_event(
            event_type="key_generated",
            key_id=key_id,
            scheme=algorithm,
            parameter_set=param,
            metadata={
                "security_level": security_level,
                "estimated_longevity_years": estimated_longevity_years,
                "risk_score": policy["risk_score"],
                "key_type": key_type,
                "crypto_backend": "python",
            },
        )

        return record

    def get(self, key_id: str) -> Optional[KeyRecord]:
        path = _key_path(key_id, self.keystore_dir)
        if not path.exists():
            return None
        return KeyRecord(**json.loads(path.read_text()))

    def list(self, limit: int = 25) -> List[KeyRecord]:
        files = sorted(
            self.keystore_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        return [KeyRecord(**json.loads(p.read_text())) for p in files[:limit]]

    def delete(self, key_id: str) -> bool:
        path = _key_path(key_id, self.keystore_dir)
        if not path.exists():
            return False
        path.unlink()
        return True

    def _save(self, record: KeyRecord) -> None:
        path = _key_path(record.key_id, self.keystore_dir)
        path.write_text(json.dumps(asdict(record), indent=2))


# ============================================================
# FASTAPI HELPERS
# ============================================================

_engine_singleton: Optional[KeygenEngine] = None

def get_keygen_engine() -> KeygenEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = KeygenEngine()
    return _engine_singleton


def generate_key(payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    payload = payload or {}
    eng = get_keygen_engine()
    record = eng.generate(
        algorithm=payload.get("algorithm", "kyber"),
        parameter_set=payload.get("parameter_set", "kyber768"),
        security_level=payload.get("security_level"),
        estimated_longevity_years=payload.get("estimated_longevity_years", 40),
        notes=payload.get("notes", ""),
        compliance_tags=payload.get("compliance_tags", []),
    )
    return serialize_public(record)


def get_supported_algorithms() -> Dict[str, List[str]]:
    return {
        "kem": sorted(_KEM_MECHS),
        "signature": sorted(_SIG_MECHS),
    }