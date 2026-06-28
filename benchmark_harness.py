#!/usr/bin/env python3
"""
Q-SENTRY Benchmark Harness
===========================
NeurIPS-style experimental evaluation for the Q-SENTRY paper.

Measures:
  - Cryptographic primitive throughput (ops/sec)
  - P50, P95, P99, P99.9 latency per operation
  - Governance layer overhead (policy check, simulation)
  - Key generation cost per algorithm
  - Algorithm comparison across all PQC families

Output:
  - results/results.json   — raw data
  - results/results.md     — markdown tables
  - results/tables.tex     — LaTeX tables for paper

Usage:
  python3 benchmark_harness.py
  python3 benchmark_harness.py --quick          # 50 iterations (fast check)
  python3 benchmark_harness.py --iterations 1000 --output paper_results/
  python3 benchmark_harness.py --kem-only
  python3 benchmark_harness.py --sig-only
"""

from __future__ import annotations

import argparse
import json
import platform
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import requests

# ============================================================
# Defaults
# ============================================================

DEFAULT_HOST       = "http://localhost:8008"
DEFAULT_ITERATIONS = 500
DEFAULT_WARMUP     = 20
DEFAULT_OUTPUT     = "results"
TIMEOUT            = 60

# ============================================================
# Data models
# ============================================================

@dataclass
class LatencyStats:
    operation:          str
    algorithm:          str
    parameter_set:      str
    n:                  int
    mean_ms:            float
    median_ms:          float
    p95_ms:             float
    p99_ms:             float
    p999_ms:            float
    min_ms:             float
    max_ms:             float
    stddev_ms:          float
    throughput_ops_sec: float
    backend:            str = "python"
    error_count:        int = 0

    def to_row(self) -> List[str]:
        return [
            self.algorithm,
            self.parameter_set,
            self.operation,
            f"{self.throughput_ops_sec:,.0f}",
            f"{self.mean_ms:.3f}",
            f"{self.median_ms:.3f}",
            f"{self.p95_ms:.3f}",
            f"{self.p99_ms:.3f}",
            f"{self.p999_ms:.3f}",
            self.backend,
        ]

# ============================================================
# HTTP client
# ============================================================

class Client:
    def __init__(self, host: str):
        self.host = host.rstrip("/")
        self.s = requests.Session()
        self.s.headers["Content-Type"] = "application/json"

    def post(self, path, body): return self.s.post(f"{self.host}{path}", json=body, timeout=TIMEOUT).json()
    def get(self, path):        return self.s.get(f"{self.host}{path}", timeout=TIMEOUT).json()

    def health(self):
        try: self.get("/health"); return True
        except: return False

    def keygen(self, alg, param):          return self.post("/api/keygen", {"algorithm": alg, "parameter_set": param})
    def encrypt(self, kid, pt):            return self.post("/api/encrypt", {"key_id": kid, "plaintext": pt})
    def decrypt(self, kid, ct):            return self.post("/api/decrypt", {"key_id": kid, "ciphertext": ct})
    def sign(self, kid, msg):              return self.post("/api/sign",    {"key_id": kid, "message": msg})
    def verify(self, kid, msg, sig):       return self.post("/api/verify",  {"key_id": kid, "message": msg, "signature": sig})
    def policy_check(self, alg, param):    return self.get(f"/api/policy/check?scheme={alg}&parameter_set={param}&longevity=30")
    def simulate(self, kid):               return self.get(f"/api/keys/{kid}/simulation?horizon_years=50&safety_margin_years=10")
    def supported(self):                   return self.get("/api/algorithms/supported")

# ============================================================
# Timing core
# ============================================================

def measure(fn: Callable, n: int, warmup: int, label: str) -> Tuple[List[float], int]:
    errors = 0
    print(f"  [{label}] warmup={warmup} ", end="", flush=True)
    for _ in range(warmup):
        try: fn()
        except: pass
    print(f"run={n} ", end="", flush=True)
    latencies = []
    for i in range(n):
        try:
            t0 = time.perf_counter()
            fn()
            latencies.append((time.perf_counter() - t0) * 1000)
        except Exception as e:
            errors += 1
        if (i+1) % 100 == 0: print(f"{i+1}.", end="", flush=True)
    print(f" ✓ (errors={errors})")
    return latencies, errors


def stats(latencies: List[float], op: str, alg: str, param: str, errors: int, backend: str = "python") -> LatencyStats:
    if not latencies:
        return LatencyStats(op, alg, param, 0, 0,0,0,0,0,0,0,0,0, backend, errors)
    s = sorted(latencies)
    n = len(s)
    def pct(p):
        i = (p/100)*(n-1); lo,hi = int(i), min(int(i)+1,n-1)
        return s[lo] + (i-lo)*(s[hi]-s[lo])
    mean = statistics.mean(latencies)
    return LatencyStats(
        operation=op, algorithm=alg, parameter_set=param, n=n,
        mean_ms=round(mean,4), median_ms=round(pct(50),4),
        p95_ms=round(pct(95),4), p99_ms=round(pct(99),4),
        p999_ms=round(pct(99.9),4),
        min_ms=round(s[0],4), max_ms=round(s[-1],4),
        stddev_ms=round(statistics.stdev(latencies) if n>1 else 0,4),
        throughput_ops_sec=round(1000/mean if mean>0 else 0,1),
        backend=backend, error_count=errors,
    )

# ============================================================
# Benchmark configurations
# ============================================================

KEM_CONFIGS = [
    ("kyber",    "kyber512"),
    ("kyber",    "kyber768"),
    ("kyber",    "kyber1024"),
    ("frodokem", "frodokem-640-aes"),
    ("frodokem", "frodokem-976-aes"),
    ("frodokem", "frodokem-1344-aes"),
]

SIG_CONFIGS = [
    ("dilithium", "dilithium2"),
    ("dilithium", "dilithium3"),
    ("dilithium", "dilithium5"),
    ("falcon",    "falcon512"),
    ("falcon",    "falcon1024"),
    ("falcon",    "falcon-padded-512"),
    ("sphincs",   "sphincs-sha2-128f"),
    ("sphincs",   "sphincs-sha2-128s"),
    ("sphincs",   "sphincs-shake-128f"),
]

# ============================================================
# Runner
# ============================================================

class Runner:
    def __init__(self, client: Client, n: int, warmup: int):
        self.c = client; self.n = n; self.warmup = warmup
        self._keys: Dict[str,dict] = {}

    def key(self, alg, param):
        k = f"{alg}/{param}"
        if k not in self._keys:
            print(f"  → keygen {alg}/{param}...")
            self._keys[k] = self.c.keygen(alg, param)["key"]
        return self._keys[k]

    def bench_keygen(self, alg, param):
        n = min(self.n, 50)
        lats, errs = measure(lambda: self.c.keygen(alg, param), n, min(self.warmup,3), f"keygen/{param}")
        return stats(lats, "keygen", alg, param, errs)

    def bench_kem(self, alg, param):
        kid = self.key(alg, param)["key_id"]
        pt  = "Q-SENTRY benchmark 2026"
        results = []

        # encrypt
        lats, errs = measure(lambda: self.c.encrypt(kid, pt), self.n, self.warmup, f"encrypt/{param}")
        enc_res = self.c.encrypt(kid, pt)
        be = enc_res.get("crypto_backend","python")
        results.append(stats(lats, "encrypt", alg, param, errs, be))

        # decrypt — reuse fixed ciphertext
        ct = enc_res["ciphertext"]
        lats, errs = measure(lambda: self.c.decrypt(kid, ct), self.n, self.warmup, f"decrypt/{param}")
        results.append(stats(lats, "decrypt", alg, param, errs, be))
        return results

    def bench_sig(self, alg, param):
        kid = self.key(alg, param)["key_id"]
        msg = "Q-SENTRY benchmark signing message 2026"
        # SPHINCS+ is slow — cap at 100
        n = min(self.n, 100) if "sphincs" in param else self.n
        results = []

        lats, errs = measure(lambda: self.c.sign(kid, msg), n, min(self.warmup,5), f"sign/{param}")
        sign_res = self.c.sign(kid, msg)
        be  = sign_res.get("crypto_backend","python")
        sig = sign_res["signature"]
        results.append(stats(lats, "sign", alg, param, errs, be))

        lats, errs = measure(lambda: self.c.verify(kid, msg, sig), n, min(self.warmup,5), f"verify/{param}")
        results.append(stats(lats, "verify", alg, param, errs, be))
        return results

    def bench_policy(self, alg, param):
        lats, errs = measure(lambda: self.c.policy_check(alg, param), self.n, self.warmup, f"policy/{param}")
        return stats(lats, "policy_check", alg, param, errs)

    def bench_simulate(self, alg, param):
        kid = self.key(alg, param)["key_id"]
        n = min(self.n, 100)
        lats, errs = measure(lambda: self.c.simulate(kid), n, min(self.warmup,5), f"simulate/{param}")
        return stats(lats, "simulate", alg, param, errs)

    def run(self, kem=True, sig=True):
        results = []

        if kem:
            print("\n" + "="*60)
            print("  KEM BENCHMARKS")
            print("="*60)
            for alg, param in KEM_CONFIGS:
                print(f"\n── {alg}/{param} ──")
                try:
                    results.append(self.bench_keygen(alg, param))
                    results.extend(self.bench_kem(alg, param))
                except Exception as e:
                    print(f"  SKIP: {e}")

        if sig:
            print("\n" + "="*60)
            print("  SIGNATURE BENCHMARKS")
            print("="*60)
            for alg, param in SIG_CONFIGS:
                print(f"\n── {alg}/{param} ──")
                try:
                    results.append(self.bench_keygen(alg, param))
                    results.extend(self.bench_sig(alg, param))
                except Exception as e:
                    print(f"  SKIP: {e}")

        print("\n" + "="*60)
        print("  GOVERNANCE BENCHMARKS")
        print("="*60)
        for alg, param in [("kyber","kyber768"), ("dilithium","dilithium3"), ("sphincs","sphincs-sha2-128f")]:
            print(f"\n── policy_check/{param} ──")
            try: results.append(self.bench_policy(alg, param))
            except Exception as e: print(f"  SKIP: {e}")

        for alg, param in [("kyber","kyber768"), ("dilithium","dilithium3")]:
            print(f"\n── simulate/{param} ──")
            try: results.append(self.bench_simulate(alg, param))
            except Exception as e: print(f"  SKIP: {e}")

        return results

# ============================================================
# Formatters
# ============================================================

def ascii_table(results: List[LatencyStats], title: str, ops: List[str]) -> str:
    rows = [r for r in results if r.operation in ops]
    if not rows: return ""
    cols = ["Algorithm","Params","Op","Ops/sec","Mean","P50","P95","P99","P99.9","Backend"]
    data = [r.to_row() for r in rows]
    w = [max(len(cols[i]), max(len(d[i]) for d in data)) for i in range(len(cols))]
    sep = "+" + "+".join("-"*(wi+2) for wi in w) + "+"
    hdr = "|" + "|".join(f" {cols[i]:<{w[i]}} " for i in range(len(cols))) + "|"
    out = [f"\n{title}", sep, hdr, sep]
    for d in data:
        out.append("|" + "|".join(f" {d[i]:<{w[i]}} " for i in range(len(cols))) + "|")
    out.append(sep)
    return "\n".join(out)


def latex_table(results: List[LatencyStats], caption: str, label: str, ops: List[str]) -> str:
    rows = [r for r in results if r.operation in ops]
    if not rows: return ""
    lines = [
        r"\begin{table}[t]", r"\centering",
        r"\caption{" + caption + r"}",
        r"\label{" + label + r"}",
        r"\begin{tabular}{llrrrrrr}", r"\toprule",
        r"Algorithm & Params & Ops/s & Mean(ms) & P50(ms) & P95(ms) & P99(ms) & P99.9(ms) \\",
        r"\midrule",
    ]
    prev = None
    for r in rows:
        if prev and r.algorithm != prev: lines.append(r"\midrule")
        prev = r.algorithm
        lines.append(f"{r.algorithm} & {r.parameter_set} & {r.throughput_ops_sec:,.0f} & "
                     f"{r.mean_ms:.3f} & {r.median_ms:.3f} & {r.p95_ms:.3f} & "
                     f"{r.p99_ms:.3f} & {r.p999_ms:.3f} \\\\")
    lines += [r"\bottomrule", r"\end{tabular}", r"\end{table}"]
    return "\n".join(lines)


def markdown(results: List[LatencyStats], platform_info: str) -> str:
    groups: Dict[str, List[LatencyStats]] = {}
    for r in results:
        groups.setdefault(r.operation, []).append(r)
    lines = [
        "# Q-SENTRY Benchmark Results\n",
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}  ",
        f"**Platform:** {platform_info}\n",
    ]
    for op, rlist in groups.items():
        lines += [f"\n## {op.upper()}\n",
                  "| Algorithm | Params | Ops/sec | Mean(ms) | P95(ms) | P99(ms) | Backend |",
                  "|---|---|---:|---:|---:|---:|---|"]
        for r in rlist:
            lines.append(f"| {r.algorithm} | {r.parameter_set} | {r.throughput_ops_sec:,.0f} | "
                         f"{r.mean_ms:.3f} | {r.p95_ms:.3f} | {r.p99_ms:.3f} | {r.backend} |")
    return "\n".join(lines)

# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Q-SENTRY NeurIPS Benchmark Harness")
    parser.add_argument("--host",       default=DEFAULT_HOST)
    parser.add_argument("--iterations", default=DEFAULT_ITERATIONS, type=int)
    parser.add_argument("--warmup",     default=DEFAULT_WARMUP,     type=int)
    parser.add_argument("--output",     default=DEFAULT_OUTPUT)
    parser.add_argument("--quick",      action="store_true", help="50 iterations (fast check)")
    parser.add_argument("--kem-only",   action="store_true")
    parser.add_argument("--sig-only",   action="store_true")
    args = parser.parse_args()

    if args.quick:
        args.iterations = 50
        args.warmup     = 5

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    print("="*60)
    print("  Q-SENTRY Benchmark Harness — NeurIPS Edition")
    print("="*60)

    client = Client(args.host)
    if not client.health():
        print(f"ERROR: backend unreachable at {args.host}")
        sys.exit(1)

    try:
        sup = client.supported()
        liboqs_ver = sup.get("liboqs_version","unknown")
        kem_n = len(sup.get("kem",[]))
        sig_n = len(sup.get("signature",[]))
    except Exception:
        liboqs_ver = "unknown"; kem_n = sig_n = 0

    platform_info = (f"{platform.system()} {platform.machine()} | "
                     f"Python {platform.python_version()} | "
                     f"liboqs {liboqs_ver} | "
                     f"KEM={kem_n} SIG={sig_n}")

    print(f"\nPlatform: {platform_info}")
    print(f"Config: iterations={args.iterations} warmup={args.warmup}")
    print(f"Output: {out.resolve()}\n")

    runner = Runner(client, args.iterations, args.warmup)
    results = runner.run(
        kem=not args.sig_only,
        sig=not args.kem_only,
    )

    # Print ASCII tables
    print("\n" + "="*60 + "\n  RESULTS\n" + "="*60)
    for title, ops in [
        ("Table I — KEM Throughput & Latency",      ["encrypt","decrypt"]),
        ("Table II — Signature Throughput & Latency",["sign","verify"]),
        ("Table III — Key Generation",              ["keygen"]),
        ("Table IV — Governance Layer",             ["policy_check","simulate"]),
    ]:
        t = ascii_table(results, title, ops)
        if t: print(t)

    # Save JSON
    jp = out / "results.json"
    with open(jp, "w") as f:
        json.dump({
            "meta": {
                "host": args.host, "iterations": args.iterations,
                "warmup": args.warmup, "platform": platform_info,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            "results": [asdict(r) for r in results],
        }, f, indent=2)
    print(f"\nJSON     → {jp}")

    # Save Markdown
    mp = out / "results.md"
    mp.write_text(markdown(results, platform_info))
    print(f"Markdown → {mp}")

    # Save LaTeX
    lp = out / "tables.tex"
    lp.write_text("\n\n".join(filter(bool, [
        f"% Q-SENTRY Benchmark Tables — {platform_info}",
        latex_table(results, "KEM Operation Latency and Throughput", "tab:kem", ["encrypt","decrypt"]),
        latex_table(results, "Signature Operation Latency and Throughput", "tab:sig", ["sign","verify"]),
        latex_table(results, "Key Generation Latency and Throughput", "tab:keygen", ["keygen"]),
        latex_table(results, "Governance Layer Overhead", "tab:gov", ["policy_check","simulate"]),
    ])))
    print(f"LaTeX    → {lp}")

    total_errors = sum(r.error_count for r in results)
    print(f"\n{'='*60}")
    print(f"  Complete: {len(results)} series | Errors: {total_errors}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()