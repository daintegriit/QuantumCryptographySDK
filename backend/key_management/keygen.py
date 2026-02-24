# backend/key_management/keygen.py
from __future__ import annotations

import base64
import json
import os
import secrets
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Any, List

from policy.security_store import (
    check_key_allowed,
    record_key_event,
)

# ============================================================
# Keystore (simple, durable, docker-safe)
# ============================================================

DEFAULT_KEYSTORE_DIR = Path(
    os.getenv("QS_KEYSTORE_DIR", "backend/_keystore/keys")
).resolve()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _key_path(key_id: str, keystore_dir: Path) -> Path:
    return keystore_dir / f"{key_id}.json"


# ============================================================
# Data model
# ============================================================

@dataclass(frozen=True)
class KeyRecord:
    key_id: str
    algorithm: str
    parameter_set: str
    security_level: str
    estimated_longevity_years: int
    public_key: str
    private_key: str
    created_at_utc: str

    # 🔐 Policy + compliance
    policy_allowed: bool
    policy_risk_score: float
    policy_required_actions: List[str]
    policy_warnings: List[str]

    notes: str = ""
    rotation: Optional[Dict[str, Any]] = None


# ============================================================
# Engine
# ============================================================

class KeygenEngine:
    """
    Policy-gated key generation engine with persistent keystore.

    Today:
      - Secure randomness (placeholder keys)
      - Full policy validation + audit
      - Durable storage

    Future:
      - Swap randomness with Rust lattice KEM keygen
      - Add automatic rotation + migration triggers
    """

    def __init__(self, keystore_dir: Path = DEFAULT_KEYSTORE_DIR):
        self.keystore_dir = keystore_dir
        _ensure_dir(self.keystore_dir)

    def generate(
        self,
        algorithm: str = "kyber",
        parameter_set: str = "kyber768",
        security_level: str = "NIST-L3",
        estimated_longevity_years: int = 40,
        notes: str = "",
        compliance_tags: Optional[List[str]] = None,
    ) -> KeyRecord:
        """
        Generate a new keypair record *only if policy allows it*.
        """

        compliance_tags = compliance_tags or []

        # ====================================================
        # 1. POLICY CHECK (THIS IS THE CORE OF YOUR CLAIM)
        # ====================================================

        policy = check_key_allowed(
            scheme=algorithm,
            parameter_set=parameter_set,
            claimed_security_level=security_level,
            estimated_longevity_years=estimated_longevity_years,
            migration_ready=True,
            is_deprecated=False,
            compliance_tags=compliance_tags,
            audit=True,
        )

        if not policy["allowed"]:
            raise ValueError(
                f"Key generation blocked by policy: {policy['required_actions']}"
            )

        # ====================================================
        # 2. KEY MATERIAL (placeholder – safe scaffold)
        # ====================================================

        key_id = str(uuid.uuid4())

        # Kyber-like ballpark sizes (NOT final crypto)
        pub_len = 1184
        priv_len = 2400

        public_key = _b64url(secrets.token_bytes(pub_len))
        private_key = _b64url(secrets.token_bytes(priv_len))

        record = KeyRecord(
            key_id=key_id,
            algorithm=algorithm,
            parameter_set=parameter_set,
            security_level=security_level,
            estimated_longevity_years=int(estimated_longevity_years),
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

        # ====================================================
        # 3. AUDIT EVENT
        # ====================================================

        record_key_event(
            event_type="key_generated",
            key_id=key_id,
            scheme=algorithm,
            parameter_set=parameter_set,
            metadata={
                "security_level": security_level,
                "estimated_longevity_years": estimated_longevity_years,
                "risk_score": policy["risk_score"],
                "required_actions": policy["required_actions"],
            },
        )

        return record

    def get(self, key_id: str) -> Optional[KeyRecord]:
        path = _key_path(key_id, self.keystore_dir)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return KeyRecord(**data)

    def list(self, limit: int = 25) -> List[KeyRecord]:
        files = sorted(
            self.keystore_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        out: List[KeyRecord] = []
        for p in files[: max(1, int(limit))]:
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                out.append(KeyRecord(**data))
            except Exception:
                continue
        return out

    def delete(self, key_id: str) -> bool:
        path = _key_path(key_id, self.keystore_dir)
        if not path.exists():
            return False
        path.unlink()
        return True

    def _save(self, record: KeyRecord) -> None:
        path = _key_path(record.key_id, self.keystore_dir)
        path.write_text(
            json.dumps(asdict(record), indent=2),
            encoding="utf-8",
        )


# ============================================================
# Convenience helpers (FastAPI-friendly)
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
        security_level=payload.get("security_level", "NIST-L3"),
        estimated_longevity_years=payload.get("estimated_longevity_years", 40),
        notes=payload.get("notes", ""),
        compliance_tags=payload.get("compliance_tags", []),
    )

    return asdict(record)