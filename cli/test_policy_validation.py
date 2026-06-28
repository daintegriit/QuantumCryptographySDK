#!/usr/bin/env python3
"""
Q-SENTRY ELITE POLICY VALIDATION TEST

Validates:
- Multi-level Kyber (512 / 768 / 1024)
- Signature schemes (Dilithium, Falcon)
- Invalid parameter rejection
- Long-term risk modeling
- Policy outputs (risk_score, actions, warnings)

Poster-ready governance validation
"""

import requests
import json
from datetime import datetime

API = "http://localhost:8008/api"


# ============================================================
# HELPERS
# ============================================================

def call_keygen(payload):
    try:
        res = requests.post(f"{API}/keygen", json=payload, timeout=10)
        data = res.json()
        return res.status_code, data
    except Exception as e:
        return 500, {"error": str(e)}


# ============================================================
# TESTS
# ============================================================

def test_multilevel_kyber():
    results = []

    for param in ["kyber512", "kyber768", "kyber1024"]:
        status, data = call_keygen({
            "algorithm": "kyber",
            "parameter_set": param
        })

        results.append({
            "scheme": param,
            "allowed": status == 200,
            "risk_score": data.get("policy", {}).get("risk_score"),
            "actions": data.get("policy", {}).get("required_actions"),
        })

    return {
        "test": "multi_level_kyber",
        "results": results
    }


def test_signature_algorithms():
    results = []

    for param, algo in [
        ("dilithium3", "dilithium"),
        ("falcon512", "falcon")
    ]:
        status, data = call_keygen({
            "algorithm": algo,
            "parameter_set": param
        })

        results.append({
            "scheme": param,
            "allowed": status == 200,
            "risk_score": data.get("policy", {}).get("risk_score"),
        })

    return {
        "test": "signature_algorithms",
        "results": results
    }


def test_invalid_parameters():
    status, data = call_keygen({
        "algorithm": "kyber",
        "parameter_set": "kyber999"
    })

    return {
        "test": "invalid_parameter_block",
        "blocked": status != 200,
        "response": data
    }


def test_long_term_risk():
    results = []

    for years in [10, 20, 30, 40, 50]:
        status, data = call_keygen({
            "algorithm": "kyber",
            "parameter_set": "kyber768",
            "estimated_longevity_years": years
        })

        policy = data.get("policy", {})

        results.append({
            "years": years,
            "allowed": policy.get("allowed"),
            "risk_score": policy.get("risk_score"),
            "actions": policy.get("required_actions"),
        })

    return {
        "test": "long_term_risk_model",
        "results": results
    }


def test_policy_fields():
    status, data = call_keygen({
        "algorithm": "kyber",
        "parameter_set": "kyber768"
    })

    policy = data.get("policy", {})

    return {
        "test": "policy_fields_present",
        "has_risk_score": "risk_score" in policy,
        "has_actions": "required_actions" in policy,
        "has_warnings": "warnings" in policy,
        "has_security_level": "security_level" in policy,
    }


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("\n🛡️ Running Q-SENTRY Policy Validation Suite...\n")

    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "tests": [
            test_multilevel_kyber(),
            test_signature_algorithms(),
            test_invalid_parameters(),
            test_long_term_risk(),
            test_policy_fields(),
        ]
    }

    print("\n📊 ===== POLICY VALIDATION RESULTS =====\n")
    print(json.dumps(results, indent=2))

    filename = f"policy_validation_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n💾 Saved → {filename}")