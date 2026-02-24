# backend/policy/security_store.py
from __future__ import annotations

import json
import os
import threading
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from .parameter_validation import validate_and_normalize
from .nist_pqc import evaluate_key_policy, DEFAULT_PROFILE, PolicyDecision

# ============================================================
# Helpers
# ============================================================

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def ensure_dir_for_file(path: str) -> None:
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)

def _normalize_tags(tags: Optional[List[str]]) -> Tuple[str, ...]:
    if not tags:
        return tuple()
    cleaned = []
    for t in tags:
        if not t:
            continue
        s = str(t).strip().lower()
        if s:
            cleaned.append(s)
    return tuple(sorted(set(cleaned)))

# ============================================================
# Audit Log (append-only JSONL)
# ============================================================

DEFAULT_AUDIT_PATH = os.getenv("QS_AUDIT_LOG_PATH", "backend/telemetry/audit_policy.jsonl")
_audit_lock = threading.Lock()

def append_audit_event(event: Dict[str, Any], audit_path: str = DEFAULT_AUDIT_PATH) -> None:
    """
    Append-only JSONL logging for policy decisions & lifecycle events.

    - Lock protects concurrent writes inside one process
    - flush + fsync reduces risk of losing events in container restarts
    """
    ensure_dir_for_file(audit_path)

    payload = dict(event)
    payload.setdefault("timestamp_utc", utc_now_iso())

    line = json.dumps(payload, ensure_ascii=False)

    with _audit_lock:
        with open(audit_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
            f.flush()
            try:
                os.fsync(f.fileno())
            except Exception:
                # Some environments/filesystems may not support fsync reliably
                pass

# ============================================================
# In-Memory Policy Cache
# ============================================================

_cache_lock = threading.Lock()
_policy_cache: Dict[str, Dict[str, Any]] = {}

def _cache_key(
    profile: str,
    scheme: str,
    parameter_set: str,
    longevity: int,
    migration_ready: bool,
    deprecated: bool,
    tags: Tuple[str, ...],
) -> str:
    return "|".join([
        profile.strip(),
        scheme.strip(),
        parameter_set.strip(),
        str(int(longevity)),
        "1" if migration_ready else "0",
        "1" if deprecated else "0",
        ",".join(tags),
    ])

# ============================================================
# Public API
# ============================================================

def check_key_allowed(
    *,
    profile: str = DEFAULT_PROFILE,
    scheme: str,
    parameter_set: str,
    claimed_security_level: Optional[str] = None,
    estimated_longevity_years: Optional[int] = None,
    migration_ready: bool = True,
    is_deprecated: bool = False,
    compliance_tags: Optional[List[str]] = None,
    audit: bool = True,
) -> Dict[str, Any]:
    """
    One-stop policy check:
      1) Normalize + validate inputs
      2) Evaluate policy (risk + allow/deny)
      3) Cache result
      4) Optionally audit log

    Returns a dict suitable for FastAPI JSON response.
    """
    tags_tuple = _normalize_tags(compliance_tags)

    # Normalize + validate
    norm = validate_and_normalize(scheme, parameter_set)

    # Invalid inputs -> structured denial
    if not getattr(norm, "valid", False):
        decision = {
            "profile": profile,
            "allowed": False,
            "risk_score": 0.95,
            "security_level": claimed_security_level or getattr(norm, "security_level", None) or "UNKNOWN",
            "required_actions": ["BLOCK", "FIX_PARAMETERS"],
            "warnings": list(getattr(norm, "warnings", []) or []),
            "errors": list(getattr(norm, "errors", []) or []),
            "inputs": {
                "scheme": scheme,
                "parameter_set": parameter_set,
                "normalized_scheme": getattr(norm, "scheme", None),
                "normalized_parameter_set": getattr(norm, "parameter_set", None),
                "claimed_security_level": claimed_security_level,
                "estimated_longevity_years": estimated_longevity_years,
                "migration_ready": migration_ready,
                "is_deprecated": is_deprecated,
                "compliance_tags": list(tags_tuple),
            },
        }

        if audit:
            append_audit_event({"event_type": "policy_check_invalid", "result": decision})

        # Keep a timestamp for caller consistency
        decision["timestamp_utc"] = utc_now_iso()
        return decision

    longevity = int(estimated_longevity_years) if estimated_longevity_years is not None else 30

    ck = _cache_key(
        profile=profile,
        scheme=norm.scheme,
        parameter_set=norm.parameter_set,
        longevity=longevity,
        migration_ready=migration_ready,
        deprecated=is_deprecated,
        tags=tags_tuple,
    )

    # Cache hit
    with _cache_lock:
        cached = _policy_cache.get(ck)
    if cached is not None:
        if audit:
            append_audit_event({"event_type": "policy_check_cache_hit", "cache_key": ck, "result": cached})
        return cached

    # Evaluate policy
    try:
        policy_decision: PolicyDecision = evaluate_key_policy(
            profile=profile,
            scheme=norm.scheme,
            parameter_set=norm.parameter_set,
            claimed_security_level=claimed_security_level or norm.security_level,
            estimated_longevity_years=estimated_longevity_years,
            migration_ready=migration_ready,
            is_deprecated=is_deprecated,
            compliance_tags=list(tags_tuple),
        )
        result = asdict(policy_decision)
    except Exception as e:
        # Fail closed in strict systems; we log and block by default.
        result = {
            "profile": profile,
            "allowed": False,
            "risk_score": 0.99,
            "security_level": claimed_security_level or norm.security_level or "UNKNOWN",
            "required_actions": ["BLOCK", "POLICY_EVALUATION_FAILED"],
            "warnings": list(getattr(norm, "warnings", []) or []),
            "errors": [f"policy_evaluation_exception: {type(e).__name__}"],
        }
        if audit:
            append_audit_event({"event_type": "policy_check_error", "cache_key": ck, "result": result})

    # Enrich with normalized info (debug + UX)
    result.setdefault("normalized", {})
    result["normalized"] = {
        "scheme": norm.scheme,
        "parameter_set": norm.parameter_set,
        "inferred_security_level": norm.security_level,
        "warnings": list(getattr(norm, "warnings", []) or []),
    }
    result["timestamp_utc"] = utc_now_iso()

    # Store in cache
    with _cache_lock:
        _policy_cache[ck] = result

    # Audit log
    if audit:
        append_audit_event({"event_type": "policy_check", "cache_key": ck, "result": result})

    return result


def record_key_event(
    *,
    event_type: str,
    key_id: Optional[str] = None,
    scheme: Optional[str] = None,
    parameter_set: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    audit_path: str = DEFAULT_AUDIT_PATH,
) -> None:
    """
    Generic event logger (keygen, rotate, encrypt, decrypt, migrate, lifecycle alerts, etc.).
    """
    append_audit_event(
        {
            "event_type": str(event_type),
            "key_id": key_id,
            "scheme": scheme,
            "parameter_set": parameter_set,
            "metadata": metadata or {},
        },
        audit_path=audit_path,
    )


def clear_policy_cache() -> int:
    """Clears the in-memory policy cache. Returns number of entries removed."""
    with _cache_lock:
        n = len(_policy_cache)
        _policy_cache.clear()
        return n


def cache_size() -> int:
    with _cache_lock:
        return len(_policy_cache)