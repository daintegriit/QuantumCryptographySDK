# backend/telemetry/audit_log.py
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional

# ============================================================
# Configuration
# ============================================================

DEFAULT_AUDIT_LOG_PATH = os.getenv(
    "QS_AUDIT_LOG_PATH",
    "backend/telemetry/audit_log.jsonl",
)

_audit_lock = threading.Lock()


# ============================================================
# Helpers
# ============================================================

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_dir(path: str) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


# ============================================================
# Core Append-Only Logger
# ============================================================

def append_event(
    *,
    event_type: str,
    payload: Dict[str, Any],
    audit_path: str = DEFAULT_AUDIT_LOG_PATH,
) -> None:
    """
    Append a single audit event (JSONL).

    GUARANTEES:
      - Append-only
      - Ordered (per process)
      - Thread-safe
      - Docker-safe
      - Human + machine readable

    This is the ROOT OF TRUST for the system.
    """

    _ensure_dir(audit_path)

    event: Dict[str, Any] = {
        "event_type": event_type,
        "timestamp_utc": utc_now_iso(),
        "payload": payload,
    }

    line = json.dumps(event, ensure_ascii=False)

    with _audit_lock:
        with open(audit_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")


# ============================================================
# Bulk Utilities
# ============================================================

def read_events(
    *,
    audit_path: str = DEFAULT_AUDIT_LOG_PATH,
    limit: Optional[int] = None,
) -> Iterable[Dict[str, Any]]:
    """
    Stream audit events from disk.

    Used by:
      - telemetry
      - replay
      - forensics
      - compliance export
    """
    if not os.path.exists(audit_path):
        return []

    events = []
    with open(audit_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                events.append(json.loads(line))
            except Exception:
                continue

    if limit is not None:
        return events[-limit:]

    return events


def audit_log_size(audit_path: str = DEFAULT_AUDIT_LOG_PATH) -> int:
    """
    Return number of events in the audit log.
    """
    if not os.path.exists(audit_path):
        return 0
    with open(audit_path, "r", encoding="utf-8") as f:
        return sum(1 for _ in f)


# ============================================================
# High-Level Convenience Wrappers
# ============================================================

def log_key_event(
    *,
    event_type: str,
    key_id: Optional[str],
    scheme: Optional[str] = None,
    parameter_set: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Standardized helper for key-related events.

    Ensures consistent schema across:
      - keygen
      - rotation
      - migration
      - encryption
      - decryption
    """
    append_event(
        event_type=event_type,
        payload={
            "key_id": key_id,
            "scheme": scheme,
            "parameter_set": parameter_set,
            "metadata": metadata or {},
        },
    )


def log_system_event(
    *,
    event_type: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Used for system-level events:
      - startup
      - config changes
      - policy updates
    """
    append_event(
        event_type=event_type,
        payload={
            "metadata": metadata or {},
        },
    )