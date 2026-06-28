from __future__ import annotations
import os
from pathlib import Path

BASE_DIR = Path(os.getenv("QS_DATA_DIR", "/app/data"))

def user_keystore_dir(user_id: str) -> Path:
    path = BASE_DIR / "keystores" / user_id / "keys"
    path.mkdir(parents=True, exist_ok=True)
    return path

def user_audit_log_path(user_id: str) -> Path:
    path = BASE_DIR / "telemetry" / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path / "audit_log.jsonl"
