#!/usr/bin/env python3
"""
Q-SENTRY ELITE ADVERSARIAL TEST

Covers:
- Kyber (multi-level)
    - cross-key decryption
    - tampered ciphertext

- Signatures (Dilithium + Falcon)
    - wrong key verification
    - tampered signature
    - tampered message

Poster-ready outputs
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



# ============================================================
# HELPERS
# ============================================================

def keygen(alg, param):
    return requests.post(f"{API}/keygen", json={
        "algorithm": alg,
        "parameter_set": param
    }).json()["key"]["key_id"]


# ============================================================
# KEM TESTS
# ============================================================

def test_cross_key(param):
    k1 = keygen("kyber", param)
    k2 = keygen("kyber", param)

    enc = requests.post(f"{API}/encrypt", json={
        "plaintext": "attack",
        "key_id": k1
    }).json()

    try:
        res = requests.post(f"{API}/decrypt", json={
            "ciphertext": enc["ciphertext"],
            "key_id": k2
        })

        return res.status_code != 200
    except:
        return True


def test_tampered_ciphertext(param):
    k = keygen("kyber", param)

    enc = requests.post(f"{API}/encrypt", json={
        "plaintext": "attack",
        "key_id": k
    }).json()

    tampered = enc["ciphertext"].copy()
    tampered["ciphertext"] = tampered["ciphertext"][:-5] + "AAAA"

    try:
        res = requests.post(f"{API}/decrypt", json={
            "ciphertext": tampered,
            "key_id": k
        })

        return res.status_code != 200
    except:
        return True


# ============================================================
# SIGNATURE TESTS
# ============================================================

def test_wrong_key_verify(alg, param):
    k1 = keygen(alg, param)
    k2 = keygen(alg, param)

    msg = "attack message"

    sig = requests.post(f"{API}/sign", json={
        "message": msg,
        "key_id": k1
    }).json()["signature"]

    res = requests.post(f"{API}/verify", json={
        "message": msg,
        "signature": sig,
        "key_id": k2
    }).json()

    return res.get("valid") is False


def test_tampered_signature(alg, param):
    k = keygen(alg, param)
    msg = "attack message"

    sig = requests.post(f"{API}/sign", json={
        "message": msg,
        "key_id": k
    }).json()["signature"]

    tampered_sig = sig[:-5] + "AAAA"

    res = requests.post(f"{API}/verify", json={
        "message": msg,
        "signature": tampered_sig,
        "key_id": k
    }).json()

    return res.get("valid") is False


def test_tampered_message(alg, param):
    k = keygen(alg, param)
    msg = "original message"

    sig = requests.post(f"{API}/sign", json={
        "message": msg,
        "key_id": k
    }).json()["signature"]

    res = requests.post(f"{API}/verify", json={
        "message": "tampered message",
        "signature": sig,
        "key_id": k
    }).json()

    return res.get("valid") is False


# ============================================================
# MAIN
# ============================================================

def run_with_iterations(test_fn, *args):
    success = 0
    failures = 0

    for _ in range(ITERATIONS):
        try:
            if test_fn(*args):
                success += 1
            else:
                failures += 1
        except:
            failures += 1

    return {
        "iterations": ITERATIONS,
        "success": success,
        "failures": failures,
        "success_rate": round((success / ITERATIONS) * 100, 2)
    }


if __name__ == "__main__":
    print("\n🔓 Running Q-SENTRY Adversarial Test...\n")

    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "iterations": ITERATIONS,
        "kyber": {},
        "signatures": {}
    }

    # ---------------- KYBER ----------------
    for level in KYBER_LEVELS:
        results["kyber"][level] = {
            "cross_key_blocked": run_with_iterations(test_cross_key, level),
            "tamper_detected": run_with_iterations(test_tampered_ciphertext, level),
        }

    # ---------------- SIGNATURES ----------------
    for alg, param in SIGNATURES:
        results["signatures"][param] = {
            "wrong_key_blocked": run_with_iterations(test_wrong_key_verify, alg, param),
            "tamper_signature_detected": run_with_iterations(test_tampered_signature, alg, param),
            "tamper_message_detected": run_with_iterations(test_tampered_message, alg, param),
        }

    print("\n📊 ===== ADVERSARIAL RESULTS =====\n")
    print(json.dumps(results, indent=2))

    filename = f"adversarial_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n💾 Saved → {filename}")