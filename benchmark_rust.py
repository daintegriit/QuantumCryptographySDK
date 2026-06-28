#!/usr/bin/env python3
"""
Q-SENTRY Rust Bridge Benchmark
================================
Benchmarks the Rust crypto core directly (no HTTP, no API overhead)
and compares against Python/liboqs for the same operations.

Produces Table V for the paper: Python vs Rust speedup ratio.

Usage:
  cd backend/
  python3 ../benchmark_rust.py
  python3 ../benchmark_rust.py --quick
  python3 ../benchmark_rust.py --output ../results_paper/
"""

from __future__ import annotations

import argparse
import base64
import json
import platform
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

# Must run from backend/ directory
sys.path.insert(0, str(Path(__file__).parent / "backend"))
sys.path.insert(0, ".")

try:
    import oqs
except ImportError:
    print("ERROR: Run from project root with oqs-env active")
    print("  cd QuantumResistantCryptographySDK")
    print("  source oqs-env/bin/activate")
    print("  python3 benchmark_rust.py")
    sys.exit(1)

try:
    from crypto_core_rust.rust_bridge import get_bridge
    RUST_BRIDGE = get_bridge()
    RUST_AVAILABLE = RUST_BRIDGE.available
except Exception as e:
    RUST_AVAILABLE = False
    RUST_BRIDGE = None
    print(f"WARNING: Rust bridge unavailable: {e}")
    print("Running Python-only benchmark.")

DEFAULT_ITERATIONS = 1000
DEFAULT_WARMUP     = 50
DEFAULT_OUTPUT     = "results_paper"

# ============================================================
# Helpers
# ============================================================

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")

def b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

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
        if (i + 1) % 200 == 0:
            print(f"{i+1}.", end="", flush=True)
    print(f" ✓ (errors={errors})")
    return latencies, errors

def pct(s: List[float], p: float) -> float:
    if not s: return 0.0
    n = len(s)
    i = (p / 100) * (n - 1)
    lo, hi = int(i), min(int(i) + 1, n - 1)
    return s[lo] + (i - lo) * (s[hi] - s[lo])

@dataclass
class Result:
    operation:    str
    algorithm:    str
    parameter_set: str
    backend:      str   # "rust" | "python"
    n:            int
    mean_ms:      float
    p50_ms:       float
    p95_ms:       float
    p99_ms:       float
    ops_per_sec:  float
    speedup:      float = 0.0  # filled in after comparison

    def to_row(self) -> List[str]:
        sp = f"{self.speedup:.1f}x" if self.speedup > 0 else "—"
        return [
            self.algorithm, self.parameter_set, self.operation, self.backend,
            f"{self.ops_per_sec:,.0f}",
            f"{self.mean_ms:.4f}",
            f"{self.p50_ms:.4f}",
            f"{self.p95_ms:.4f}",
            f"{self.p99_ms:.4f}",
            sp,
        ]

def make_result(lats, op, alg, param, backend, errors) -> Optional[Result]:
    if not lats:
        return None
    s = sorted(lats)
    mean = statistics.mean(lats)
    return Result(
        operation=op, algorithm=alg, parameter_set=param, backend=backend,
        n=len(lats),
        mean_ms=round(mean, 5),
        p50_ms=round(pct(s, 50), 5),
        p95_ms=round(pct(s, 95), 5),
        p99_ms=round(pct(s, 99), 5),
        ops_per_sec=round(1000 / mean if mean > 0 else 0, 1),
        speedup=0.0,
    )

# ============================================================
# Python/liboqs direct benchmarks
# ============================================================

def bench_python_kem(param: str, n: int, warmup: int) -> List[Result]:
    resolved = _resolve_kem(param)
    results = []

    # keygen
    kem = oqs.KeyEncapsulation(resolved)
    pub = kem.generate_keypair()
    priv = kem.export_secret_key()
    pub_b64 = b64url(pub)
    priv_b64 = b64url(priv)

    # encap
    def python_encap():
        k = oqs.KeyEncapsulation(resolved)
        k.generate_keypair()
        k2 = oqs.KeyEncapsulation(resolved)
        k2.generate_keypair()
        enc_k = oqs.KeyEncapsulation(resolved)
        enc_k.generate_keypair()
        # use pre-generated pub key
        enc = oqs.KeyEncapsulation(resolved)
        enc.generate_keypair()
        ct, ss = enc.encap_secret(pub)
        return ct, ss

    # simpler: just encap with fixed pub key
    def python_encap2():
        enc = oqs.KeyEncapsulation(resolved)
        enc.generate_keypair()
        return enc.encap_secret(pub)

    lats, errs = measure(python_encap2, n, warmup, f"python-encap/{param}")
    results.append(make_result(lats, "encap", "kyber" if "kyber" in param.lower() else "frodokem", param, "python", errs))

    # decap
    ct, ss = oqs.KeyEncapsulation(resolved).encap_secret(pub)  # won't work — need matching key
    # Proper decap:
    kem2 = oqs.KeyEncapsulation(resolved, priv)
    ct2, _ = oqs.KeyEncapsulation(resolved).encap_secret(pub)

    def python_decap():
        k = oqs.KeyEncapsulation(resolved, priv)
        k.decap_secret(ct2)

    lats, errs = measure(python_decap, n, warmup, f"python-decap/{param}")
    results.append(make_result(lats, "decap", "kyber" if "kyber" in param.lower() else "frodokem", param, "python", errs))

    return [r for r in results if r]


def bench_python_sig(alg_name: str, param: str, n: int, warmup: int) -> List[Result]:
    resolved = _resolve_sig(param)
    results = []
    msg = b"Q-SENTRY benchmark message 2026"

    sig_obj = oqs.Signature(resolved)
    pub = sig_obj.generate_keypair()
    priv = sig_obj.export_secret_key()

    def python_sign():
        s = oqs.Signature(resolved, priv)
        return s.sign(msg)

    lats, errs = measure(python_sign, n, warmup, f"python-sign/{param}")
    results.append(make_result(lats, "sign", alg_name, param, "python", errs))

    signature = oqs.Signature(resolved, priv).sign(msg)

    def python_verify():
        v = oqs.Signature(resolved)
        return v.verify(msg, signature, pub)

    lats, errs = measure(python_verify, n, warmup, f"python-verify/{param}")
    results.append(make_result(lats, "verify", alg_name, param, "python", errs))

    return [r for r in results if r]


# ============================================================
# Rust bridge direct benchmarks
# ============================================================

def bench_rust_kem(param: str, n: int, warmup: int) -> List[Result]:
    if not RUST_AVAILABLE:
        return []

    resolved = _resolve_kem(param)
    alg_name = "kyber" if "kyber" in param.lower() else "frodokem"

    # Pre-generate keys via Python (Rust bridge doesn't expose keygen)
    kem = oqs.KeyEncapsulation(resolved)
    pub = kem.generate_keypair()
    priv = kem.export_secret_key()
    pub_b64  = b64url(pub)
    priv_b64 = b64url(priv)

    # First encap to get ciphertext for decap bench
    try:
        enc_result = RUST_BRIDGE.kem_encap(resolved, pub_b64)
        ct_b64 = enc_result["kem_ciphertext"]
    except Exception as e:
        print(f"  Rust encap failed for {param}: {e}")
        return []

    results = []

    def rust_encap():
        RUST_BRIDGE.kem_encap(resolved, pub_b64)

    lats, errs = measure(rust_encap, n, warmup, f"rust-encap/{param}")
    results.append(make_result(lats, "encap", alg_name, param, "rust", errs))

    def rust_decap():
        RUST_BRIDGE.kem_decap(resolved, priv_b64, ct_b64)

    lats, errs = measure(rust_decap, n, warmup, f"rust-decap/{param}")
    results.append(make_result(lats, "decap", alg_name, param, "rust", errs))

    return [r for r in results if r]


def bench_rust_sig(alg_name: str, param: str, n: int, warmup: int) -> List[Result]:
    if not RUST_AVAILABLE:
        return []

    resolved = _resolve_sig_rust(param)
    if resolved not in {"Dilithium2", "Dilithium3", "Dilithium5", "Falcon-512", "Falcon-1024"}:
        print(f"  Rust bridge does not support {param} — Python only")
        return []

    msg = "Q-SENTRY benchmark message 2026"

    # Generate keys via Python
    sig_obj = oqs.Signature(_resolve_sig(param))
    pub = sig_obj.generate_keypair()
    priv = sig_obj.export_secret_key()
    pub_b64  = b64url(pub)
    priv_b64 = b64url(priv)

    try:
        sign_result = RUST_BRIDGE.sign(resolved, priv_b64, msg)
        signature_b64 = sign_result["signature"]
    except Exception as e:
        print(f"  Rust sign failed for {param}: {e}")
        return []

    results = []

    def rust_sign():
        RUST_BRIDGE.sign(resolved, priv_b64, msg)

    lats, errs = measure(rust_sign, n, warmup, f"rust-sign/{param}")
    results.append(make_result(lats, "sign", alg_name, param, "rust", errs))

    def rust_verify():
        RUST_BRIDGE.verify(resolved, pub_b64, msg, signature_b64)

    lats, errs = measure(rust_verify, n, warmup, f"rust-verify/{param}")
    results.append(make_result(lats, "verify", alg_name, param, "rust", errs))

    return [r for r in results if r]


# ============================================================
# Scheme name resolvers
# ============================================================

_KEM_MECHS = set(oqs.get_enabled_kem_mechanisms())
_SIG_MECHS = set(oqs.get_enabled_sig_mechanisms())

def _resolve_kem(param: str) -> str:
    mapping = {
        "kyber512": "Kyber512", "kyber768": "Kyber768", "kyber1024": "Kyber1024",
        "frodokem-640-aes": "FrodoKEM-640-AES", "frodokem-976-aes": "FrodoKEM-976-AES",
        "frodokem-1344-aes": "FrodoKEM-1344-AES",
    }
    canonical = mapping.get(param, param)
    if canonical in _KEM_MECHS: return canonical
    # try ML-KEM fallback
    ml = {"Kyber512":"ML-KEM-512","Kyber768":"ML-KEM-768","Kyber1024":"ML-KEM-1024"}
    fb = ml.get(canonical)
    return fb if fb and fb in _KEM_MECHS else canonical

def _resolve_sig(param: str) -> str:
    mapping = {
        "dilithium2":"Dilithium2","dilithium3":"Dilithium3","dilithium5":"Dilithium5",
        "falcon512":"Falcon-512","falcon1024":"Falcon-1024","falcon-padded-512":"Falcon-padded-512",
        "sphincs-sha2-128f":"SPHINCS+-SHA2-128f-simple","sphincs-sha2-128s":"SPHINCS+-SHA2-128s-simple",
        "sphincs-shake-128f":"SPHINCS+-SHAKE-128f-simple",
    }
    canonical = mapping.get(param, param)
    if canonical in _SIG_MECHS: return canonical
    ml = {"Dilithium2":"ML-DSA-44","Dilithium3":"ML-DSA-65","Dilithium5":"ML-DSA-87"}
    fb = ml.get(canonical)
    return fb if fb and fb in _SIG_MECHS else canonical

def _resolve_sig_rust(param: str) -> str:
    # Rust bridge uses old Dilithium names
    mapping = {
        "dilithium2":"Dilithium2","dilithium3":"Dilithium3","dilithium5":"Dilithium5",
        "falcon512":"Falcon-512","falcon1024":"Falcon-1024",
    }
    return mapping.get(param, param)


# ============================================================
# Compute speedups
# ============================================================

def add_speedups(results: List[Result]) -> List[Result]:
    # Group by (operation, algorithm, parameter_set)
    py_map: Dict[Tuple, float] = {}
    for r in results:
        if r.backend == "python":
            py_map[(r.operation, r.algorithm, r.parameter_set)] = r.ops_per_sec

    for r in results:
        if r.backend == "rust":
            py_ops = py_map.get((r.operation, r.algorithm, r.parameter_set), 0)
            if py_ops > 0:
                r.speedup = round(r.ops_per_sec / py_ops, 2)
    return results


# ============================================================
# Output
# ============================================================

def ascii_table(results: List[Result], title: str) -> str:
    if not results: return ""
    cols = ["Algorithm","Params","Op","Backend","Ops/sec","Mean(ms)","P50(ms)","P95(ms)","P99(ms)","Speedup"]
    data = [r.to_row() for r in results]
    w = [max(len(cols[i]), max(len(d[i]) for d in data)) for i in range(len(cols))]
    sep = "+" + "+".join("-"*(wi+2) for wi in w) + "+"
    hdr = "|" + "|".join(f" {cols[i]:<{w[i]}} " for i in range(len(cols))) + "|"
    out = [f"\n{title}", sep, hdr, sep]
    prev_param = None
    for d, r in zip(data, results):
        if prev_param and r.parameter_set != prev_param:
            out.append(sep)
        out.append("|" + "|".join(f" {d[i]:<{w[i]}} " for i in range(len(cols))) + "|")
        prev_param = r.parameter_set
    out.append(sep)
    return "\n".join(out)


def latex_comparison_table(results: List[Result], caption: str, label: str) -> str:
    if not results: return ""
    lines = [
        r"\begin{table}[t]", r"\centering",
        r"\caption{" + caption + r"}",
        r"\label{" + label + r"}",
        r"\begin{tabular}{llllrrrr}", r"\toprule",
        r"Algorithm & Params & Op & Backend & Ops/s & Mean(ms) & P95(ms) & Speedup \\",
        r"\midrule",
    ]
    prev = None
    for r in results:
        if prev and r.parameter_set != prev:
            lines.append(r"\midrule")
        prev = r.parameter_set
        sp = f"{r.speedup:.1f}\\times" if r.speedup > 0 else "—"
        lines.append(
            f"{r.algorithm} & {r.parameter_set} & {r.operation} & "
            f"\\texttt{{{r.backend}}} & "
            f"{r.ops_per_sec:,.0f} & {r.mean_ms:.4f} & {r.p95_ms:.4f} & ${sp}$ \\\\"
        )
    lines += [r"\bottomrule", r"\end{tabular}", r"\end{table}"]
    return "\n".join(lines)


def markdown_comparison(results: List[Result], platform_info: str) -> str:
    lines = [
        "# Q-SENTRY Python vs Rust Benchmark\n",
        f"**Platform:** {platform_info}  ",
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}\n",
        "| Algorithm | Params | Op | Backend | Ops/sec | Mean(ms) | P95(ms) | P99(ms) | Speedup |",
        "|---|---|---|---|---:|---:|---:|---:|---:|",
    ]
    for r in results:
        sp = f"{r.speedup:.1f}x" if r.speedup > 0 else "—"
        lines.append(f"| {r.algorithm} | {r.parameter_set} | {r.operation} | "
                     f"**{r.backend}** | {r.ops_per_sec:,.0f} | {r.mean_ms:.4f} | "
                     f"{r.p95_ms:.4f} | {r.p99_ms:.4f} | {sp} |")
    return "\n".join(lines)


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Q-SENTRY Python vs Rust Benchmark")
    parser.add_argument("--iterations", default=DEFAULT_ITERATIONS, type=int)
    parser.add_argument("--warmup",     default=DEFAULT_WARMUP,     type=int)
    parser.add_argument("--output",     default=DEFAULT_OUTPUT)
    parser.add_argument("--quick",      action="store_true")
    args = parser.parse_args()

    if args.quick:
        args.iterations = 100
        args.warmup = 10

    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)

    platform_info = (f"{platform.system()} {platform.machine()} | "
                     f"Python {platform.python_version()} | "
                     f"Rust available: {RUST_AVAILABLE}")

    print("=" * 60)
    print("  Q-SENTRY Python vs Rust Benchmark")
    print("=" * 60)
    print(f"\nPlatform: {platform_info}")
    print(f"Rust bridge: {'✓ AVAILABLE' if RUST_AVAILABLE else '✗ NOT AVAILABLE'}")
    print(f"Iterations: {args.iterations} | Warmup: {args.warmup}\n")

    # Configs to benchmark (Rust supports Kyber + Dilithium + Falcon only)
    KEM_PARAMS  = ["kyber512", "kyber768", "kyber1024"]
    SIG_PARAMS  = [
        ("dilithium", "dilithium2"), ("dilithium", "dilithium3"), ("dilithium", "dilithium5"),
        ("falcon",    "falcon512"),  ("falcon",    "falcon1024"),
    ]

    all_results: List[Result] = []

    # ── KEM ─────────────────────────────────────────────────
    print("\n=== KEM: Python vs Rust ===")
    for param in KEM_PARAMS:
        print(f"\n── {param} ──")
        py = bench_python_kem(param, args.iterations, args.warmup)
        all_results.extend(py)
        if RUST_AVAILABLE:
            ru = bench_rust_kem(param, args.iterations, args.warmup)
            all_results.extend(ru)

    # ── Signatures ──────────────────────────────────────────
    print("\n=== Signatures: Python vs Rust ===")
    for alg_name, param in SIG_PARAMS:
        print(f"\n── {alg_name}/{param} ──")
        py = bench_python_sig(alg_name, param, args.iterations, args.warmup)
        all_results.extend(py)
        if RUST_AVAILABLE:
            ru = bench_rust_sig(alg_name, param, args.iterations, args.warmup)
            all_results.extend(ru)

    # Add speedup ratios
    all_results = add_speedups(all_results)

    # ── Print results ────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  PYTHON vs RUST COMPARISON")
    print("=" * 60)

    kem_r = [r for r in all_results if r.operation in ("encap","decap")]
    sig_r = [r for r in all_results if r.operation in ("sign","verify")]

    print(ascii_table(kem_r, "Table V(a) — KEM: Python vs Rust"))
    print(ascii_table(sig_r, "Table V(b) — Signatures: Python vs Rust"))

    # ── Save outputs ─────────────────────────────────────────
    jp = out / "rust_comparison.json"
    with open(jp, "w") as f:
        json.dump({
            "meta": {"platform": platform_info, "rust_available": RUST_AVAILABLE,
                     "iterations": args.iterations, "warmup": args.warmup,
                     "generated_at": datetime.now(timezone.utc).isoformat()},
            "results": [asdict(r) for r in all_results],
        }, f, indent=2)
    print(f"\nJSON     → {jp}")

    mp = out / "rust_comparison.md"
    mp.write_text(markdown_comparison(all_results, platform_info))
    print(f"Markdown → {mp}")

    lp = out / "rust_comparison.tex"
    lp.write_text("\n\n".join(filter(bool, [
        f"% Q-SENTRY Python vs Rust — {platform_info}",
        latex_comparison_table(kem_r,
            "KEM Operation Throughput: Python/liboqs vs Rust Crypto Core",
            "tab:rust_kem"),
        latex_comparison_table(sig_r,
            "Signature Operation Throughput: Python/liboqs vs Rust Crypto Core",
            "tab:rust_sig"),
    ])))
    print(f"LaTeX    → {lp}")

    # Summary
    rust_results = [r for r in all_results if r.backend == "rust" and r.speedup > 0]
    if rust_results:
        avg_speedup = statistics.mean(r.speedup for r in rust_results)
        max_speedup = max(r.speedup for r in rust_results)
        print(f"\n  Average Rust speedup: {avg_speedup:.1f}x")
        print(f"  Peak Rust speedup:    {max_speedup:.1f}x")

    print(f"\n{'='*60}")
    print(f"  Complete: {len(all_results)} series | Rust: {RUST_AVAILABLE}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()