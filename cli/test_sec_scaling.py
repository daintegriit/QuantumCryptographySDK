#!/usr/bin/env python3
"""
Q-SENTRY ELITE SECURITY SCALING TEST (FINAL)

Covers:
- Kyber512 / 768 / 1024 (KEM scaling)
- ML-DSA-44 / 65 / 87 (Dilithium scaling)
- Falcon-512 (comparison)

Metrics:
- avg / p95 / p99 latency
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
    "ML-DSA-44",   # Dilithium2
    "ML-DSA-65",   # Dilithium3 ✅
    "ML-DSA-87",   # Dilithium5
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


def ops_per_sec(total_time, n):
    if total_time == 0:
        return None
    return round(n / total_time, 2)


def safe_stats(times):
    if not times:
        return {
            "avg_ms": None,
            "p95_ms": None,
            "p99_ms": None,
            "std_ms": None,
            "ops_per_sec": None
        }

    total = sum(times)

    return {
        "avg_ms": ms(statistics.mean(times)),
        "p95_ms": ms(percentile(times, 95)),
        "p99_ms": ms(percentile(times, 99)),
        "std_ms": ms(statistics.stdev(times)) if len(times) > 1 else 0,
        "ops_per_sec": ops_per_sec(total, len(times)),
    }


def kem_security_level(scheme):
    if "512" in scheme:
        return "L1"
    if "768" in scheme:
        return "L3"
    if "1024" in scheme:
        return "L5"
    return "unknown"


def sig_security_level(scheme):
    if "44" in scheme:
        return "L1"
    if "65" in scheme:
        return "L3"
    if "87" in scheme:
        return "L5"
    if "Falcon" in scheme:
        return "L1/L5 hybrid"
    return "unknown"


# ============================================================
# KEM SCALING
# ============================================================

def run_kem():
    results = []

    for scheme in KEM_SCHEMES:
        print(f"🔹 KEM → {scheme}")

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

                times.append(t1 - t0)

            except Exception:
                failures += 1

        stats = safe_stats(times)

        results.append({
            "type": "KEM",
            "scheme": scheme,
            "security_level": kem_security_level(scheme),
            "iterations": ITERATIONS,
            "success_rate": round((ITERATIONS - failures) / ITERATIONS * 100, 2),
            **stats
        })

    return results


# ============================================================
# SIGNATURE SCALING
# ============================================================

def run_signature():
    results = []

    available = set(oqs.get_enabled_sig_mechanisms())

    for scheme in SIG_SCHEMES:
        print(f"🔹 SIG → {scheme}")

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

                msg = b"quantum scaling test"
                signature = sig.sign(msg)
                valid = sig.verify(msg, signature, pk)

                t1 = time.perf_counter()

                if not valid:
                    failures += 1

                times.append(t1 - t0)

            except Exception:
                failures += 1

        stats = safe_stats(times)

        results.append({
            "type": "SIGNATURE",
            "scheme": scheme,
            "security_level": sig_security_level(scheme),
            "iterations": ITERATIONS,
            "success_rate": round((ITERATIONS - failures) / ITERATIONS * 100, 2),
            **stats
        })

    return results


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("\n📈 Running Q-SENTRY ELITE Security Scaling Test...\n")

    kem_results = run_kem()
    sig_results = run_signature()

    results = kem_results + sig_results

    print("\n📊 ===== FINAL RESULTS =====\n")
    print(json.dumps(results, indent=2))

    filename = f"security_scaling_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n💾 Saved → {filename}")