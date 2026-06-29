# backend/api/admin.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, List
import os
from pathlib import Path

router = APIRouter(prefix="/api/admin", tags=["admin"])

def _require_admin(request: Request):
    token = request.cookies.get("access_token")
    auth_header = request.headers.get("Authorization", "")
    if not token and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        from auth.jwt_handler import decode_token
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        if not payload.get("admin"):
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/users")
async def list_users(request: Request):
    _require_admin(request)
    try:
        from auth.database import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT user_id, email, name, avatar_url, created_at,
                       last_login, is_admin, is_active
                FROM users ORDER BY created_at DESC
            """)
        data_dir = Path(os.getenv("QS_DATA_DIR", "/app/data"))
        users = []
        for row in rows:
            u = dict(row)
            u["created_at"] = str(u["created_at"])
            u["last_login"] = str(u["last_login"])
            keystore = data_dir / "keystores" / u["user_id"] / "keys"
            u["key_count"] = len(list(keystore.glob("*.json"))) if keystore.exists() else 0
            users.append(u)
        return {"users": users, "total": len(users)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/disable")
async def disable_user(user_id: str, request: Request):
    _require_admin(request)
    from auth.database import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET is_active = FALSE WHERE user_id = $1", user_id)
    return {"disabled": True, "user_id": user_id}


@router.post("/users/{user_id}/enable")
async def enable_user(user_id: str, request: Request):
    _require_admin(request)
    from auth.database import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET is_active = TRUE WHERE user_id = $1", user_id)
    return {"enabled": True, "user_id": user_id}


@router.post("/users/{user_id}/toggle_admin")
async def toggle_admin(user_id: str, request: Request):
    payload = _require_admin(request)
    if payload.get("sub") == user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")
    from auth.database import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET is_admin = NOT is_admin WHERE user_id = $1", user_id)
        row = await conn.fetchrow("SELECT is_admin FROM users WHERE user_id = $1", user_id)
    return {"user_id": user_id, "is_admin": row["is_admin"]}


@router.get("/keystores")
def keystore_overview(request: Request):
    _require_admin(request)
    import json
    data_dir = Path(os.getenv("QS_DATA_DIR", "/app/data"))
    keystores_root = data_dir / "keystores"
    result = []
    if keystores_root.exists():
        for user_dir in keystores_root.iterdir():
            if not user_dir.is_dir():
                continue
            keys_dir = user_dir / "keys"
            key_files = list(keys_dir.glob("*.json")) if keys_dir.exists() else []
            algo_counts: Dict[str, int] = {}
            total_risk = 0.0
            for kf in key_files:
                try:
                    k = json.loads(kf.read_text())
                    alg = k.get("algorithm", "unknown")
                    algo_counts[alg] = algo_counts.get(alg, 0) + 1
                    total_risk += k.get("policy_risk_score", 0)
                except Exception:
                    pass
            result.append({
                "user_id": user_dir.name,
                "key_count": len(key_files),
                "algorithms": algo_counts,
                "avg_risk_score": round(total_risk / len(key_files), 3) if key_files else 0,
            })
    return {"users": result, "total_users": len(result),
            "total_keys": sum(u["key_count"] for u in result)}


@router.get("/telemetry")
def system_telemetry(request: Request):
    _require_admin(request)
    import json
    data_dir = Path(os.getenv("QS_DATA_DIR", "/app/data"))
    telemetry_root = data_dir / "telemetry"
    events_by_type: Dict[str, int] = {}
    total_events = 0
    recent_events = []
    if telemetry_root.exists():
        for user_dir in telemetry_root.iterdir():
            audit_log = user_dir / "audit_log.jsonl"
            if audit_log.exists():
                for line in audit_log.read_text().strip().split("\n"):
                    if not line.strip():
                        continue
                    try:
                        event = json.loads(line)
                        etype = event.get("event_type", "unknown")
                        events_by_type[etype] = events_by_type.get(etype, 0) + 1
                        total_events += 1
                        recent_events.append({
                            "user_id": user_dir.name,
                            "event_type": etype,
                            "timestamp": event.get("timestamp", ""),
                            "scheme": event.get("scheme", ""),
                            "parameter_set": event.get("parameter_set", ""),
                        })
                    except Exception:
                        pass
    recent_events.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"total_events": total_events, "events_by_type": events_by_type,
            "recent_events": recent_events[:50]}


@router.get("/audit")
def audit_log(request: Request, limit: int = 100):
    _require_admin(request)
    import json
    data_dir = Path(os.getenv("QS_DATA_DIR", "/app/data"))
    telemetry_root = data_dir / "telemetry"
    all_events = []
    if telemetry_root.exists():
        for user_dir in telemetry_root.iterdir():
            for log_file in ["audit_log.jsonl", "audit_policy.jsonl"]:
                log_path = user_dir / log_file
                if log_path.exists():
                    for line in log_path.read_text().strip().split("\n"):
                        if not line.strip():
                            continue
                        try:
                            event = json.loads(line)
                            event["user_id"] = user_dir.name
                            all_events.append(event)
                        except Exception:
                            pass
    all_events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"events": all_events[:limit], "total": len(all_events)}


@router.get("/algorithms/stats")
def algorithm_stats(request: Request):
    _require_admin(request)
    import json
    data_dir = Path(os.getenv("QS_DATA_DIR", "/app/data"))
    algo_counts: Dict[str, int] = {}
    param_counts: Dict[str, int] = {}
    key_type_counts: Dict[str, int] = {}
    security_level_counts: Dict[str, int] = {}
    keystores_root = data_dir / "keystores"
    if keystores_root.exists():
        for user_dir in keystores_root.iterdir():
            keys_dir = user_dir / "keys"
            if keys_dir.exists():
                for kf in keys_dir.glob("*.json"):
                    try:
                        k = json.loads(kf.read_text())
                        for d, key in [(algo_counts, "algorithm"), (param_counts, "parameter_set"),
                                       (key_type_counts, "key_type"), (security_level_counts, "security_level")]:
                            v = k.get(key, "unknown")
                            d[v] = d.get(v, 0) + 1
                    except Exception:
                        pass
    return {
        "by_algorithm": dict(sorted(algo_counts.items(), key=lambda x: x[1], reverse=True)),
        "by_parameter_set": dict(sorted(param_counts.items(), key=lambda x: x[1], reverse=True)),
        "by_key_type": key_type_counts,
        "by_security_level": dict(sorted(security_level_counts.items())),
        "total_keys": sum(algo_counts.values()),
    }


@router.get("/health")
async def admin_health(request: Request):
    _require_admin(request)
    import oqs, shutil
    health = {
        "liboqs": {
            "kem_count": len(oqs.get_enabled_kem_mechanisms()),
            "sig_count": len(oqs.get_enabled_sig_mechanisms()),
        },
        "database": {"status": "unknown"},
        "keystore": {"status": "unknown"},
        "disk": {},
    }
    try:
        from auth.database import get_pool
        pool = await get_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval("SELECT COUNT(*) FROM users")
        health["database"] = {"status": "connected", "user_count": count}
    except Exception as e:
        health["database"] = {"status": "error", "error": str(e)}
    data_dir = Path(os.getenv("QS_DATA_DIR", "/app/data"))
    if data_dir.exists():
        total, used, free = shutil.disk_usage(str(data_dir))
        health["disk"] = {
            "total_gb": round(total / 1e9, 2),
            "used_gb": round(used / 1e9, 2),
            "free_gb": round(free / 1e9, 2),
            "used_pct": round(used / total * 100, 1),
        }
        health["keystore"] = {"status": "mounted", "path": str(data_dir)}
    else:
        health["keystore"] = {"status": "not_mounted"}
    return health