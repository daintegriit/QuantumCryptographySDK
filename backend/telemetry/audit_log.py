# backend/telemetry/audit_log.py
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional

DEFAULT_AUDIT_LOG_PATH = os.getenv(
    "QS_AUDIT_LOG_PATH",
    "telemetry/audit_log.jsonl",
)

_audit_lock = threading.Lock()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_dir(path: str) -> None:
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)


# ============================================================
# Event normalization
#
# BUG FIX: The audit log receives events from two writers with
# incompatible schemas:
#
#   Writer 1 — audit_log.append_event() (payload-wrapped):
#     { "event_type": "encrypt", "timestamp_utc": "...",
#       "payload": { "key_id": "abc", "scheme": "kyber" } }
#
#   Writer 2 — security_store.append_audit_event() (flat):
#     { "event_type": "policy_check", "timestamp_utc": "...",
#       "key_id": "abc", "scheme": "kyber", "metadata": {...} }
#
# telemetry.py used e.get("payload", {}).get("key_id") → missed all
#   flat events (every keygen, rotation, migration, policy check from
#   security_store was invisible to summarize_key and system_snapshot)
#
# metrics.py same pattern → same blind spot
#
# replay.py used e.get("key_id") → caught flat events but missed all
#   payload-wrapped events
#
# Fix: normalize_event() produces one canonical shape on read.
# All consumers now use the same field names regardless of writer.
# ============================================================

def normalize_event(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a raw audit log line into a single canonical shape.

    Output fields (all consumers should use these):
      event_type, timestamp_utc, key_id, scheme, parameter_set,
      metadata (dict), result (dict), _raw (original)
    """
    payload = raw.get("payload") or {}
    metadata = raw.get("metadata") or payload.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    key_id = (
        raw.get("key_id")
        or payload.get("key_id")
        or metadata.get("key_id")
    )

    scheme = raw.get("scheme") or payload.get("scheme")
    parameter_set = raw.get("parameter_set") or payload.get("parameter_set")
    result = raw.get("result") or payload.get("result") or {}

    return {
        "event_type": raw.get("event_type", "unknown"),
        "timestamp_utc": raw.get("timestamp_utc", ""),
        "key_id": key_id,
        "scheme": scheme,
        "parameter_set": parameter_set,
        "metadata": metadata,
        "result": result,
        "_raw": raw,
    }


# ============================================================
# Core Append-Only Logger
# ============================================================

def append_event(
    *,
    event_type: str,
    payload: Dict[str, Any],
    audit_path: str = DEFAULT_AUDIT_LOG_PATH,
) -> None:
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


def read_events(
    *,
    audit_path: str = DEFAULT_AUDIT_LOG_PATH,
    limit: Optional[int] = None,
    normalize: bool = True,
) -> Iterable[Dict[str, Any]]:
    """
    Stream audit events from disk.
    normalize=True (default): returns canonical shape.
    normalize=False: raw dicts for forensics/export.
    """
    if not os.path.exists(audit_path):
        return []

    events = []
    with open(audit_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
                events.append(normalize_event(raw) if normalize else raw)
            except Exception:
                continue

    if limit is not None:
        return events[-limit:]

    return events


def audit_log_size(audit_path: str = DEFAULT_AUDIT_LOG_PATH) -> int:
    if not os.path.exists(audit_path):
        return 0
    with open(audit_path, "r", encoding="utf-8") as f:
        return sum(1 for _ in f)


def log_key_event(
    *,
    event_type: str,
    key_id: Optional[str],
    scheme: Optional[str] = None,
    parameter_set: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
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
    append_event(
        event_type=event_type,
        payload={"metadata": metadata or {}},
    )