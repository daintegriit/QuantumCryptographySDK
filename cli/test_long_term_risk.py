#!/usr/bin/env python3
"""
Q-SENTRY ELITE LONG-TERM RISK MODEL

Evaluates:
- Risk score vs longevity (10–50 years)
- Multi-level Kyber scaling (L1, L3, L5)
- Signature schemes (Dilithium, Falcon)
- Policy actions over time
- Risk trend (increasing / stable / decreasing)

Poster-ready JSON output
"""

import requests
import json
from datetime import datetime

API = "http://localhost:8008/api"

KYBER_LEVELS = ["kyber512", "kyber768", "kyber1024"]
SIGNATURES = [
    ("dilithium", "dilithium3"),
    ("falcon", "falcon512"),
]
YEARS = [10, 20, 30, 40, 50]


# ============================================================
# HELPERS
# ============================================================

def call_keygen(payload):
    try:
        res = requests.post(f"{API}/keygen", json=payload, timeout=10)
        return res.status_code, res.json()
    except Exception as e:
        return 500, {"error": str(e)}


def extract_policy(data):
    policy = data.get("policy", {})
    return {
        "risk_score": policy.get("risk_score"),
        "allowed": policy.get("allowed"),
        "actions": policy.get("required_actions"),
        "security_level": policy.get("security_level"),
    }


def analyze_trend(results):
    risks = [r["risk_score"] for r in results if r["risk_score"] is not None]

    if len(risks) < 2:
        return "insufficient_data"

    if risks[-1] > risks[0]:
        return "increasing_risk"
    elif risks[-1] < risks[0]:
        return "decreasing_risk"
    return "stable_risk"


# ============================================================
# TESTS
# ============================================================

def run_kyber_risk():
    output = []

    for level in KYBER_LEVELS:
        level_results = []

        for y in YEARS:
            status, data = call_keygen({
                "algorithm": "kyber",
                "parameter_set": level,
                "estimated_longevity_years": y
            })

            policy = extract_policy(data)

            level_results.append({
                "years": y,
                **policy
            })

        output.append({
            "scheme": level,
            "results": level_results,
            "trend": analyze_trend(level_results)
        })

    return output


def run_signature_risk():
    output = []

    for algo, param in SIGNATURES:
        sig_results = []

        for y in YEARS:
            status, data = call_keygen({
                "algorithm": algo,
                "parameter_set": param,
                "estimated_longevity_years": y
            })

            policy = extract_policy(data)

            sig_results.append({
                "years": y,
                **policy
            })

        output.append({
            "scheme": param,
            "results": sig_results,
            "trend": analyze_trend(sig_results)
        })

    return output


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("\n🔥 Running Q-SENTRY Long-Term Risk Model...\n")

    kyber = run_kyber_risk()
    signatures = run_signature_risk()

    summary = {
        "timestamp": datetime.utcnow().isoformat(),
        "test": "long_term_risk_model",
        "kyber_levels": kyber,
        "signature_schemes": signatures,
    }

    print("\n📊 ===== LONG-TERM RISK RESULTS =====\n")
    print(json.dumps(summary, indent=2))

    filename = f"long_term_risk_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n💾 Saved → {filename}")