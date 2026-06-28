# backend/api/kem_api.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import base64

import oqs

from key_management.keygen import get_keygen_engine, normalize_param

router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")


def _resolve_oqs_kem_name(parameter_set: str) -> str:
    normalized = normalize_param(parameter_set)
    mapping = {
        "Kyber512":    "Kyber512",
        "Kyber768":    "Kyber768",
        "Kyber1024":   "Kyber1024",
        "ML-KEM-512":  "ML-KEM-512",
        "ML-KEM-768":  "ML-KEM-768",
        "ML-KEM-1024": "ML-KEM-1024",
    }
    return mapping.get(normalized, normalized)


# ============================================================
# KEM ENCAP
# ============================================================

@router.post("/kem/encap", tags=["kem"])
def kem_encap(payload: Dict[str, Any]):
    public_key_b64 = payload.get("public_key")
    parameter_set = payload.get("parameter_set")

    if not public_key_b64 or not parameter_set:
        raise HTTPException(status_code=400, detail="public_key and parameter_set required")

    oqs_alg = _resolve_oqs_kem_name(parameter_set)
    public_key = _b64url_decode(public_key_b64)

    try:
        with oqs.KeyEncapsulation(oqs_alg) as kem:
            kem_ct, shared_secret = kem.encap_secret(public_key)
    except Exception as e:
        # BUG FIX: str(e) leaks internal OQS error details to API consumers.
        # Log internally, return safe typed message.
        import logging
        logging.getLogger(__name__).exception("KEM encap failed for alg=%s", oqs_alg)
        raise HTTPException(
            status_code=500,
            detail=f"KEM encapsulation failed: {type(e).__name__}",
        )

    return {
        "kem_ciphertext": _b64url_encode(kem_ct),
        # shared_secret returned for testing/verification only —
        # in production this should be omitted or gated behind a flag.
        "shared_secret": _b64url_encode(shared_secret),
    }


# ============================================================
# KEM DECAP
# ============================================================

@router.post("/kem/decap", tags=["kem"])
def kem_decap(payload: Dict[str, Any]):
    key_id = payload.get("key_id")
    kem_ct_b64 = payload.get("kem_ciphertext")

    if not key_id or not kem_ct_b64:
        raise HTTPException(status_code=400, detail="key_id and kem_ciphertext required")

    keygen = get_keygen_engine()
    key = keygen.get(key_id)

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    oqs_alg = _resolve_oqs_kem_name(key.parameter_set)
    private_key = _b64url_decode(key.private_key)
    kem_ct = _b64url_decode(kem_ct_b64)

    try:
        with oqs.KeyEncapsulation(oqs_alg, private_key) as kem:
            shared_secret = kem.decap_secret(kem_ct)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(
            "KEM decap failed for key_id=%s alg=%s", key_id, oqs_alg
        )
        raise HTTPException(
            status_code=500,
            detail=f"KEM decapsulation failed: {type(e).__name__}",
        )

    return {
        "shared_secret": _b64url_encode(shared_secret),
    }