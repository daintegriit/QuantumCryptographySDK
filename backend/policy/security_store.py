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
    cleaned: List[str] = []
    for t in tags:
        if t is None:
            continue
        s = str(t).strip().lower()
        if s:
            cleaned.append(s)
    return tuple(sorted(set(cleaned)))


def _normalize_text(value: Optional[str]) -> str:
    return str(value or "").strip()


def _safe_int(value: Optional[int], default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except Exception:
        return default


def _infer_key_family(scheme: str, parameter_set: str) -> str:
    s = _normalize_text(scheme).lower()
    p = _normalize_text(parameter_set).lower()
    combined = f"{s} {p}"
    if "kyber" in combined or "ml-kem" in combined:
        return "kem"
    if "dilithium" in combined or "ml-dsa" in combined or "falcon" in combined:
        return "signature"
    return "unknown"


# ============================================================
# Audit Log (append-only JSONL)
# ============================================================

# Policy decisions log
DEFAULT_AUDIT_PATH = os.getenv(
    "QS_AUDIT_POLICY_PATH",
    "telemetry/audit_policy.jsonl",
)

# Telemetry/replay/anomaly log — read by telemetry, replay, metrics engines
DEFAULT_AUDIT_LOG_PATH = os.getenv(
    "QS_AUDIT_LOG_PATH",
    "telemetry/audit_log.jsonl",
)

_audit_lock = threading.Lock()


def append_audit_event(
    event: Dict[str, Any],
    audit_path: str = DEFAULT_AUDIT_PATH,
) -> None:
    """
    Append-only JSONL logging.
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
    claimed_security_level: Optional[str],
    longevity: int,
    migration_ready: bool,
    deprecated: bool,
    tags: Tuple[str, ...],
) -> str:
    return "|".join([
        _normalize_text(profile).lower(),
        _normalize_text(scheme).lower(),
        _normalize_text(parameter_set).lower(),
        _normalize_text(claimed_security_level).upper(),
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
    raw_scheme = _normalize_text(scheme)
    raw_parameter_set = _normalize_text(parameter_set)
    raw_claimed_security_level = _normalize_text(claimed_security_level) or None
    tags_tuple = _normalize_tags(compliance_tags)

    norm = validate_and_normalize(raw_scheme, raw_parameter_set)
    key_family = _infer_key_family(raw_scheme, raw_parameter_set)

    if not getattr(norm, "valid", False):
        decision = {
            "profile": profile,
            "allowed": False,
            "risk_score": 0.95,
            "security_level": (
                raw_claimed_security_level
                or getattr(norm, "security_level", None)
                or "UNKNOWN"
            ),
            "required_actions": ["BLOCK", "FIX_PARAMETERS"],
            "warnings": list(getattr(norm, "warnings", []) or []),
            "errors": list(getattr(norm, "errors", []) or []),
            "inputs": {
                "scheme": raw_scheme,
                "parameter_set": raw_parameter_set,
                "normalized_scheme": getattr(norm, "scheme", None),
                "normalized_parameter_set": getattr(norm, "parameter_set", None),
                "claimed_security_level": raw_claimed_security_level,
                "estimated_longevity_years": estimated_longevity_years,
                "migration_ready": migration_ready,
                "is_deprecated": is_deprecated,
                "compliance_tags": list(tags_tuple),
                "key_family": key_family,
            },
            "normalized": {
                "scheme": getattr(norm, "scheme", None),
                "parameter_set": getattr(norm, "parameter_set", None),
                "inferred_security_level": getattr(norm, "security_level", None),
                "warnings": list(getattr(norm, "warnings", []) or []),
                "key_family": key_family,
            },
            "timestamp_utc": utc_now_iso(),
        }

        if audit:
            append_audit_event({"event_type": "policy_check_invalid", "result": decision})
        return decision

    longevity = _safe_int(estimated_longevity_years, 30)
    normalized_scheme = _normalize_text(getattr(norm, "scheme", raw_scheme))
    normalized_parameter_set = _normalize_text(getattr(norm, "parameter_set", raw_parameter_set))
    inferred_security_level = getattr(norm, "security_level", None)
    effective_security_level = raw_claimed_security_level or inferred_security_level

    ck = _cache_key(
        profile=profile,
        scheme=normalized_scheme,
        parameter_set=normalized_parameter_set,
        claimed_security_level=effective_security_level,
        longevity=longevity,
        migration_ready=migration_ready,
        deprecated=is_deprecated,
        tags=tags_tuple,
    )

    with _cache_lock:
        cached = _policy_cache.get(ck)

    if cached is not None:
        cached_out = dict(cached)
        cached_out["timestamp_utc"] = utc_now_iso()
        if audit:
            append_audit_event({"event_type": "policy_check_cache_hit", "cache_key": ck, "result": cached_out})
        return cached_out

    try:
        policy_decision: PolicyDecision = evaluate_key_policy(
            profile=profile,
            scheme=normalized_scheme,
            parameter_set=normalized_parameter_set,
            claimed_security_level=effective_security_level,
            estimated_longevity_years=longevity,
            migration_ready=migration_ready,
            is_deprecated=is_deprecated,
            compliance_tags=list(tags_tuple),
        )
        result = asdict(policy_decision)
    except Exception as e:
        result = {
            "profile": profile,
            "allowed": False,
            "risk_score": 0.99,
            "security_level": effective_security_level or "UNKNOWN",
            "required_actions": ["BLOCK", "POLICY_EVALUATION_FAILED"],
            "warnings": list(getattr(norm, "warnings", []) or []),
            "errors": [f"policy_evaluation_exception: {type(e).__name__}: {str(e)}"],
        }
        if audit:
            append_audit_event({"event_type": "policy_check_error", "cache_key": ck, "result": result})

    result["inputs"] = {
        "scheme": raw_scheme,
        "parameter_set": raw_parameter_set,
        "claimed_security_level": raw_claimed_security_level,
        "estimated_longevity_years": longevity,
        "migration_ready": migration_ready,
        "is_deprecated": is_deprecated,
        "compliance_tags": list(tags_tuple),
        "key_family": key_family,
    }
    result["normalized"] = {
        "scheme": normalized_scheme,
        "parameter_set": normalized_parameter_set,
        "inferred_security_level": inferred_security_level,
        "warnings": list(getattr(norm, "warnings", []) or []),
        "key_family": key_family,
    }
    result["timestamp_utc"] = utc_now_iso()

    stored_result = dict(result)
    with _cache_lock:
        _policy_cache[ck] = stored_result

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
    Generic event logger (keygen, rotate, encrypt, decrypt, sign, verify,
    migrate, lifecycle alerts, etc.).

    FIX: Dual-writes to BOTH audit_policy.jsonl AND audit_log.jsonl so that
    telemetry, replay, and anomaly engines see all crypto events. Previously
    only wrote to audit_policy.jsonl, which telemetry/replay never read.
    """
    event = {
        "event_type": str(event_type),
        "key_id": key_id,
        "scheme": scheme,
        "parameter_set": parameter_set,
        "metadata": metadata or {},
        "timestamp_utc": utc_now_iso(),
    }

    # Write to policy audit log
    append_audit_event(event, audit_path=audit_path)

    # Also write to telemetry/replay audit log if different path
    if audit_path != DEFAULT_AUDIT_LOG_PATH:
        try:
            append_audit_event(event, audit_path=DEFAULT_AUDIT_LOG_PATH)
        except Exception:
            pass


def clear_policy_cache() -> int:
    with _cache_lock:
        n = len(_policy_cache)
        _policy_cache.clear()
        return n


def cache_size() -> int:
    with _cache_lock:
        return len(_policy_cache)