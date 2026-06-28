# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# =================================================
# Core APIs
# =================================================
from api.keys import router as keys_router
from api.encrypt_api import router as encrypt_router
from api.sign_api import router as sign_router
from api.classical_api import router as classical_router

# =================================================
# Governance & lifecycle engines
# =================================================
from api.migration import router as migration_router
from api.simulations import router as simulations_router

# =================================================
# Observability, auditability & intelligence
# =================================================
from api.telemetry import router as telemetry_router
from api.metrics import router as metrics_router
from api.replay import router as replay_router
from api.explain import router as explain_router
from api.anomaly import router as anomaly_router
from api.policy_drift import router as policy_drift_router  # ⬅️ NEW
from api.policy import router as policy_router  # ⬅️ NEW
from api.kem_api import router as kem_router  # ⬅️ NEW
from api.algorithms import router as algorithms_router



# =================================================
# App
# =================================================
app = FastAPI(
    title="QuantumShield Backend",
    description="Policy-driven post-quantum cryptographic governance engine",
    version="0.1.0",
)

# =================================================
# CORS (frontend-ready)
# =================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3008",
        "http://127.0.0.1:3008",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================================================
# Health
# =================================================
@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}

# =================================================
# API Routers
# =================================================

# --- Key management ---
app.include_router(keys_router, prefix="/api", tags=["keys"])
app.include_router(encrypt_router, prefix="/api", tags=["crypto"])
app.include_router(sign_router, prefix="/api", tags=["signatures"])
app.include_router(classical_router, prefix="/api", tags=["classical"])

# --- Governance engines ---
app.include_router(migration_router, prefix="/api", tags=["migration"])
app.include_router(simulations_router, prefix="/api", tags=["simulations"])

# --- Observability & intelligence ---
app.include_router(telemetry_router, prefix="/api", tags=["telemetry"])
app.include_router(metrics_router, prefix="/api", tags=["metrics"])
app.include_router(replay_router, prefix="/api", tags=["replay"])
app.include_router(explain_router, prefix="/api", tags=["explain"])
app.include_router(anomaly_router, prefix="/api", tags=["anomalies"])
app.include_router(policy_drift_router, prefix="/api", tags=["policy-drift"])
app.include_router(policy_router, prefix="/api", tags=["policy"])
app.include_router(kem_router, prefix="/api", tags=["kem"])
app.include_router(algorithms_router, prefix="/api", tags=["algorithms"])

