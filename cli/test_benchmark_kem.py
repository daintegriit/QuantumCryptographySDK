#!/usr/bin/env python3
"""
Q-SENTRY ELITE PQC BENCHMARK (FINAL)

Covers:
- KEM: Kyber512 / 768 / 1024
- Signatures: ML-DSA (Dilithium) + Falcon

Metrics:
- avg / p50 / p95 / p99 latency
- std deviation
- throughput (ops/sec)
- success rate

Poster-ready output
"""

import time
import statistics
import json
from datetime import datetime

import oqs


# ============================================================
# CONFIG
# ============================================================

KEM_SCHEMES = ["Kyber512", "Kyber768", "Kyber1024"]

SIG_SCHEMES = [
    "ML-DSA-44",
    "ML-DSA-65",   # Dilithium3 equivalent ✅
    "ML-DSA-87",
    "Falcon-512"
]

ITERATIONS = 500


# ============================================================
# HELPERS
# ============================================================

def percentile(data, p):
    if not data:
        return None
    data_sorted = sorted(data)
    idx = min(int(len(data_sorted) * p / 100), len(data_sorted) - 1)
    return data_sorted[idx]


def ms(x):
    return round(x * 1000, 4) if x is not None else None


def safe_stats(times):
    if not times:
        return {
            "avg_ms": None,
            "p50_ms": None,
            "p95_ms": None,
            "p99_ms": None,
            "std_ms": None,
            "ops_per_sec": None
        }

    total = sum(times)
    n = len(times)

    return {
        "avg_ms": ms(statistics.mean(times)),
        "p50_ms": ms(percentile(times, 50)),
        "p95_ms": ms(percentile(times, 95)),
        "p99_ms": ms(percentile(times, 99)),
        "std_ms": ms(statistics.stdev(times)) if n > 1 else 0,
        "ops_per_sec": round(n / total, 2) if total > 0 else None,
    }


# ============================================================
# KEM BENCHMARK
# ============================================================

def run_kem():
    print("\n🚀 Running KEM Benchmark...\n")

    results = []

    for scheme in KEM_SCHEMES:
        print(f"🔹 {scheme}")

        times = []
        failures = 0

        for _ in range(ITERATIONS):
            try:
                t0 = time.perf_counter()

                kem = oqs.KeyEncapsulation(scheme)
                pk = kem.generate_keypair()
                ct, ss1 = kem.encap_secret(pk)
                ss2 = kem.decap_secret(ct)

                t1 = time.perf_counter()

                if ss1 != ss2:
                    failures += 1
                else:
                    times.append(t1 - t0)

            except Exception:
                failures += 1

        stats = safe_stats(times)

        results.append({
            "type": "KEM",
            "scheme": scheme,
            "iterations": ITERATIONS,
            "success_rate": round((ITERATIONS - failures) / ITERATIONS * 100, 2),
            "failures": failures,
            **stats
        })

    return results


# ============================================================
# SIGNATURE BENCHMARK
# ============================================================

def run_signature():
    print("\n✍️ Running Signature Benchmark...\n")

    results = []

    available = set(oqs.get_enabled_sig_mechanisms())

    for scheme in SIG_SCHEMES:
        print(f"🔹 {scheme}")

        if scheme not in available:
            print(f"⚠️ Skipping {scheme} (not supported)")
            results.append({
                "type": "SIGNATURE",
                "scheme": scheme,
                "skipped": True
            })
            continue

        times = []
        failures = 0

        for _ in range(ITERATIONS):
            try:
                t0 = time.perf_counter()

                sig = oqs.Signature(scheme)
                pk = sig.generate_keypair()

                message = b"quantum test"
                signature = sig.sign(message)
                valid = sig.verify(message, signature, pk)

                t1 = time.perf_counter()

                if not valid:
                    failures += 1
                else:
                    times.append(t1 - t0)

            except Exception:
                failures += 1

        stats = safe_stats(times)

        results.append({
            "type": "SIGNATURE",
            "scheme": scheme,
            "iterations": ITERATIONS,
            "success_rate": round((ITERATIONS - failures) / ITERATIONS * 100, 2),
            "failures": failures,
            **stats
        })

    return results


# ============================================================
# MAIN
# ============================================================

def run_all():
    kem = run_kem()
    sig = run_signature()
    return kem + sig


def save(results):
    name = f"benchmark_full_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(name, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n💾 Saved → {name}")


def print_results(results):
    print("\n📊 ===== RESULTS =====\n")
    for r in results:
        print(json.dumps(r, indent=2))
        print()


if __name__ == "__main__":
    results = run_all()
    print_results(results)
    save(results)