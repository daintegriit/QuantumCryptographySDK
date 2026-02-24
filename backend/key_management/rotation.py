# backend/key_management/rotation.py
from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from key_management.keygen import (
    DEFAULT_KEYSTORE_DIR,
    KeygenEngine,
)
from key_management.lifecycle import (
    KeyLifecycleEngine,
    KeyLifecycleStatus,
)
from policy.security_store import record_key_event

# ============================================================
# Storage paths (docker-safe)
# ============================================================

DEFAULT_STATE_DIR = Path(os.getenv("QS_STATE_DIR", "backend/_keystore/state")).resolve()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    """
    Atomic JSON write (prevents corruption if container crashes mid-write).
    """
    _ensure_dir(path.parent)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp.replace(path)


# ============================================================
# Rotation metadata model (stored in key JSON records)
# ============================================================

@dataclass(frozen=True)
class RotationInfo:
    parent_key_id: Optional[str] = None
    superseded_by_key_id: Optional[str] = None
    superseded_at_utc: Optional[str] = None
    rotation_reason: str = ""
    rotation_severity: str = ""  # MONITOR | ROTATE_SOON | DEPRECATED | BLOCKED


# ============================================================
# Rotation Engine
# ============================================================

class RotationEngine:
    """
    Enforces long-horizon key governance:
      - evaluates lifecycle status
      - rotates keys when needed
      - records lineage + audit evidence
      - manages active key pointer

    This remains valid when you swap real Rust PQC keygen later.
    """

    def __init__(
        self,
        keystore_dir: Path = DEFAULT_KEYSTORE_DIR,
        state_dir: Path = DEFAULT_STATE_DIR,
    ):
        self.keystore_dir = Path(keystore_dir).resolve()
        self.state_dir = Path(state_dir).resolve()
        _ensure_dir(self.keystore_dir)
        _ensure_dir(self.state_dir)

        self.active_key_path = self.state_dir / "active_key.json"

        self.keygen = KeygenEngine(keystore_dir=self.keystore_dir)
        self.lifecycle = KeyLifecycleEngine(keystore_dir=self.keystore_dir)

        # Locks
        self._state_lock = threading.Lock()
        self._record_lock = threading.Lock()

    # ---------------------------
    # Active key pointer
    # ---------------------------

    def get_active_key_id(self) -> Optional[str]:
        if not self.active_key_path.exists():
            return None
        try:
            data = json.loads(self.active_key_path.read_text(encoding="utf-8"))
            kid = data.get("active_key_id")
            return kid if isinstance(kid, str) and kid.strip() else None
        except Exception:
            return None

    def set_active_key_id(self, key_id: str, reason: str = "manual_set") -> None:
        key_id = (key_id or "").strip()
        if not key_id:
            raise ValueError("key_id is required")

        payload = {
            "active_key_id": key_id,
            "updated_at_utc": _utc_now_iso(),
            "reason": (reason or "").strip(),
        }

        with self._state_lock:
            _atomic_write_json(self.active_key_path, payload)

        record_key_event(
            event_type="active_key_set",
            key_id=key_id,
            metadata={"reason": (reason or "").strip()},
        )

    # ---------------------------
    # Core rotation actions
    # ---------------------------

    def rotate_if_needed(
        self,
        key_id: str,
        *,
        target_scheme: Optional[str] = None,
        target_parameter_set: Optional[str] = None,
        target_security_level: Optional[str] = None,
        target_longevity_years: Optional[int] = None,
        force: bool = False,
        set_active: bool = True,
    ) -> Dict[str, Any]:
        """
        Evaluate a key. If lifecycle says rotate, generate successor and link it.

        - If force=True: rotate even if lifecycle says OK.
        - target_* lets you migrate within same scheme/params or change them later.
        """
        key_id = (key_id or "").strip()
        if not key_id:
            raise ValueError("key_id is required")

        status = self.lifecycle.evaluate_key_id(key_id, audit=True)
        should_rotate = bool(force) or status.severity in ("ROTATE_SOON", "DEPRECATED", "BLOCKED")

        if not should_rotate:
            return {
                "rotated": False,
                "reason": "No rotation required by lifecycle.",
                "status": asdict(status),
                "new_key_id": None,
            }

        # Decide successor settings (default = same family)
        # IMPORTANT: status fields may be None depending on lifecycle implementation.
        scheme = (target_scheme or status.scheme or "ML-KEM").strip()
        parameter_set = (target_parameter_set or status.parameter_set or "ML-KEM-768").strip()
        security_level = (target_security_level or status.claimed_security_level or status.security_level or "NIST-L3").strip()

        # Longevity: default strong (gov-style) if not present
        longevity_years = int(target_longevity_years or status.estimated_longevity_years or 40)

        # Generate successor
        new_record = self.keygen.generate(
            algorithm=scheme,
            parameter_set=parameter_set,
            security_level=security_level,
            estimated_longevity_years=longevity_years,
            notes=f"rotated_from:{key_id}",
        )
        new_key_id = new_record.key_id

        # Attach lineage metadata in both records (atomic-ish with a lock)
        with self._record_lock:
            self._mark_child_parent(child_id=new_key_id, parent_id=key_id, status=status)
            self._mark_superseded(parent_id=key_id, child_id=new_key_id, status=status)

        # Optionally set active key to successor
        if set_active:
            self.set_active_key_id(new_key_id, reason=f"rotation:{status.severity}")

        # Audit event
        record_key_event(
            event_type="key_rotated",
            key_id=new_key_id,
            scheme=scheme,
            parameter_set=parameter_set,
            metadata={
                "parent_key_id": key_id,
                "rotation_severity": status.severity,
                "rotation_reason": status.reason,
                "previous_key_id": key_id,
            },
        )

        return {
            "rotated": True,
            "reason": f"Rotation executed: {status.severity}",
            "status": asdict(status),
            "new_key_id": new_key_id,
            "new_key_record": asdict(new_record),
        }

    def rotate_active_if_needed(self, **kwargs: Any) -> Dict[str, Any]:
        """
        Rotate the currently active key if needed. If none exists, create one and set active.
        """
        active = self.get_active_key_id()
        if not active:
            # bootstrap: create first key
            rec = self.keygen.generate()
            self.set_active_key_id(rec.key_id, reason="bootstrap")
            record_key_event(event_type="active_key_bootstrap", key_id=rec.key_id)
            return {
                "rotated": False,
                "reason": "No active key existed; bootstrapped a new active key.",
                "new_key_id": rec.key_id,
                "new_key_record": asdict(rec),
            }

        return self.rotate_if_needed(active, **kwargs)

    # ---------------------------
    # Internal record mutations
    # ---------------------------

    def _load_record(self, key_id: str) -> Dict[str, Any]:
        path = self.keystore_dir / f"{key_id}.json"
        if not path.exists():
            raise FileNotFoundError(f"Key record not found: {key_id}")
        return json.loads(path.read_text(encoding="utf-8"))

    def _save_record(self, key_id: str, record: Dict[str, Any]) -> None:
        path = self.keystore_dir / f"{key_id}.json"
        _atomic_write_json(path, record)

    def _mark_child_parent(self, child_id: str, parent_id: str, status: KeyLifecycleStatus) -> None:
        child = self._load_record(child_id)
        rotation = child.get("rotation") or {}
        rotation.update(asdict(RotationInfo(
            parent_key_id=parent_id,
            rotation_reason=(status.reason or ""),
            rotation_severity=(status.severity or ""),
        )))
        child["rotation"] = rotation
        self._save_record(child_id, child)

    def _mark_superseded(self, parent_id: str, child_id: str, status: KeyLifecycleStatus) -> None:
        parent = self._load_record(parent_id)
        rotation = parent.get("rotation") or {}
        rotation.update(asdict(RotationInfo(
            superseded_by_key_id=child_id,
            superseded_at_utc=_utc_now_iso(),
            rotation_reason=(status.reason or ""),
            rotation_severity=(status.severity or ""),
        )))
        parent["rotation"] = rotation
        self._save_record(parent_id, parent)


# ============================================================
# Convenience helpers
# ============================================================

_engine_singleton: Optional[RotationEngine] = None

def get_rotation_engine() -> RotationEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = RotationEngine()
    return _engine_singleton

def rotate_key(key_id: str, force: bool = False) -> Dict[str, Any]:
    eng = get_rotation_engine()
    return eng.rotate_if_needed(key_id, force=force, set_active=True)

def rotate_active(force: bool = False) -> Dict[str, Any]:
    eng = get_rotation_engine()
    return eng.rotate_active_if_needed(force=force, set_active=True)