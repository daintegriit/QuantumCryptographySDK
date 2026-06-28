from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import base64

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, ec, padding
from cryptography.exceptions import InvalidSignature

router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")


# ============================================================
# RSA-2048 FULL PIPELINE
# keygen -> encrypt -> decrypt
# ============================================================

@router.post("/encrypt-classical", tags=["crypto", "classical"])
def encrypt_classical(payload: Dict[str, Any]):
    plaintext = payload.get("plaintext")
    scheme = str(payload.get("scheme", "rsa-2048")).lower()

    if not plaintext:
        raise HTTPException(status_code=400, detail="plaintext required")

    if scheme not in {"rsa-2048", "rsa2048"}:
        raise HTTPException(status_code=400, detail="Only rsa-2048 is supported")

    try:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = private_key.public_key()

        ciphertext = public_key.encrypt(
            plaintext.encode("utf-8"),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        decrypted = private_key.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        ).decode("utf-8")

        return {
            "scheme": "rsa-2048",
            "ciphertext": _b64url_encode(ciphertext),
            "plaintext": decrypted,
            "valid": decrypted == plaintext,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RSA classical pipeline failed: {e}")


# ============================================================
# ECC-P256 FULL PIPELINE
# keygen -> sign -> verify
# ============================================================

@router.post("/sign-classical", tags=["crypto", "classical"])
def sign_classical(payload: Dict[str, Any]):
    message = payload.get("message")
    scheme = str(payload.get("scheme", "ecc-p256")).lower()

    if not message:
        raise HTTPException(status_code=400, detail="message required")

    if scheme not in {"ecc-p256", "eccp256", "p256"}:
        raise HTTPException(status_code=400, detail="Only ecc-p256 is supported")

    try:
        private_key = ec.generate_private_key(ec.SECP256R1())
        public_key = private_key.public_key()

        signature = private_key.sign(
            message.encode("utf-8"),
            ec.ECDSA(hashes.SHA256()),
        )

        valid = True
        try:
            public_key.verify(
                signature,
                message.encode("utf-8"),
                ec.ECDSA(hashes.SHA256()),
            )
        except InvalidSignature:
            valid = False

        return {
            "scheme": "ecc-p256",
            "signature": _b64url_encode(signature),
            "valid": valid,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ECC classical pipeline failed: {e}")