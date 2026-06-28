# backend/api/sign_api.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, Optional
import base64
import oqs

try:
    from crypto_core_rust.rust_bridge import get_bridge as _get_rust_bridge
    _RUST_BRIDGE = _get_rust_bridge()
except ImportError:
    _RUST_BRIDGE = None

def _rust_available() -> bool:
    return _RUST_BRIDGE is not None and getattr(_RUST_BRIDGE, "available", False)

router = APIRouter()

def _get_engine(request):
    token = request.cookies.get('access_token') if request else None
    auth_header = request.headers.get('Authorization', '') if request else ''
    if not token and auth_header.startswith('Bearer '):
        token = auth_header[7:]
    if token:
        try:
            from auth.jwt_handler import decode_token
            from auth.user_context import user_keystore_dir
            from key_management.keygen import KeygenEngine
            payload = decode_token(token)
            if payload and payload.get('sub'):
                return KeygenEngine(keystore_dir=user_keystore_dir(payload['sub']))
        except Exception:
            pass
    from key_management.keygen import get_keygen_engine
    return get_keygen_engine()


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")

def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

# ── Live mechanism lists ─────────────────────────────────────
_SIG_MECHS = set(oqs.get_enabled_sig_mechanisms())

# ── Fallback map for renamed schemes across liboqs versions ──
_FALLBACKS = {
    # Dilithium → ML-DSA (liboqs 0.12+)
    "Dilithium2": "ML-DSA-44", "Dilithium3": "ML-DSA-65", "Dilithium5": "ML-DSA-87",
    "ML-DSA-44": "Dilithium2", "ML-DSA-65": "Dilithium3", "ML-DSA-87": "Dilithium5",
    # SPHINCS+ → SLH-DSA pure (liboqs 0.15+)
    "SPHINCS+-SHA2-128f-simple": "SLH_DSA_PURE_SHA2_128F",
    "SPHINCS+-SHA2-128s-simple": "SLH_DSA_PURE_SHA2_128S",
    "SPHINCS+-SHA2-192f-simple": "SLH_DSA_PURE_SHA2_192F",
    "SPHINCS+-SHA2-192s-simple": "SLH_DSA_PURE_SHA2_192S",
    "SPHINCS+-SHA2-256f-simple": "SLH_DSA_PURE_SHA2_256F",
    "SPHINCS+-SHA2-256s-simple": "SLH_DSA_PURE_SHA2_256S",
    "SPHINCS+-SHAKE-128f-simple": "SLH_DSA_PURE_SHAKE_128F",
    "SPHINCS+-SHAKE-128s-simple": "SLH_DSA_PURE_SHAKE_128S",
    "SPHINCS+-SHAKE-192f-simple": "SLH_DSA_PURE_SHAKE_192F",
    "SPHINCS+-SHAKE-192s-simple": "SLH_DSA_PURE_SHAKE_192S",
    "SPHINCS+-SHAKE-256f-simple": "SLH_DSA_PURE_SHAKE_256F",
    "SPHINCS+-SHAKE-256s-simple": "SLH_DSA_PURE_SHAKE_256S",
    # SLH-DSA → SPHINCS+ reverse
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


def _resolve_sig_scheme(name: str) -> str:
    """Resolve a scheme name to what's actually available in this liboqs build."""
    if name in _SIG_MECHS:
        return name
    fb = _FALLBACKS.get(name)
    if fb and fb in _SIG_MECHS:
        return fb
    return name


def _normalize_signature_scheme(parameter_set: str) -> str:
    """
    Convert stored parameter_set to canonical oqs mechanism name,
    handling all supported families and liboqs version differences.
    """
    import re
    p = parameter_set
    pl = p.lower()

    # Already a valid mechanism — resolve for this liboqs version
    resolved = _resolve_sig_scheme(p)
    if resolved in _SIG_MECHS:
        return resolved

    # ML-DSA / Dilithium
    if "dilithium" in pl or "ml-dsa" in pl or "mldsa" in pl:
        if any(x in pl for x in ["2", "44"]): return _resolve_sig_scheme("Dilithium2")
        elif any(x in pl for x in ["3", "65"]): return _resolve_sig_scheme("Dilithium3")
        elif any(x in pl for x in ["5", "87"]): return _resolve_sig_scheme("Dilithium5")

    # Falcon
    if "falcon" in pl:
        padded = "padded" in pl
        if "1024" in pl:
            return _resolve_sig_scheme("Falcon-padded-1024" if padded else "Falcon-1024")
        return _resolve_sig_scheme("Falcon-padded-512" if padded else "Falcon-512")

    # SLH-DSA pure (FIPS 205 names with underscores)
    if "slh_dsa_pure" in pl or "slh-dsa" in pl:
        # Normalize slh-dsa-sha2-128f → SLH_DSA_PURE_SHA2_128F
        m = re.match(r"slh[-_]dsa[-_](?:pure[-_])?(sha2|shake|sha3)[-_](\d+)(f|s)$", pl)
        if m:
            h = m.group(1).upper()
            bits = m.group(2)
            variant = m.group(3).upper()
            candidate = f"SLH_DSA_PURE_{h}_{bits}{variant}"
            if candidate in _SIG_MECHS:
                return candidate

    # SPHINCS+
    if "sphincs" in pl:
        m = re.match(r"sphincs[+-]?(sha2|shake)-(\d+)(f|s)(?:-simple)?$", pl)
        if m:
            h = m.group(1).upper()
            bits = m.group(2)
            v = m.group(3).lower()
            candidate = f"SPHINCS+-{h}-{bits}{v}-simple"
            return _resolve_sig_scheme(candidate)

    # MAYO
    if "mayo" in pl:
        m = re.match(r"mayo[-_]?(\d)", pl)
        if m:
            candidate = f"MAYO-{m.group(1)}"
            if candidate in _SIG_MECHS:
                return candidate

    raise ValueError(
        f"Unsupported signature scheme: '{parameter_set}'. "
        f"Available: {sorted(_SIG_MECHS)[:10]}..."
    )


# ── Rust bridge (Falcon only — Dilithium uses ML-DSA in 0.15) ──
_RUST_SIG_SCHEMES = {"Falcon-512", "Falcon-1024"}

def _do_sign(scheme: str, private_key_b64: str, message: str) -> str:
    if _rust_available() and scheme in _RUST_SIG_SCHEMES:
        try:
            return _RUST_BRIDGE.sign(scheme, private_key_b64, message)["signature"]
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Rust sign failed: %s", e)
    private_key = _b64url_decode(private_key_b64)
    signer = oqs.Signature(scheme, secret_key=private_key)
    return _b64url_encode(signer.sign(message.encode()))


def _do_verify(scheme: str, public_key_b64: str, message: str, signature_b64: str) -> bool:
    if _rust_available() and scheme in _RUST_SIG_SCHEMES:
        try:
            return bool(_RUST_BRIDGE.verify(scheme, public_key_b64, message, signature_b64).get("valid", False))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Rust verify failed: %s", e)
    public_key = _b64url_decode(public_key_b64)
    signature = _b64url_decode(signature_b64)
    verifier = oqs.Signature(scheme)
    return verifier.verify(message.encode(), signature, public_key)


# ── API endpoints ────────────────────────────────────────────

from key_management.keygen import get_keygen_engine
from key_management.rotation import get_rotation_engine
from policy.security_store import record_key_event, check_key_allowed

@router.post("/sign", tags=["crypto"])
def sign(request: Request, payload: Dict[str, Any]):
    message: Optional[str] = payload.get("message")
    key_id: Optional[str] = payload.get("key_id")
    if not message:
        raise HTTPException(status_code=400, detail="message required")
    keygen = _get_engine(request)
    rotation = get_rotation_engine()
    if not key_id:
        key_id = rotation.get_active_key_id()
        if not key_id:
            raise HTTPException(status_code=409, detail="No active key")
    key = keygen.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    if getattr(key, "key_type", None) != "signature":
        raise HTTPException(status_code=400, detail="Key is not a signature key")
    from policy.security_store import check_key_allowed
    policy = check_key_allowed(
        scheme=key.algorithm, parameter_set=key.parameter_set,
        claimed_security_level=key.security_level,
        estimated_longevity_years=key.estimated_longevity_years,
    )
    if not policy.get("allowed", False):
        raise HTTPException(status_code=403, detail="Blocked by policy")
    try:
        scheme = _normalize_signature_scheme(key.parameter_set)
        signature = _do_sign(scheme, key.private_key, message)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signing failed: {type(e).__name__}: {e}")
    record_key_event(event_type="sign", key_id=key_id, scheme=key.algorithm, parameter_set=key.parameter_set)
    return {
        "key_id": key_id, "scheme": scheme, "signature": signature, "policy": policy,
        "crypto_backend": "rust" if (_rust_available() and scheme in _RUST_SIG_SCHEMES) else "python",
    }


@router.post("/verify", tags=["crypto"])
def verify(request: Request, payload: Dict[str, Any]):
    message: Optional[str] = payload.get("message")
    signature_b64: Optional[str] = payload.get("signature")
    key_id: Optional[str] = payload.get("key_id")
    if not message or not signature_b64:
        raise HTTPException(status_code=400, detail="message and signature required")
    if not key_id:
        raise HTTPException(status_code=400, detail="key_id required")
    keygen = _get_engine(request)
    key = keygen.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    if getattr(key, "key_type", None) != "signature":
        raise HTTPException(status_code=400, detail="Key is not a signature key")
    try:
        scheme = _normalize_signature_scheme(key.parameter_set)
        is_valid = _do_verify(scheme, key.public_key, message, signature_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {type(e).__name__}: {e}")
    record_key_event(event_type="verify", key_id=key_id, scheme=key.algorithm, parameter_set=key.parameter_set)
    return {
        "key_id": key_id, "valid": is_valid,
        "crypto_backend": "rust" if (_rust_available() and scheme in _RUST_SIG_SCHEMES) else "python",
    }