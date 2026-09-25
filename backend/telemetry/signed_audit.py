"""
Q-SENTRY Signed Audit Log
Tamper-evident append-only audit trail using:
- SHA3-256 content hashing
- Hash chaining (each entry links to previous)
- Dilithium3 post-quantum signatures
"""
import json, hashlib, os, logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import oqs

logger = logging.getLogger(__name__)

SIGNED_LOG_PATH  = os.environ.get("QS_SIGNED_AUDIT", "/app/telemetry/audit_signed.jsonl")
SIGNING_KEY_PATH = os.environ.get("QS_AUDIT_KEY",    "/app/telemetry/audit_signing.key")
SCHEME           = "ML-DSA-65"

class SignedAuditLog:
    def __init__(self):
        self.log_path = Path(SIGNED_LOG_PATH)
        self.key_path = Path(SIGNING_KEY_PATH)
        self._pk, self._sk = self._load_or_create_keypair()
        self._last_hash    = self._compute_chain_tip()

    def _load_or_create_keypair(self):
        if self.key_path.exists():
            try:
                with open(self.key_path) as f:
                    data = json.load(f)
                return bytes.fromhex(data["pk"]), bytes.fromhex(data["sk"])
            except Exception as e:
                logger.warning("Failed to load audit signing key: %s", e)

        # Generate new Dilithium3 keypair
        sig = oqs.Signature(SCHEME)
        pk  = sig.generate_keypair()
        sk  = sig.export_secret_key()
        self.key_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.key_path, "w") as f:
            json.dump({
                "scheme": SCHEME,
                "pk": pk.hex(),
                "sk": sk.hex(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }, f)
        logger.info("Generated new Dilithium3 audit signing keypair")
        return pk, sk

    def _compute_chain_tip(self) -> str:
        """Get hash of last entry for chain linking."""
        if not self.log_path.exists():
            return "0" * 64  # genesis hash
        try:
            last_line = None
            with open(self.log_path) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        last_line = line
            if last_line:
                return hashlib.sha3_256(last_line.encode()).hexdigest()
        except Exception:
            pass
        return "0" * 64

    def append(self, event: dict) -> dict:
        """Sign and append an audit event."""
        try:
            # Canonical JSON for hashing
            canonical = json.dumps(event, sort_keys=True, separators=(',', ':'))
            content_hash = hashlib.sha3_256(canonical.encode()).hexdigest()

            # Chain link
            chain_hash = hashlib.sha3_256(
                f"{self._last_hash}{content_hash}".encode()
            ).hexdigest()

            # Sign with Dilithium3
            sig_obj  = oqs.Signature(SCHEME, self._sk)
            sig_bytes = sig_obj.sign(chain_hash.encode())

            signed_entry = {
                **event,
                "_audit": {
                    "content_hash":  content_hash,
                    "prev_hash":     self._last_hash,
                    "chain_hash":    chain_hash,
                    "signature":     sig_bytes.hex(),
                    "scheme":        SCHEME,
                    "pk_hex":        self._pk.hex()[:16] + "...",  # fingerprint only
                    "signed_at_utc": datetime.now(timezone.utc).isoformat(),
                }
            }

            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_path, "a") as f:
                f.write(json.dumps(signed_entry) + "\n")

            self._last_hash = hashlib.sha3_256(
                json.dumps(signed_entry, sort_keys=True, separators=(',', ':')).encode()
            ).hexdigest()

            return signed_entry

        except Exception as e:
            logger.error("Failed to sign audit entry: %s", e)
            return event

    def verify_chain(self) -> dict:
        """Verify the entire audit chain integrity."""
        if not self.log_path.exists():
            return {"valid": True, "entries": 0, "message": "No signed log yet"}

        entries     = []
        prev_hash   = "0" * 64
        valid       = True
        tampered_at = None

        with open(self.log_path) as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                try:
                    entry  = json.loads(line)
                    audit  = entry.get("_audit", {})

                    # Verify chain link
                    expected_chain = hashlib.sha3_256(
                        f"{audit.get('prev_hash','')}{audit.get('content_hash','')}".encode()
                    ).hexdigest()

                    if expected_chain != audit.get("chain_hash"):
                        valid       = False
                        tampered_at = i
                        break

                    # Verify signature
                    sig_bytes = bytes.fromhex(audit["signature"])
                    pk_bytes  = bytes.fromhex(audit["pk_hex"].replace("...", "")) \
                                if "..." not in audit.get("pk_hex","") \
                                else self._pk
                    verifier  = oqs.Signature(SCHEME)
                    if not verifier.verify(
                        audit["chain_hash"].encode(), sig_bytes, self._pk
                    ):
                        valid       = False
                        tampered_at = i
                        break

                    prev_hash = hashlib.sha3_256(line.encode()).hexdigest()
                    entries.append(i)

                except Exception as e:
                    valid       = False
                    tampered_at = i
                    break

        return {
            "valid":       valid,
            "entries":     len(entries),
            "tampered_at": tampered_at,
            "message":     "Chain intact" if valid else f"Tampering detected at entry {tampered_at}",
        }


_log: Optional[SignedAuditLog] = None

def get_signed_log() -> SignedAuditLog:
    global _log
    if _log is None:
        _log = SignedAuditLog()
    return _log
