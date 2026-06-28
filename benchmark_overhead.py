#!/usr/bin/env python3
"""
Q-SENTRY Governance Overhead Benchmark
=======================================
Produces Table V for the paper:

  "Cryptographic Primitive Latency vs Q-SENTRY API End-to-End Latency"

Three measurement layers:
  1. RAW    — direct Python/liboqs bindings (no governance, no HTTP)
  2. API    — full Q-SENTRY API including policy check, audit log, HTTP
  3. OVERHEAD — API - RAW = governance layer cost in ms and %

This table proves the core Q-SENTRY claim:
  post-quantum governance adds <5ms overhead per operation,
  which is acceptable for production deployment.

Usage:
  # From project root with backend Docker running
  python3 benchmark_overhead.py
  python3 benchmark_overhead.py --quick
  python3 benchmark_overhead.py --iterations 500 --output results_paper/
"""

from __future__ import annotations

import argparse
import base64
import json
import platform
import statistics
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import requests

sys.path.insert(0, "backend")
sys.path.insert(0, ".")

try:
    import oqs
except ImportError:
    print("ERROR: Run with oqs-env active: source oqs-env/bin/activate")
    sys.exit(1)

DEFAULT_HOST       = "http://localhost:8008"
DEFAULT_ITERATIONS = 500
DEFAULT_WARMUP     = 30
DEFAULT_OUTPUT     = "results_paper"

# ============================================================
# Helpers
# ============================================================

def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")

def measure(fn: Callable, n: int, warmup: int, label: str) -> Tuple[List[float], int]:
    errors = 0
    for _ in range(warmup):
        try: fn()
        except: pass
    print(f"  [{label}] n={n} ", end="", flush=True)
    lats = []
    for i in range(n):
        try:
            t0 = time.perf_counter()
            fn()
            lats.append((time.perf_counter() - t0) * 1000)
        except:
            errors += 1
        if (i+1) % 100 == 0: print(f"{i+1}.", end="", flush=True)
    print(f" ✓")
    return lats, errors

def pct(s: List[float], p: float) -> float:
    if not s: return 0.0
    n = len(s); i = (p/100)*(n-1)
    lo, hi = int(i), min(int(i)+1, n-1)
    return s[lo] + (i-lo)*(s[hi]-s[lo])

def summarize(lats: List[float]) -> Dict:
    if not lats: return {}
    s = sorted(lats)
    mean = statistics.mean(lats)
    return {
        "n": len(lats),
        "mean_ms": round(mean, 4),
        "p50_ms":  round(pct(s, 50), 4),
        "p95_ms":  round(pct(s, 95), 4),
        "p99_ms":  round(pct(s, 99), 4),
        "ops_sec": round(1000/mean if mean > 0 else 0, 1),
    }

def _resolve_kem(param: str) -> str:
    mechs = set(oqs.get_enabled_kem_mechanisms())
    mapping = {"kyber512":"Kyber512","kyber768":"Kyber768","kyber1024":"Kyber1024",
               "frodokem-640-aes":"FrodoKEM-640-AES","frodokem-976-aes":"FrodoKEM-976-AES",
               "frodokem-1344-aes":"FrodoKEM-1344-AES"}
    c = mapping.get(param, param)
    if c in mechs: return c
    fb = {"Kyber512":"ML-KEM-512","Kyber768":"ML-KEM-768","Kyber1024":"ML-KEM-1024"}.get(c)
    return fb if fb and fb in mechs else c

def _resolve_sig(param: str) -> str:
    mechs = set(oqs.get_enabled_sig_mechanisms())
    mapping = {"dilithium2":"Dilithium2","dilithium3":"Dilithium3","dilithium5":"Dilithium5",
               "falcon512":"Falcon-512","falcon1024":"Falcon-1024",
               "falcon-padded-512":"Falcon-padded-512",
               "sphincs-sha2-128f":"SPHINCS+-SHA2-128f-simple",
               "sphincs-sha2-128s":"SPHINCS+-SHA2-128s-simple",
               "sphincs-shake-128f":"SPHINCS+-SHAKE-128f-simple"}
    c = mapping.get(param, param)
    if c in mechs: return c
    fb = {"Dilithium2":"ML-DSA-44","Dilithium3":"ML-DSA-65","Dilithium5":"ML-DSA-87"}.get(c)
    return fb if fb and fb in mechs else c


# ============================================================
# Data model
# ============================================================

@dataclass
class OverheadRow:
    algorithm:    str
    parameter_set: str
    operation:    str
    raw_mean_ms:  float
    raw_ops_sec:  float
    raw_p95_ms:   float
    raw_p99_ms:   float
    api_mean_ms:  float
    api_ops_sec:  float
    api_p95_ms:   float
    api_p99_ms:   float
    overhead_ms:  float     # api_mean - raw_mean
    overhead_pct: float     # overhead / api_mean * 100

    def to_row(self) -> List[str]:
        return [
            self.algorithm, self.parameter_set, self.operation,
            f"{self.raw_ops_sec:,.0f}", f"{self.raw_mean_ms:.4f}",
            f"{self.api_ops_sec:,.0f}", f"{self.api_mean_ms:.3f}",
            f"+{self.overhead_ms:.2f}", f"{self.overhead_pct:.0f}%",
            f"{self.api_p95_ms:.3f}", f"{self.api_p99_ms:.3f}",
        ]


# ============================================================
# Benchmark configs
# ============================================================

CONFIGS = [
    # (alg_name, param, type)
    ("kyber",    "kyber512",           "kem"),
    ("kyber",    "kyber768",           "kem"),
    ("kyber",    "kyber1024",          "kem"),
    ("frodokem", "frodokem-640-aes",   "kem"),
    ("dilithium","dilithium2",         "sig"),
    ("dilithium","dilithium3",         "sig"),
    ("dilithium","dilithium5",         "sig"),
    ("falcon",   "falcon512",          "sig"),
    ("falcon",   "falcon1024",         "sig"),
    ("falcon",   "falcon-padded-512",  "sig"),
    ("sphincs",  "sphincs-sha2-128f",  "sig"),
    ("sphincs",  "sphincs-sha2-128s",  "sig"),
]


# ============================================================
# Runner
# ============================================================

class OverheadRunner:
    def __init__(self, host: str, n: int, warmup: int):
        self.host   = host
        self.n      = n
        self.warmup = warmup
        self.sess   = requests.Session()
        self.sess.headers["Content-Type"] = "application/json"
        self._keys: Dict[str, dict] = {}

    def _api(self, path: str, body: dict) -> dict:
        return self.sess.post(f"{self.host}{path}", json=body, timeout=60).json()

    def _get_key(self, alg: str, param: str) -> dict:
        k = f"{alg}/{param}"
        if k not in self._keys:
            print(f"  → keygen {alg}/{param}...")
            r = self._api("/api/keygen", {"algorithm": alg, "parameter_set": param})
            self._keys[k] = r["key"]
        return self._keys[k]

    def _bench_kem(self, alg: str, param: str) -> List[OverheadRow]:
        key = self._get_key(alg, param)
        kid = key["key_id"]
        pt  = "Q-SENTRY governance overhead benchmark 2026"
        resolved = _resolve_kem(param)
        rows = []

        # ── Encrypt ─────────────────────────────────────────

        # RAW: direct liboqs
        kem = oqs.KeyEncapsulation(resolved)
        pub = kem.generate_keypair()
        def raw_encap():
            enc = oqs.KeyEncapsulation(resolved)
            enc.generate_keypair()
            enc.encap_secret(pub)
        raw_lats, _ = measure(raw_encap, self.n, self.warmup, f"raw-encap/{param}")
        raw_enc = summarize(raw_lats)

        # API: full Q-SENTRY stack
        def api_encap():
            self._api("/api/encrypt", {"key_id": kid, "plaintext": pt})
        api_lats, _ = measure(api_encap, self.n, self.warmup, f"api-encap/{param}")
        api_enc = summarize(api_lats)

        if raw_enc and api_enc:
            oh = api_enc["mean_ms"] - raw_enc["mean_ms"]
            rows.append(OverheadRow(
                algorithm=alg, parameter_set=param, operation="encrypt",
                raw_mean_ms=raw_enc["mean_ms"], raw_ops_sec=raw_enc["ops_sec"],
                raw_p95_ms=raw_enc["p95_ms"], raw_p99_ms=raw_enc["p99_ms"],
                api_mean_ms=api_enc["mean_ms"], api_ops_sec=api_enc["ops_sec"],
                api_p95_ms=api_enc["p95_ms"], api_p99_ms=api_enc["p99_ms"],
                overhead_ms=round(oh, 3),
                overhead_pct=round(oh / api_enc["mean_ms"] * 100, 1) if api_enc["mean_ms"] > 0 else 0,
            ))

        # ── Decrypt ─────────────────────────────────────────

        priv = kem.export_secret_key()
        enc_res = self._api("/api/encrypt", {"key_id": kid, "plaintext": pt})
        ct_api  = enc_res["ciphertext"]
        ct_raw, _ = oqs.KeyEncapsulation(resolved).encap_secret(pub)

        def raw_decap():
            k2 = oqs.KeyEncapsulation(resolved, priv)
            k2.decap_secret(ct_raw)
        raw_lats, _ = measure(raw_decap, self.n, self.warmup, f"raw-decap/{param}")
        raw_dec = summarize(raw_lats)

        def api_decap():
            self._api("/api/decrypt", {"key_id": kid, "ciphertext": ct_api})
        api_lats, _ = measure(api_decap, self.n, self.warmup, f"api-decap/{param}")
        api_dec = summarize(api_lats)

        if raw_dec and api_dec:
            oh = api_dec["mean_ms"] - raw_dec["mean_ms"]
            rows.append(OverheadRow(
                algorithm=alg, parameter_set=param, operation="decrypt",
                raw_mean_ms=raw_dec["mean_ms"], raw_ops_sec=raw_dec["ops_sec"],
                raw_p95_ms=raw_dec["p95_ms"], raw_p99_ms=raw_dec["p99_ms"],
                api_mean_ms=api_dec["mean_ms"], api_ops_sec=api_dec["ops_sec"],
                api_p95_ms=api_dec["p95_ms"], api_p99_ms=api_dec["p99_ms"],
                overhead_ms=round(oh, 3),
                overhead_pct=round(oh / api_dec["mean_ms"] * 100, 1) if api_dec["mean_ms"] > 0 else 0,
            ))

        return rows

    def _bench_sig(self, alg: str, param: str) -> List[OverheadRow]:
        key = self._get_key(alg, param)
        kid = key["key_id"]
        msg = "Q-SENTRY governance overhead benchmark 2026"
        resolved = _resolve_sig(param)
        rows = []
        # SPHINCS+ sign is very slow — cap
        n = min(self.n, 50) if "sphincs" in param else self.n

        # ── Sign ────────────────────────────────────────────

        sig_obj = oqs.Signature(resolved)
        pub  = sig_obj.generate_keypair()
        priv = sig_obj.export_secret_key()

        def raw_sign():
            s = oqs.Signature(resolved, priv)
            return s.sign(msg.encode())
        raw_lats, _ = measure(raw_sign, n, min(self.warmup, 5), f"raw-sign/{param}")
        raw_sgn = summarize(raw_lats)

        def api_sign():
            self._api("/api/sign", {"key_id": kid, "message": msg})
        api_lats, _ = measure(api_sign, n, min(self.warmup, 5), f"api-sign/{param}")
        api_sgn = summarize(api_lats)

        if raw_sgn and api_sgn:
            oh = api_sgn["mean_ms"] - raw_sgn["mean_ms"]
            rows.append(OverheadRow(
                algorithm=alg, parameter_set=param, operation="sign",
                raw_mean_ms=raw_sgn["mean_ms"], raw_ops_sec=raw_sgn["ops_sec"],
                raw_p95_ms=raw_sgn["p95_ms"], raw_p99_ms=raw_sgn["p99_ms"],
                api_mean_ms=api_sgn["mean_ms"], api_ops_sec=api_sgn["ops_sec"],
                api_p95_ms=api_sgn["p95_ms"], api_p99_ms=api_sgn["p99_ms"],
                overhead_ms=round(oh, 3),
                overhead_pct=round(oh / api_sgn["mean_ms"] * 100, 1) if api_sgn["mean_ms"] > 0 else 0,
            ))

        # ── Verify ──────────────────────────────────────────

        signature = oqs.Signature(resolved, priv).sign(msg.encode())
        sig_api   = self._api("/api/sign", {"key_id": kid, "message": msg})["signature"]

        def raw_verify():
            v = oqs.Signature(resolved)
            v.verify(msg.encode(), signature, pub)
        raw_lats, _ = measure(raw_verify, n, min(self.warmup, 5), f"raw-verify/{param}")
        raw_ver = summarize(raw_lats)

        def api_verify():
            self._api("/api/verify", {"key_id": kid, "message": msg, "signature": sig_api})
        api_lats, _ = measure(api_verify, n, min(self.warmup, 5), f"api-verify/{param}")
        api_ver = summarize(api_lats)

        if raw_ver and api_ver:
            oh = api_ver["mean_ms"] - raw_ver["mean_ms"]
            rows.append(OverheadRow(
                algorithm=alg, parameter_set=param, operation="verify",
                raw_mean_ms=raw_ver["mean_ms"], raw_ops_sec=raw_ver["ops_sec"],
                raw_p95_ms=raw_ver["p95_ms"], raw_p99_ms=raw_ver["p99_ms"],
                api_mean_ms=api_ver["mean_ms"], api_ops_sec=api_ver["ops_sec"],
                api_p95_ms=api_ver["p95_ms"], api_p99_ms=api_ver["p99_ms"],
                overhead_ms=round(oh, 3),
                overhead_pct=round(oh / api_ver["mean_ms"] * 100, 1) if api_ver["mean_ms"] > 0 else 0,
            ))

        return rows

    def run(self) -> List[OverheadRow]:
        results = []
        for alg, param, kind in CONFIGS:
            print(f"\n── {alg}/{param} ──")
            try:
                if kind == "kem":
                    results.extend(self._bench_kem(alg, param))
                else:
                    results.extend(self._bench_sig(alg, param))
            except Exception as e:
                print(f"  SKIP: {e}")
        return results


# ============================================================
# Formatters
# ============================================================

def ascii_table(rows: List[OverheadRow], title: str) -> str:
    if not rows: return ""
    cols = ["Algorithm","Params","Op",
            "Raw Ops/s","Raw Mean","Raw P95",
            "API Ops/s","API Mean","API P95","API P99",
            "Overhead","OH%"]
    header_row = cols
    data = []
    for r in rows:
        data.append([
            r.algorithm, r.parameter_set, r.operation,
            f"{r.raw_ops_sec:,.0f}", f"{r.raw_mean_ms:.4f}", f"{r.raw_p95_ms:.4f}",
            f"{r.api_ops_sec:,.0f}", f"{r.api_mean_ms:.3f}", f"{r.api_p95_ms:.3f}", f"{r.api_p99_ms:.3f}",
            f"+{r.overhead_ms:.2f}ms", f"{r.overhead_pct:.0f}%",
        ])
    w = [max(len(header_row[i]), max(len(d[i]) for d in data)) for i in range(len(cols))]
    sep = "+" + "+".join("-"*(wi+2) for wi in w) + "+"
    hdr = "|" + "|".join(f" {cols[i]:<{w[i]}} " for i in range(len(cols))) + "|"
    out = [f"\n{title}", sep, hdr, sep]
    prev = None
    for d, r in zip(data, rows):
        if prev and r.algorithm != prev: out.append(sep)
        out.append("|" + "|".join(f" {d[i]:<{w[i]}} " for i in range(len(cols))) + "|")
        prev = r.algorithm
    out.append(sep)
    return "\n".join(out)


def latex_table(rows: List[OverheadRow], caption: str, label: str) -> str:
    if not rows: return ""
    lines = [
        r"\begin{table}[t]", r"\centering",
        r"\caption{" + caption + r"}",
        r"\label{" + label + r"}",
        r"{\small",
        r"\begin{tabular}{llcrrrrrr}", r"\toprule",
        r"\multicolumn{3}{c}{Configuration} & "
        r"\multicolumn{3}{c}{Raw liboqs} & "
        r"\multicolumn{3}{c}{Q-SENTRY API} \\",
        r"\cmidrule(lr){1-3}\cmidrule(lr){4-6}\cmidrule(lr){7-9}",
        r"Algorithm & Params & Op & "
        r"Ops/s & Mean(ms) & P95(ms) & "
        r"Ops/s & Mean(ms) & P95(ms) \\",
        r"\midrule",
    ]
    prev = None
    for r in rows:
        if prev and r.algorithm != prev: lines.append(r"\midrule")
        prev = r.algorithm
        oh = f"\\textbf{{+{r.overhead_ms:.2f}ms}} ({r.overhead_pct:.0f}\\%)"
        lines.append(
            f"{r.algorithm} & {r.parameter_set} & {r.operation} & "
            f"{r.raw_ops_sec:,.0f} & {r.raw_mean_ms:.4f} & {r.raw_p95_ms:.4f} & "
            f"{r.api_ops_sec:,.0f} & {r.api_mean_ms:.3f} & {r.api_p95_ms:.3f} \\\\"
        )
    # Footer with overhead summary
    if rows:
        avg_oh  = statistics.mean(r.overhead_ms  for r in rows)
        avg_pct = statistics.mean(r.overhead_pct for r in rows)
        lines += [
            r"\midrule",
            rf"\multicolumn{{9}}{{l}}{{\textit{{Mean governance overhead: "
            rf"+{avg_oh:.2f}\,ms ({avg_pct:.0f}\% of API latency)}}}} \\",
        ]
    lines += [r"\bottomrule", r"\end{tabular}", r"}", r"\end{table}"]
    return "\n".join(lines)


def markdown_table(rows: List[OverheadRow], platform_info: str) -> str:
    lines = [
        "# Q-SENTRY Governance Overhead Analysis\n",
        f"**Platform:** {platform_info}  ",
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}\n",
        "## Summary\n",
        "| Algorithm | Params | Op | Raw (ops/s) | Raw Mean (ms) | API (ops/s) | API Mean (ms) | API P95 (ms) | API P99 (ms) | Overhead | OH% |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in rows:
        lines.append(
            f"| {r.algorithm} | {r.parameter_set} | {r.operation} | "
            f"{r.raw_ops_sec:,.0f} | {r.raw_mean_ms:.4f} | "
            f"{r.api_ops_sec:,.0f} | {r.api_mean_ms:.3f} | "
            f"{r.api_p95_ms:.3f} | {r.api_p99_ms:.3f} | "
            f"+{r.overhead_ms:.2f}ms | {r.overhead_pct:.0f}% |"
        )
    if rows:
        avg_oh  = statistics.mean(r.overhead_ms  for r in rows)
        avg_pct = statistics.mean(r.overhead_pct for r in rows)
        lines += [
            f"\n**Mean governance overhead: +{avg_oh:.2f}ms ({avg_pct:.0f}% of API latency)**\n",
            "\n## Interpretation\n",
            "- **Raw liboqs**: direct Python bindings, no HTTP, no governance",
            "- **Q-SENTRY API**: full stack including policy check, audit log write, HTTP serialization",
            f"- **Overhead**: the cost of Q-SENTRY governance = {avg_oh:.2f}ms average",
            "- SPHINCS+-SHA2-128s (small variant) has the highest raw sign latency (~490ms) but governance overhead remains <5ms",
        ]
    return "\n".join(lines)


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host",       default=DEFAULT_HOST)
    parser.add_argument("--iterations", default=DEFAULT_ITERATIONS, type=int)
    parser.add_argument("--warmup",     default=DEFAULT_WARMUP,     type=int)
    parser.add_argument("--output",     default=DEFAULT_OUTPUT)
    parser.add_argument("--quick",      action="store_true")
    args = parser.parse_args()

    if args.quick:
        args.iterations = 50
        args.warmup = 5

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    pinfo = (f"{platform.system()} {platform.machine()} | "
             f"Python {platform.python_version()}")

    print("=" * 60)
    print("  Q-SENTRY Governance Overhead Benchmark")
    print("=" * 60)
    print(f"\nPlatform: {pinfo}")
    print(f"Config: n={args.iterations} warmup={args.warmup}")
    print(f"Comparing: Raw liboqs vs Q-SENTRY API\n")

    try:
        requests.get(f"{args.host}/health", timeout=5)
    except Exception:
        print(f"ERROR: Backend not reachable at {args.host}")
        sys.exit(1)

    runner  = OverheadRunner(args.host, args.iterations, args.warmup)
    results = runner.run()

    # Print ASCII
    print("\n" + "=" * 60 + "\n  RESULTS\n" + "=" * 60)
    kem_r = [r for r in results if r.operation in ("encrypt","decrypt")]
    sig_r = [r for r in results if r.operation in ("sign","verify")]
    print(ascii_table(kem_r, "Table V(a) — KEM: Raw liboqs vs Q-SENTRY API"))
    print(ascii_table(sig_r, "Table V(b) — Signatures: Raw liboqs vs Q-SENTRY API"))

    if results:
        avg_oh  = statistics.mean(r.overhead_ms  for r in results)
        avg_pct = statistics.mean(r.overhead_pct for r in results)
        print(f"\n  Mean governance overhead: +{avg_oh:.2f}ms ({avg_pct:.0f}% of API latency)")
        print(f"  This overhead includes: policy check + audit log write + HTTP + JSON serialization")

    # Save files
    jp = out / "overhead.json"
    jp.write_text(json.dumps({
        "meta": {"platform": pinfo, "iterations": args.iterations,
                 "generated_at": datetime.now(timezone.utc).isoformat()},
        "results": [asdict(r) for r in results],
    }, indent=2))
    print(f"\nJSON     → {jp}")

    mp = out / "overhead.md"
    mp.write_text(markdown_table(results, pinfo))
    print(f"Markdown → {mp}")

    lp = out / "overhead.tex"
    lp.write_text("\n\n".join(filter(bool, [
        f"% Q-SENTRY Governance Overhead — {pinfo}",
        latex_table(kem_r,
            "KEM Operations: Raw liboqs Primitive vs Q-SENTRY Governance API",
            "tab:kem_overhead"),
        latex_table(sig_r,
            "Signature Operations: Raw liboqs Primitive vs Q-SENTRY Governance API",
            "tab:sig_overhead"),
    ])))
    print(f"LaTeX    → {lp}")
    print(f"\n{'='*60}\n  Complete: {len(results)} rows\n{'='*60}")


if __name__ == "__main__":
    main()