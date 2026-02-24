# backend/api/encrypt_api.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
import base64

from key_management.keygen import get_keygen_engine
from key_management.rotation import get_rotation_engine
from policy.security_store import (
    record_key_event,
    check_key_allowed,
)

router = APIRouter()


# ============================================================
# Placeholder crypto (safe scaffold)
# ============================================================

def _fake_encrypt(plaintext: str, key_material: str) -> str:
    """
    Placeholder encryption.

    NOTE:
    - This is NOT real lattice encryption.
    - It preserves interface + audit semantics.
    - Replace with Rust PQC engine later.
    """
    combined = f"{key_material}:{plaintext}".encode("utf-8")
    return base64.b64encode(combined).decode("utf-8")


def _fake_decrypt(ciphertext: str, key_material: str) -> str:
    decoded = base64.b64decode(ciphertext).decode("utf-8")
    prefix = f"{key_material}:"
    if not decoded.startswith(prefix):
        raise ValueError("Invalid ciphertext or key")
    return decoded[len(prefix):]


# ============================================================
# Encrypt
# ============================================================

@router.post("/encrypt", tags=["crypto"])
def encrypt(payload: Dict[str, Any]):
    """
    Encrypt plaintext using:
      - explicitly supplied key_id OR
      - the currently active key

    Policy is enforced before encryption.
    """
    plaintext = payload.get("plaintext")
    key_id: Optional[str] = payload.get("key_id")

    if not plaintext:
        raise HTTPException(status_code=400, detail="plaintext required")

    keygen = get_keygen_engine()
    rotation = get_rotation_engine()

    # Resolve key
    if not key_id:
        key_id = rotation.get_active_key_id()
        if not key_id:
            raise HTTPException(
                status_code=409,
                detail="No active key available; generate or rotate a key first",
            )

    key = keygen.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    # Enforce policy BEFORE encryption
    policy = check_key_allowed(
        scheme=key.algorithm,
        parameter_set=key.parameter_set,
        claimed_security_level=key.security_level,
        estimated_longevity_years=key.estimated_longevity_years,
    )

    if not policy.get("allowed", False):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Encryption blocked by policy",
                "policy": policy,
            },
        )

    ciphertext = _fake_encrypt(plaintext, key.public_key)

    # Audit
    record_key_event(
        event_type="encrypt",
        key_id=key_id,
        scheme=key.algorithm,
        parameter_set=key.parameter_set,
        metadata={
            "policy_allowed": True,
            "security_level": key.security_level,
        },
    )

    return {
        "key_id": key_id,
        "ciphertext": ciphertext,
        "policy": policy,
    }


# ============================================================
# Decrypt
# ============================================================

@router.post("/decrypt", tags=["crypto"])
def decrypt(payload: Dict[str, Any]):
    """
    Decrypt ciphertext using:
      - explicitly supplied key_id OR
      - the currently active key
    """
    ciphertext = payload.get("ciphertext")
    key_id: Optional[str] = payload.get("key_id")

    if not ciphertext:
        raise HTTPException(status_code=400, detail="ciphertext required")

    keygen = get_keygen_engine()
    rotation = get_rotation_engine()

    # Resolve key
    if not key_id:
        key_id = rotation.get_active_key_id()
        if not key_id:
            raise HTTPException(
                status_code=409,
                detail="No active key available",
            )

    key = keygen.get(key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    try:
        plaintext = _fake_decrypt(ciphertext, key.public_key)
    except Exception:
        raise HTTPException(status_code=400, detail="Decryption failed")

    # Audit
    record_key_event(
        event_type="decrypt",
        key_id=key_id,
        scheme=key.algorithm,
        parameter_set=key.parameter_set,
    )

    return {
        "key_id": key_id,
        "plaintext": plaintext,
    }