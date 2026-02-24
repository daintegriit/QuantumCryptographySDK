# backend/key_management/metadata.py
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any


# ============================================================
# Helpers
# ============================================================

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


# ============================================================
# Cryptographic Lineage & Status
# ============================================================

@dataclass(frozen=True)
class AlgorithmLineage:
    """
    Describes where a cryptographic algorithm came from
    and how it relates to future migrations.
    """
    family: str                 # e.g. "Lattice", "Code-based"
    scheme: str                 # e.g. "Kyber", "NTRU"
    variant: str                # e.g. "ML-KEM-768"
    standard_body: str          # e.g. "NIST PQC"
    standard_version: str       # e.g. "FIPS-203-draft"
    reference_url: Optional[str] = None


@dataclass(frozen=True)
class DeprecationStatus:
    """
    Tracks cryptographic health over time.
    """
    is_deprecated: bool
    reason: Optional[str] = None
    deprecated_at_utc: Optional[str] = None
    superseded_by: Optional[str] = None  # algorithm ID


# ============================================================
# Key Metadata (THIS IS THE CORE CONTRACT)
# ============================================================

@dataclass
class KeyMetadata:
    """
    Canonical metadata for a cryptographic key.
    This schema is designed to survive decades.
    """

    # ---- Identity ----
    key_id: str
    fingerprint: str            # stable hash of public key
    created_at_utc: str

    # ---- Algorithm ----
    algorithm_id: str           # stable ID, e.g. "QS-LATTICE-001"
    algorithm_lineage: AlgorithmLineage
    parameter_set: str
    security_level: str         # e.g. "NIST-L1", "NIST-L3"

    # ---- Longevity ----
    estimated_longevity_years: int
    revalidation_interval_years: int = 5

    # ---- Policy & Compliance ----
    policy_profile: str = "default"
    compliance_tags: List[str] = field(default_factory=list)

    # ---- Status ----
    deprecation: DeprecationStatus = field(
        default_factory=lambda: DeprecationStatus(is_deprecated=False)
    )

    # ---- Migration ----
    migration_ready: bool = True
    migration_targets: List[str] = field(default_factory=list)

    # ---- Telemetry Hooks ----
    usage_counter: int = 0
    last_used_at_utc: Optional[str] = None

    # ---- Free-form ----
    notes: str = ""

    # ---- Integrity ----
    metadata_hash: Optional[str] = None


# ============================================================
# Metadata Builder / Validator
# ============================================================

def build_key_metadata(
    *,
    key_id: str,
    public_key_b64: str,
    algorithm_id: str,
    lineage: AlgorithmLineage,
    parameter_set: str,
    security_level: str,
    estimated_longevity_years: int,
    compliance_tags: Optional[List[str]] = None,
    policy_profile: str = "default",
    notes: str = "",
) -> KeyMetadata:
    """
    Build and finalize KeyMetadata with integrity hash.
    """

    created_at = utc_now_iso()
    fingerprint = sha256_hex(public_key_b64)

    meta = KeyMetadata(
        key_id=key_id,
        fingerprint=fingerprint,
        created_at_utc=created_at,
        algorithm_id=algorithm_id,
        algorithm_lineage=lineage,
        parameter_set=parameter_set,
        security_level=security_level,
        estimated_longevity_years=int(estimated_longevity_years),
        compliance_tags=compliance_tags or [],
        policy_profile=policy_profile,
        notes=notes.strip(),
    )

    meta.metadata_hash = compute_metadata_hash(meta)
    return meta


def compute_metadata_hash(meta: KeyMetadata) -> str:
    """
    Computes a stable integrity hash for metadata.
    Excludes the metadata_hash field itself.
    """
    data = asdict(meta).copy()
    data.pop("metadata_hash", None)
    canonical = json.dumps(data, sort_keys=True)
    return sha256_hex(canonical)


def validate_metadata(meta: KeyMetadata) -> Dict[str, Any]:
    """
    Validate metadata integrity and sanity.
    Returns a validation report (never raises).
    """
    report = {
        "valid": True,
        "errors": [],
        "warnings": [],
    }

    # Integrity check
    expected_hash = compute_metadata_hash(meta)
    if meta.metadata_hash != expected_hash:
        report["valid"] = False
        report["errors"].append("Metadata hash mismatch")

    # Longevity sanity
    if meta.estimated_longevity_years < 10:
        report["warnings"].append("Longevity estimate is unusually low")

    # Deprecation sanity
    if meta.deprecation.is_deprecated and not meta.deprecation.reason:
        report["warnings"].append("Deprecated key missing reason")

    return report


# ============================================================
# Update Helpers (non-destructive)
# ============================================================

def mark_key_used(meta: KeyMetadata) -> KeyMetadata:
    meta.usage_counter += 1
    meta.last_used_at_utc = utc_now_iso()
    meta.metadata_hash = compute_metadata_hash(meta)
    return meta


def deprecate_key(
    meta: KeyMetadata,
    *,
    reason: str,
    superseded_by: Optional[str] = None,
) -> KeyMetadata:
    meta.deprecation = DeprecationStatus(
        is_deprecated=True,
        reason=reason,
        deprecated_at_utc=utc_now_iso(),
        superseded_by=superseded_by,
    )
    meta.metadata_hash = compute_metadata_hash(meta)
    return meta