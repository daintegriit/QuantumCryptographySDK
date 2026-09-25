"""
Q-SENTRY PQC JWT Handler
Replaces HS256 with ML-DSA-65 (FIPS 204) post-quantum signatures.
Token format: base64(header).base64(payload).base64(ml-dsa-65-signature)
"""
from __future__ import annotations
import base64, json, os, time, logging
from datetime import timedelta
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

JWT_EXPIRY    = int(os.getenv("JWT_EXPIRY_HOURS", "24"))
PQC_KEY_PATH  = os.getenv("QS_JWT_KEY", "/app/data/auth/jwt_signing.key")

# Fallback classical secret for decode compatibility during transition
JWT_SECRET    = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGO      = "HS256"

def _load_or_create_keypair():
    key_path = Path(PQC_KEY_PATH)
    key_path.parent.mkdir(parents=True, exist_ok=True)

    if key_path.exists():
        try:
            with open(key_path) as f:
                data = json.load(f)
            return bytes.fromhex(data["pk"]), bytes.fromhex(data["sk"])
        except Exception as e:
            logger.warning("Failed to load PQC JWT key: %s", e)

    try:
        import oqs
        sig = oqs.Signature("ML-DSA-65")
        pk  = sig.generate_keypair()
        sk  = sig.export_secret_key()
        with open(key_path, "w") as f:
            json.dump({
                "scheme":     "ML-DSA-65",
                "pk":         pk.hex(),
                "sk":         sk.hex(),
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }, f)
        logger.info("Generated ML-DSA-65 JWT signing keypair")
        return pk, sk
    except Exception as e:
        logger.warning("PQC JWT keygen failed: %s — falling back to HS256", e)
        return None, None

_pk, _sk = _load_or_create_keypair()

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * pad)

def create_token(user_id: str, email: str, is_admin: bool = False) -> str:
    now = int(time.time())
    payload = {
        "sub":      user_id,
        "email":    email,
        "is_admin": is_admin,
        "iat":      now,
        "exp":      now + JWT_EXPIRY * 3600,
    }

    # Try PQC signing first
    if _pk is not None and _sk is not None:
        try:
            import oqs
            header  = _b64url(json.dumps({"alg": "ML-DSA-65", "typ": "JWT"}).encode())
            body    = _b64url(json.dumps(payload).encode())
            msg     = f"{header}.{body}".encode()
            signer  = oqs.Signature("ML-DSA-65", _sk)
            sig     = _b64url(signer.sign(msg))
            return f"{header}.{body}.{sig}"
        except Exception as e:
            logger.warning("PQC JWT signing failed: %s — falling back to HS256", e)

    # Fallback to HS256
    import jwt as pyjwt
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) == 3:
            # Try PQC decode first
            try:
                header = json.loads(_b64url_decode(parts[0]))
                if header.get("alg") == "ML-DSA-65" and _pk is not None:
                    import oqs
                    msg     = f"{parts[0]}.{parts[1]}".encode()
                    sig     = _b64url_decode(parts[2])
                    verifier = oqs.Signature("ML-DSA-65")
                    if verifier.verify(msg, sig, _pk):
                        payload = json.loads(_b64url_decode(parts[1]))
                        if payload.get("exp", 0) > time.time():
                            return payload
                        return None
            except Exception:
                pass

            # Fallback HS256
            import jwt as pyjwt
            return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])

    except Exception as e:
        logger.debug("Token decode failed: %s", e)
    return None
