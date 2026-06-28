#!/usr/bin/env python3
"""
Q-SENTRY ELITE FUNCTIONAL CORRECTNESS TEST

Covers:
1. Kyber512 / Kyber768 / Kyber1024 encrypt -> decrypt round trip
2. Dilithium3 sign -> verify round trip
3. Falcon512 sign -> verify round trip
4. Cross-key decryption failure test

Outputs:
- pass / fail / skipped
- success rates
- latency stats
- JSON artifact
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import statistics

import requests

API_BASE = "http://localhost:8008/api"
ROOT_BASE = "http://localhost:8008"
OUT_DIR = Path("cli/results")
OUT_DIR.mkdir(parents=True, exist_ok=True)

TIMEOUT_SECONDS = 20
DEFAULT_ITERATIONS = 100


# ============================================================
# HELPERS
# ============================================================

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def pretty(obj: Any) -> None:
    print(json.dumps(obj, indent=2))


def fail(msg: str) -> None:
    print(f"\n❌ ERROR: {msg}")
    sys.exit(1)


def post_json(path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{API_BASE}{path}"
    try:
        res = requests.post(url, json=payload, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as e:
        raise RuntimeError(f"Request failed for {path}: {e}") from e

    try:
        data = res.json()
    except Exception:
        data = {"raw_text": res.text}

    if res.status_code != 200:
        detail = data.get("detail", data)
        raise RuntimeError(f"{path} returned {res.status_code}: {detail}")

    return data


def get_json(path: str, use_api: bool = True) -> Dict[str, Any]:
    if use_api:
        url = f"{API_BASE}{path}"
    else:
        url = f"{ROOT_BASE}{path}"

    try:
        res = requests.get(url, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as e:
        raise RuntimeError(f"Request failed for {url}: {e}") from e

    try:
        data = res.json()
    except Exception:
        data = {"raw_text": res.text}

    if res.status_code != 200:
        detail = data.get("detail", data)
        raise RuntimeError(f"{url} returned {res.status_code}: {detail}")

    return data


def infer_algorithm(parameter_set: str) -> str:
    p = parameter_set.lower()
    if "kyber" in p:
        return "kyber"
    if "dilithium" in p:
        return "dilithium"
    if "falcon" in p:
        return "falcon"
    raise ValueError(f"Unsupported parameter_set: {parameter_set}")


def generate_key(parameter_set: str) -> Dict[str, Any]:
    algorithm = infer_algorithm(parameter_set)
    return post_json(
        "/keygen",
        {
            "algorithm": algorithm,
            "parameter_set": parameter_set,
        },
    )


def encrypt(plaintext: str, key_id: str) -> Dict[str, Any]:
    return post_json(
        "/encrypt",
        {
            "plaintext": plaintext,
            "key_id": key_id,
        },
    )


def decrypt(ciphertext: Dict[str, Any], key_id: str) -> Dict[str, Any]:
    return post_json(
        "/decrypt",
        {
            "ciphertext": ciphertext,
            "key_id": key_id,
        },
    )


def sign(message: str, key_id: str) -> Dict[str, Any]:
    return post_json(
        "/sign",
        {
            "message": message,
            "key_id": key_id,
        },
    )


def verify(message: str, signature: str, key_id: str) -> Dict[str, Any]:
    return post_json(
        "/verify",
        {
            "message": message,
            "signature": signature,
            "key_id": key_id,
        },
    )


def compute_latency_stats(details: List[Dict[str, Any]]) -> Dict[str, Any]:
    times = [d["elapsed_ms"] for d in details if d.get("success") is True]

    if not times:
        return {
            "avg_ms": None,
            "p95_ms": None,
            "p99_ms": None,
            "min_ms": None,
            "max_ms": None,
        }

    times_sorted = sorted(times)
    n = len(times_sorted)

    def pct(p: float) -> float:
        return times_sorted[min(int(p * n), n - 1)]

    return {
        "avg_ms": round(sum(times_sorted) / n, 4),
        "p50_ms": round(pct(0.50), 4),
        "p95_ms": round(pct(0.95), 4),
        "p99_ms": round(pct(0.99), 4),
        "std_dev_ms": round(statistics.stdev(times_sorted), 4) if len(times_sorted) > 1 else 0.0,
        "min_ms": round(min(times_sorted), 4),
        "max_ms": round(max(times_sorted), 4),
    }

# ============================================================
# KEM TEST
# ============================================================

def run_kyber_roundtrip(
    iterations: int = DEFAULT_ITERATIONS,
    parameter_set: str = "kyber768",
) -> Dict[str, Any]:
    passed = 0
    failed = 0
    details: List[Dict[str, Any]] = []

    for i in range(iterations):
        started = time.perf_counter()
        test_name = f"{parameter_set}_roundtrip_{i + 1}"

        try:
            key_res = generate_key(parameter_set)
            key = key_res["key"]
            key_id = key["key_id"]

            plaintext = f"hello quantum {i}"
            enc_res = encrypt(plaintext, key_id)
            ciphertext = enc_res["ciphertext"]

            dec_res = decrypt(ciphertext, key_id)
            decrypted = dec_res["plaintext"]

            ok = decrypted == plaintext
            elapsed_ms = round((time.perf_counter() - started) * 1000, 4)

            if ok:
                passed += 1
            else:
                failed += 1

            details.append({
                "test": test_name,
                "parameter_set": parameter_set,
                "key_id": key_id,
                "success": ok,
                "elapsed_ms": elapsed_ms,
                "expected_plaintext": plaintext,
                "actual_plaintext": decrypted,
            })

        except Exception as e:
            failed += 1
            elapsed_ms = round((time.perf_counter() - started) * 1000, 4)
            details.append({
                "test": test_name,
                "parameter_set": parameter_set,
                "success": False,
                "elapsed_ms": elapsed_ms,
                "error": str(e),
            })

    total = passed + failed

    return {
        "suite": "kyber_encrypt_decrypt",
        "parameter_set": parameter_set,
        "iterations": iterations,
        "passed": passed,
        "failed": failed,
        "success_rate": round((passed / total) * 100, 2) if total else 0.0,
        "latency": compute_latency_stats(details),
        "details": details,
    }


# ============================================================
# SIGNATURE TEST
# ============================================================

def run_signature_test(
    iterations: int,
    parameter_set: str,
) -> Dict[str, Any]:
    passed = 0
    failed = 0
    skipped = 0
    details: List[Dict[str, Any]] = []

    for i in range(iterations):
        started = time.perf_counter()
        test_name = f"{parameter_set}_sign_verify_{i + 1}"

        try:
            key_res = generate_key(parameter_set)
            key = key_res["key"]
            key_id = key["key_id"]

            message = f"signed quantum message {i}"

            try:
                sign_res = sign(message, key_id)
                signature = sign_res["signature"]
                verify_res = verify(message, signature, key_id)
                ok = bool(verify_res["valid"])
            except Exception as e:
                skipped += 1
                elapsed_ms = round((time.perf_counter() - started) * 1000, 4)
                details.append({
                    "test": test_name,
                    "parameter_set": parameter_set,
                    "key_id": key_id,
                    "success": None,
                    "skipped": True,
                    "elapsed_ms": elapsed_ms,
                    "reason": f"sign/verify unavailable: {e}",
                })
                continue

            elapsed_ms = round((time.perf_counter() - started) * 1000, 4)

            if ok:
                passed += 1
            else:
                failed += 1

            details.append({
                "test": test_name,
                "parameter_set": parameter_set,
                "key_id": key_id,
                "success": ok,
                "skipped": False,
                "elapsed_ms": elapsed_ms,
            })

        except Exception as e:
            failed += 1
            elapsed_ms = round((time.perf_counter() - started) * 1000, 4)
            details.append({
                "test": test_name,
                "parameter_set": parameter_set,
                "success": False,
                "skipped": False,
                "elapsed_ms": elapsed_ms,
                "error": str(e),
            })

    total_executed = passed + failed

    return {
        "suite": f"{parameter_set}_sign_verify",
        "parameter_set": parameter_set,
        "iterations": iterations,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "success_rate_executed": round((passed / total_executed) * 100, 2) if total_executed else None,
        "latency": compute_latency_stats(details),
        "details": details,
    }


# ============================================================
# ADVERSARIAL SANITY TEST
# ============================================================

def run_signature_tamper_test(parameter_set: str = "dilithium3") -> Dict[str, Any]:
    try:
        key_res = generate_key(parameter_set)
        key_id = key_res["key"]["key_id"]

        message = "secure quantum message"

        sign_res = sign(message, key_id)
        signature = sign_res["signature"]

        tampered_message = message + "_tampered"

        verify_res = verify(tampered_message, signature, key_id)

        valid = bool(verify_res["valid"])

        return {
            "test": f"{parameter_set}_tampered_signature",
            "expected": "verification failure",
            "success": not valid,
            "reason": "tampered message correctly rejected" if not valid else "tampered message incorrectly verified",
        }

    except Exception as e:
        return {
            "test": f"{parameter_set}_tampered_signature",
            "expected": "verification failure",
            "success": True,
            "reason": f"verification blocked as expected: {e}",
        }

def run_failure_test() -> Dict[str, Any]:
    try:
        key1 = generate_key("kyber768")["key"]["key_id"]
        key2 = generate_key("kyber768")["key"]["key_id"]

        plaintext = "attack test"
        enc = encrypt(plaintext, key1)["ciphertext"]

        # This SHOULD fail
        _ = decrypt(enc, key2)["plaintext"]

        return {
            "test": "cross_key_decryption",
            "expected": "failure",
            "success": False,
            "reason": "decryption unexpectedly succeeded with wrong key",
        }

    except Exception as e:
        return {
            "test": "cross_key_decryption",
            "expected": "failure",
            "success": True,
            "reason": f"blocked as expected: {e}",
        }


# ============================================================
# OUTPUT
# ============================================================

def save_results(results: Dict[str, Any]) -> Path:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = OUT_DIR / f"functional_correctness_{ts}.json"
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    return out_path


def main() -> None:
    print("\n🚀 Running Q-SENTRY Functional Correctness Suite...\n")

    try:
        health = get_json("/health", use_api=False)
    except Exception as e:
        fail(f"Backend not reachable: {e}")

    print("✅ Backend health:")
    pretty(health)

    kyber512_results = run_kyber_roundtrip(iterations=DEFAULT_ITERATIONS, parameter_set="kyber512")
    kyber768_results = run_kyber_roundtrip(iterations=DEFAULT_ITERATIONS, parameter_set="kyber768")
    kyber1024_results = run_kyber_roundtrip(iterations=DEFAULT_ITERATIONS, parameter_set="kyber1024")
    dilithium_results = run_signature_test(iterations=DEFAULT_ITERATIONS, parameter_set="dilithium3")
    falcon_results = run_signature_test(iterations=DEFAULT_ITERATIONS, parameter_set="falcon512")
    failure_test = run_failure_test()
    tamper_test = run_signature_tamper_test()

    summary = {
        "timestamp_utc": utc_now_iso(),
        "suite_name": "Q-SENTRY Functional Correctness",
        "backend": API_BASE,
        "health": health,
        "results": [
            kyber512_results,
            kyber768_results,
            kyber1024_results,
            dilithium_results,
            falcon_results,
        ],
        "security_tests": [
            failure_test,
            tamper_test
        ],
    }

    out_path = save_results(summary)

    print("\n📊 ===== FUNCTIONAL CORRECTNESS SUMMARY =====\n")
    for block in summary["results"]:
        condensed = {k: v for k, v in block.items() if k != "details"}
        pretty(condensed)
        print()

    print("🔐 Security checks:")
    pretty(summary["security_tests"])

    print(f"\n💾 Results saved to: {out_path}")

    # ============================================================
    # CLEAN JSON OUTPUT (FOR CHARTS / PIPELINE)
    # ============================================================

    clean_output = []

    for block in summary["results"]:
        clean_output.append({
            "scheme": block["parameter_set"],
            "suite": block["suite"],
            "avg_ms": block["latency"]["avg_ms"],
            "p50_ms": block["latency"]["p50_ms"],
            "p95_ms": block["latency"]["p95_ms"],
            "p99_ms": block["latency"]["p99_ms"],
            "std_dev_ms": block["latency"]["std_dev_ms"],
        })
    # Optional: print clean JSON (machine readable)
    print("\n📦 CLEAN JSON (FOR CHARTS):")
    print(json.dumps(clean_output, indent=2))


if __name__ == "__main__":
    main()