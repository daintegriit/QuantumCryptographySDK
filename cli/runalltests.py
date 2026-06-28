#!/usr/bin/env python3
"""
Q-SENTRY MASTER TEST RUNNER (ELITE)

Runs all 6 test categories:
1. Functional Correctness
2. Policy Validation
3. Long-Term Risk
4. Adversarial Testing
5. KEM Benchmark (liboqs)
6. Security Scaling (liboqs)
7. Rust Benchmark (optional performance engine)

Features:
- Proper stdout + stderr visibility
- Environment validation
- Rust integration
- Clean separation of test types
"""

import subprocess
import sys
import os

PYTHON = sys.executable


# ============================================================
# TEST DEFINITIONS
# ============================================================

API_TESTS = [
    ("Functional Correctness", "cli/test_functional_correctness.py"),
    ("Policy Validation", "cli/test_policy_validation.py"),
    ("Long-Term Risk", "cli/test_long_term_risk.py"),
    ("Adversarial", "cli/test_adversarial.py"),
]

OQS_TESTS = [
    ("KEM Benchmark", "cli/test_benchmark_kem.py"),
    ("Security Scaling", "cli/test_sec_scaling.py"),
]

RUST_TEST = ("Rust Benchmark", "rust_benchmark")


# ============================================================
# HELPERS
# ============================================================

def check_requests():
    try:
        import requests
        return True
    except:
        print("❌ requests not installed → run: pip install requests")
        return False


def check_oqs():
    try:
        import oqs
        return True
    except:
        print("⚠ oqs not available → skipping OQS tests")
        return False


def run_python_test(name, script):
    print(f"\n🚀 Running {name}...\n")

    result = subprocess.run(
        [PYTHON, script],
        cwd=os.getcwd(),
        capture_output=True,
        text=True
    )

    print(result.stdout)

    if result.returncode == 0:
        print(f"✅ {name} PASSED\n")
    else:
        print(f"❌ {name} FAILED\n")
        print(result.stderr)


def run_rust():
    name, path = RUST_TEST

    print(f"\n🦀 Running {name}...\n")

    try:
        result = subprocess.run(
            ["cargo", "run", "--release"],
            cwd=path,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"❌ Rust FAILED\n{result.stderr}")
            return

        print(result.stdout)
        print("✅ Rust Benchmark PASSED\n")

    except Exception as e:
        print(f"❌ Rust CRASHED: {e}")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("\n🧪 Q-SENTRY MASTER TEST RUNNER (ELITE)\n")

    # ---------------- ENV CHECK ----------------
    if not check_requests():
        sys.exit(1)

    oqs_available = check_oqs()

    # ---------------- API TESTS ----------------
    print("\n================ API TESTS ================\n")
    for name, script in API_TESTS:
        run_python_test(name, script)

    # ---------------- OQS TESTS ----------------
    if oqs_available:
        print("\n================ OQS TESTS ================\n")
        for name, script in OQS_TESTS:
            run_python_test(name, script)
    else:
        print("\n⚠ Skipping OQS tests\n")

    # ---------------- RUST TEST ----------------
    print("\n================ RUST TEST ================\n")
    run_rust()

    print("\n🏁 ALL TESTS COMPLETE\n")