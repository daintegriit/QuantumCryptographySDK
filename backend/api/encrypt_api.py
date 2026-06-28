# backend/api/encrypt_api.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, Optional
import base64
import os
import oqs
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from key_management.keygen import get_keygen_engine, normalize_param
from key_management.rotation import get_rotation_engine
from policy.security_store import record_key_event, check_key_allowed

try:
    from crypto_core_rust.rust_bridge import get_bridge as _get_rust_bridge
    _RUST_BRIDGE = _get_rust_bridge()
except ImportError:
    _RUST_BRIDGE = None

def _rust_available() -> bool:
    return _RUST_BRIDGE is not None and getattr(_RUST_BRIDGE, "available", False)

router = APIRouter()

def _get_engine(request: Request):
    token = request.cookies.get("access_token") if request else None
    auth_header = request.headers.get("Authorization", "") if request else ""
    if not token and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if token:
        try:
            from auth.jwt_handler import decode_token
            from auth.user_context import user_keystore_dir
            from key_management.keygen import KeygenEngine
            payload = decode_token(token)
            if payload and payload.get("sub"):
                return KeygenEngine(keystore_dir=user_keystore_dir(payload["sub"]))
        except Exception:
            pass
    return get_keygen_engine()


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")

def _require_kem_key(key) -> None:
    if getattr(key, "key_type", None) != "kem":
        raise HTTPException(status_code=400, detail=f"Key '{key.key_id}' is not a KEM key")

def _resolve_oqs_kem_name(parameter_set: str) -> str:
    normalized = normalize_param(parameter_set)
    mapping = {
        "Kyber512": "Kyber512", "Kyber768": "Kyber768", "Kyber1024": "Kyber1024",
        "ML-KEM-512": "ML-KEM-512", "ML-KEM-768": "ML-KEM-768", "ML-KEM-1024": "ML-KEM-1024",
    }
    return mapping.get(normalized, normalized)

def _encrypt_via_rust(plaintext, parameter_set, public_key_b64):
    oqs_alg = _resolve_oqs_kem_name(parameter_set)
    result = _RUST_BRIDGE.kem_encap(oqs_alg, public_key_b64)
    shared_secret = _b64url_decode(result["shared_secret"])
    aes_key = shared_secret[:32]
    aesgcm = __import__('cryptography.hazmat.primitives.ciphers.aead', fromlist=['AESGCM']).AESGCM(aes_key)
    nonce = os.urandom(12)
    encrypted_data = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return {"kem_ciphertext": result["kem_ciphertext"], "nonce": _b64url_encode(nonce),
            "data": _b64url_encode(encrypted_data), "shared_secret": result["shared_secret"]}

def _encrypt_via_python(plaintext, parameter_set, public_key_b64):
    oqs_alg = _resolve_oqs_kem_name(parameter_set)
    public_key = _b64url_decode(public_key_b64)
    with oqs.KeyEncapsulation(oqs_alg) as kem:
        kem_ciphertext, shared_secret = kem.encap_secret(public_key)
    aes_key = shared_secret[:32]
    aesgcm = AESGCM(aes_key)
    nonce = os.urandom(12)
    encrypted_data = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return {"kem_ciphertext": _b64url_encode(kem_ciphertext), "nonce": _b64url_encode(nonce),
            "data": _b64url_encode(encrypted_data), "shared_secret": _b64url_encode(shared_secret)}

def _real_encrypt(plaintext, parameter_set, public_key_b64):
    if _rust_available():
        try:
            return _encrypt_via_rust(plaintext, parameter_set, public_key_b64)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Rust encrypt failed, falling back: %s", e)
    return _encrypt_via_python(plaintext, parameter_set, public_key_b64)

def _decrypt_via_rust(payload, parameter_set, private_key_b64):
    oqs_alg = _resolve_oqs_kem_name(parameter_set)
    result = _RUST_BRIDGE.kem_decap(oqs_alg, private_key_b64, payload["kem_ciphertext"])
    shared_secret = _b64url_decode(result["shared_secret"])
    aes_key = shared_secret[:32]
    aesgcm = AESGCM(aes_key)
    nonce = _b64url_decode(payload["nonce"])
    encrypted_data = _b64url_decode(payload["data"])
    plaintext = aesgcm.decrypt(nonce, encrypted_data, None)
    return {"plaintext": plaintext.decode("utf-8"), "shared_secret": result["shared_secret"]}

def _decrypt_via_python(payload, parameter_set, private_key_b64):
    oqs_alg = _resolve_oqs_kem_name(parameter_set)
    private_key = _b64url_decode(private_key_b64)
    kem_ciphertext = _b64url_decode(payload["kem_ciphertext"])
    nonce = _b64url_decode(payload["nonce"])
    encrypted_data = _b64url_decode(payload["data"])
    with oqs.KeyEncapsulation(oqs_alg, private_key) as kem:
        shared_secret = kem.decap_secret(kem_ciphertext)
    aes_key = shared_secret[:32]
    aesgcm = AESGCM(aes_key)
    plaintext = aesgcm.decrypt(nonce, encrypted_data, None)
    return {"plaintext": plaintext.decode("utf-8"), "shared_secret": _b64url_encode(shared_secret)}

def _real_decrypt(payload, parameter_set, private_key_b64):
    if _rust_available():
        try:
            return _decrypt_via_rust(payload, parameter_set, private_key_b64)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Rust decrypt failed, falling back: %s", e)
    return _decrypt_via_python(payload, parameter_set, private_key_b64)

@router.post("/encrypt", tags=["crypto"])
def encrypt(request: Request, payload: Dict[str, Any]):
    plaintext = payload.get("plaintext")
    key_id: Optional[str] = payload.get("key_id")
    if not plaintext:
        raise HTTPException(status_code=400, detail="plaintext required")
    keygen = _get_engine(request)
    rotation = get_rotation_engine()
    if not key_id:
        key_id = rotation.get_active_key_id()
        if not key_id:
            raise HTTPException(status_code=409, detail="No active key available")
    key = keygen.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    _require_kem_key(key)
    policy = check_key_allowed(scheme=key.algorithm, parameter_set=key.parameter_set,
        claimed_security_level=key.security_level, estimated_longevity_years=key.estimated_longevity_years)
    if not policy.get("allowed", False):
        raise HTTPException(status_code=403, detail={"error": "Encryption blocked by policy", "policy": policy})
    try:
        ciphertext = _real_encrypt(plaintext=plaintext, parameter_set=key.parameter_set, public_key_b64=key.public_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    record_key_event(event_type="encrypt", key_id=key_id, scheme=key.algorithm,
        parameter_set=key.parameter_set, metadata={"policy_allowed": True, "security_level": key.security_level})
    return {"key_id": key_id, "ciphertext": {"kem_ciphertext": ciphertext["kem_ciphertext"],
        "nonce": ciphertext["nonce"], "data": ciphertext["data"]},
        "shared_secret": ciphertext["shared_secret"], "policy": policy,
        "crypto_backend": "rust" if _rust_available() else "python"}

@router.post("/decrypt", tags=["crypto"])
def decrypt(request: Request, payload: Dict[str, Any]):
    ciphertext = payload.get("ciphertext")
    key_id: Optional[str] = payload.get("key_id")
    if not ciphertext:
        raise HTTPException(status_code=400, detail="ciphertext required")
    keygen = _get_engine(request)
    rotation = get_rotation_engine()
    if not key_id:
        key_id = rotation.get_active_key_id()
        if not key_id:
            raise HTTPException(status_code=409, detail="No active key available")
    key = keygen.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    _require_kem_key(key)
    try:
        result = _real_decrypt(payload=ciphertext, parameter_set=key.parameter_set, private_key_b64=key.private_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decryption failed: {str(e)}")
    record_key_event(event_type="decrypt", key_id=key_id, scheme=key.algorithm, parameter_set=key.parameter_set)
    return {"key_id": key_id, "plaintext": result["plaintext"], "shared_secret": result["shared_secret"],
        "crypto_backend": "rust" if _rust_available() else "python"}
