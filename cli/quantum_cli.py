"""
Quantum CLI (Ultimate)

Supports:
- keygen (Kyber + Dilithium + Falcon)
- encrypt / decrypt (KEM only)
- sign / verify (signature only)
- test (KEM pipeline)
- benchmark (API/system)
- benchmark-core (Rust only)
- benchmark-full (Rust + API combined)
- lifecycle <key_id>         ← FIXED: was called but never defined
- simulate / simulate-portfolio
- migrate-check / policy-check / policy-drift
- charts / chart

Never exposes private keys.
"""

import json
import time
import requests
import sys
import subprocess
import os

API_BASE = "http://localhost:8008/api"

# ============================================================
# CONFIG
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

RUST_PROJECT_PATH = os.path.join(PROJECT_ROOT, "rust_benchmark")
CHARTS_DIR = os.path.join(PROJECT_ROOT, "charts")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

os.makedirs(RESULTS_DIR, exist_ok=True)

# ============================================================
# SUPPORTED SCHEMES
# ============================================================

SUPPORTED_PARAMS = [
    "rsa2048",
    "eccp256",
    "kyber512",
    "kyber768",
    "kyber1024",
    "dilithium2",
    "dilithium3",
    "dilithium5",
    "falcon512",
    "falcon1024",
]

# ============================================================
# HELPERS
# ============================================================

def pretty(obj):
    print(json.dumps(obj, indent=2))


def fail(msg):
    print(f"\n❌ ERROR: {msg}")
    sys.exit(1)


def parse_json_arg(arg):
    try:
        return json.loads(arg)
    except Exception:
        fail("Invalid JSON input")


def infer_algorithm(param: str) -> str:
    p = param.lower()
    if "kyber" in p:
        return "kyber"
    if "dilithium" in p:
        return "dilithium"
    if "falcon" in p:
        return "falcon"
    if "rsa" in p:
        return "rsa"
    if "ecc" in p:
        return "ecc"
    raise ValueError(f"Unknown parameter_set: {param}")


def cmd_list():
    print("\n🔍 Supported Parameter Sets:\n")
    for p in SUPPORTED_PARAMS:
        alg = infer_algorithm(p)
        print(f"  - {p} ({alg})")
    print()

# ============================================================
# API CALLS
# ============================================================

def generate_key(parameter_set="kyber768"):
    if parameter_set not in SUPPORTED_PARAMS:
        fail(f"Invalid parameter_set: {parameter_set}")

    algorithm = infer_algorithm(parameter_set)

    res = requests.post(f"{API_BASE}/keygen", json={
        "algorithm": algorithm,
        "parameter_set": parameter_set,
        "security_level": None
    })

    if res.status_code != 200:
        fail(res.text)

    return res.json()


def encrypt(plaintext, key_id):
    res = requests.post(f"{API_BASE}/encrypt", json={
        "plaintext": plaintext,
        "key_id": key_id
    })
    if res.status_code != 200:
        fail(res.text)
    return res.json()


def decrypt(ciphertext, key_id):
    res = requests.post(f"{API_BASE}/decrypt", json={
        "ciphertext": ciphertext,
        "key_id": key_id
    })
    if res.status_code != 200:
        fail(res.text)
    return res.json()


def sign(message, key_id):
    res = requests.post(f"{API_BASE}/sign", json={
        "message": message,
        "key_id": key_id
    })
    if res.status_code != 200:
        fail(res.text)
    return res.json()


def verify(message, signature, key_id):
    res = requests.post(f"{API_BASE}/verify", json={
        "message": message,
        "signature": signature,
        "key_id": key_id
    })
    if res.status_code != 200:
        fail(res.text)
    return res.json()


def encrypt_classical(plaintext, scheme="rsa-2048"):
    res = requests.post(f"{API_BASE}/encrypt-classical", json={
        "plaintext": plaintext,
        "scheme": scheme
    })
    if res.status_code != 200:
        fail(res.text)
    return res.json()


def sign_classical(message, scheme="ecc-p256"):
    res = requests.post(f"{API_BASE}/sign-classical", json={
        "message": message,
        "scheme": scheme
    })
    if res.status_code != 200:
        fail(res.text)
    return res.json()

# ============================================================
# CLI COMMAND WRAPPERS
# ============================================================

def cmd_keygen():
    param = sys.argv[2] if len(sys.argv) > 2 else "kyber768"
    res = generate_key(param)
    pretty(res)


def cmd_encrypt():
    if len(sys.argv) < 4:
        fail("Usage: encrypt <key_id> <plaintext>")
    key_id = sys.argv[2]
    plaintext = sys.argv[3]
    res = encrypt(plaintext, key_id)
    pretty(res)


def cmd_decrypt():
    if len(sys.argv) < 4:
        fail("Usage: decrypt <key_id> '<ciphertext_json>'")
    key_id = sys.argv[2]
    ciphertext = parse_json_arg(sys.argv[3])
    res = decrypt(ciphertext, key_id)
    pretty(res)


def cmd_sign():
    if len(sys.argv) < 4:
        fail("Usage: sign <key_id> <message>")
    key_id = sys.argv[2]
    message = sys.argv[3]
    res = sign(message, key_id)
    pretty(res)


def cmd_verify():
    if len(sys.argv) < 5:
        fail("Usage: verify <key_id> <message> <signature>")
    key_id = sys.argv[2]
    message = sys.argv[3]
    signature = sys.argv[4]
    res = verify(message, signature, key_id)
    pretty(res)


# ============================================================
# LIFECYCLE  ← BUG FIX: this was called but never defined
# ============================================================

def cmd_lifecycle():
    if len(sys.argv) < 3:
        fail("Usage: lifecycle <key_id>")

    key_id = sys.argv[2]

    print(f"\n🔑 Lifecycle status for {key_id}...\n")

    res = requests.get(f"{API_BASE}/keys/{key_id}/lifecycle")

    if res.status_code == 404:
        fail(f"Key not found: {key_id}")

    if res.status_code != 200:
        fail(res.text)

    data = res.json()
    lc = data.get("lifecycle", data)  # unwrap if nested

    print(f"  Key ID:          {lc.get('key_id', key_id)}")
    print(f"  Scheme:          {lc.get('scheme', 'N/A')}")
    print(f"  Parameter Set:   {lc.get('parameter_set', 'N/A')}")
    print(f"  Security Level:  {lc.get('claimed_security_level', 'N/A')}")
    print(f"  Age (days):      {lc.get('age_days', 'N/A')}")
    print(f"  Severity:        {lc.get('severity', 'N/A')}")
    print(f"  Reason:          {lc.get('reason', 'N/A')}")
    print(f"  Allowed:         {lc.get('allowed', 'N/A')}")
    print(f"  Risk Score:      {lc.get('risk_score', 'N/A')}")
    print(f"  Expires At:      {lc.get('expires_at_utc', 'N/A')}")
    print(f"  Rotate By:       {lc.get('rotation_recommended_at_utc', 'N/A')}")
    print(f"  Rotation In:     {lc.get('rotation_due_in_days', 'N/A')} days")

    warnings = lc.get("warnings", [])
    if warnings:
        print("\n⚠️  Warnings:")
        for w in warnings:
            print(f"    - {w}")

    actions = lc.get("required_actions", [])
    if actions:
        print("\n🔧 Required Actions:")
        for a in actions:
            print(f"    - {a}")

    print()

# ============================================================
# SIMULATE
# ============================================================

def cmd_simulate():
    if len(sys.argv) < 3:
        fail("Usage: simulate <key_id> [years]")

    key_id = sys.argv[2]
    years = int(sys.argv[3]) if len(sys.argv) > 3 else 50

    print(f"\n🔮 Simulating key {key_id} over {years} years...\n")

    res = requests.get(
        f"{API_BASE}/keys/{key_id}/simulation",
        params={"horizon_years": years}
    )

    if res.status_code != 200:
        fail(res.text)

    data = res.json()

    print("RESULT:")
    print(f"  Scheme:              {data.get('scheme', 'N/A')}")
    print(f"  First Migration Year:{data.get('first_migration_year', 'N/A')}")
    print(f"  Worst Risk Level:    {data.get('worst_risk_level', 'N/A')}")

    timeline = data.get("timeline", [])
    if timeline:
        print("\nTIMELINE (first 10 years):")
        for point in timeline[:10]:
            print(f"  {point['year']} → {point['risk_level']}")


def cmd_simulate_portfolio():
    print("\n🌐 Running portfolio simulation...\n")

    res = requests.post(
        f"{API_BASE}/simulations/portfolio",
        json={
            "safety_margin_years": 10,
            "limit": 100
        }
    )

    if res.status_code != 200:
        fail(res.text)

    pretty(res.json())


def cmd_migrate_check():
    if len(sys.argv) < 3:
        fail("Usage: migrate-check <key_id>")

    key_id = sys.argv[2]

    print(f"\n🔄 Checking migration status for {key_id}...\n")

    res = requests.get(f"{API_BASE}/keys/{key_id}/migration")

    if res.status_code != 200:
        fail(res.text)

    data = res.json()

    print("MIGRATION ANALYSIS:\n")
    print(f"  Scheme:            {data.get('scheme', 'N/A')}")
    print(f"  Break Year:        {data.get('estimated_quantum_break_year', 'N/A')}")
    print(f"  Years Remaining:   {data.get('years_of_margin', 'N/A')}")
    print(f"  Severity:          {data.get('severity', 'N/A')}")
    print(f"  Migration Required:{data.get('migration_required', 'N/A')}")
    print(f"  Recommendation:    {data.get('recommended_target_scheme', 'N/A')}")
    print()

# ============================================================
# POLICY
# ============================================================

def cmd_policy_drift():
    print("\n🔍 Checking cryptographic policy drift...\n")

    try:
        res = requests.get(f"{API_BASE}/policy-drift")

        if res.status_code != 200:
            fail(res.text)

        data = res.json()

        print("📊 POLICY DRIFT REPORT\n")
        print(f"Drift Detected: {data['drift_detected']}")
        print(f"Severity: {data['drift_severity']}\n")
        print(f"Baseline Deny Rate: {data['deny_rate_baseline']:.2%}")
        print(f"Recent Deny Rate:   {data['deny_rate_recent']:.2%}")
        print(f"Delta:              {data['deny_rate_delta']:+.2%}\n")
        print("Explanation:")
        for line in data["explanation"]:
            print(f" - {line}")
        print()

    except Exception as e:
        fail(f"Policy check failed: {e}")


def cmd_policy_check():
    if len(sys.argv) < 4:
        fail("Usage: policy-check <scheme> <parameter_set>")

    scheme = sys.argv[2]
    param = sys.argv[3]

    print(f"\n🔍 Checking policy for {scheme} {param}...\n")

    res = requests.post(
        f"{API_BASE}/policy/check",
        json={
            "scheme": scheme,
            "parameter_set": param,
            "estimated_longevity_years": 30
        }
    )

    if res.status_code != 200:
        fail(res.text)

    pretty(res.json())

# ============================================================
# RUST BENCHMARK
# ============================================================

def run_rust_benchmark():
    print("\n🦀 Running Rust core benchmark...\n")

    if not os.path.isdir(RUST_PROJECT_PATH):
        fail(f"Rust project not found at: {RUST_PROJECT_PATH}")

    try:
        start = time.perf_counter()

        result = subprocess.run(
            ["cargo", "run", "--release"],
            cwd=RUST_PROJECT_PATH,
            capture_output=True,
            text=True
        )

        elapsed = time.perf_counter() - start

        if result.returncode != 0:
            print("❌ Rust stderr:\n", result.stderr)
            fail("Rust benchmark failed")

        raw_output = result.stdout.strip()

        if not raw_output:
            fail("Rust returned empty output")

        # Extract JSON — Rust may print progress lines before the JSON blob
        # Find the first '{' or '[' and parse from there
        json_start = -1
        for i, ch in enumerate(raw_output):
            if ch in ('{', '['):
                json_start = i
                break

        if json_start == -1:
            print("❌ Raw Rust Output:\n", raw_output)
            fail("No JSON found in Rust output")

        try:
            rust_output = json.loads(raw_output[json_start:])
        except json.JSONDecodeError:
            print("❌ Raw Rust Output:\n", raw_output)
            fail("Rust output is not valid JSON")

        path = f"{RESULTS_DIR}/rust_core.json"
        with open(path, "w") as f:
            json.dump(rust_output, f, indent=2)

        print(f"✅ Rust results saved → {path}")
        print(f"⏱  Rust benchmark runtime: {round(elapsed, 3)}s")

        return rust_output

    except Exception as e:
        fail(f"Rust execution error: {e}")

# ============================================================
# API BENCHMARK
# ============================================================

def run_benchmark(iterations=1000):
    print("\n📊 Running API benchmark (FULL LIFECYCLE)...\n")

    results = []

    # ── RSA-2048 ──────────────────────────────────────────
    print("🔐 Benchmarking rsa-2048 (classical encryption)...")

    for _ in range(5):
        encrypt_classical("warmup", "rsa-2048")

    success_count = 0
    total_time = 0.0

    for _ in range(iterations):
        start = time.perf_counter()
        res = encrypt_classical("test", "rsa-2048")
        # BUG FIX: check both "valid" and fallback to plaintext match
        if res.get("valid", False) or res.get("plaintext") == "test":
            success_count += 1
        total_time += (time.perf_counter() - start)

    results.append({
        "scheme": "rsa-2048",
        "type": "classical-encryption",
        "avg_ms": (total_time / iterations) * 1000,
        "ops_per_sec": iterations / total_time,
        "success_rate": (success_count / iterations) * 100
    })

    # ── ECC-P256 ──────────────────────────────────────────
    print("🔐 Benchmarking ecc-p256 (classical signature)...")

    for _ in range(5):
        sign_classical("warmup", "ecc-p256")

    success_count = 0
    total_time = 0.0

    for _ in range(iterations):
        start = time.perf_counter()
        res = sign_classical("test", "ecc-p256")
        if res.get("valid", False):
            success_count += 1
        total_time += (time.perf_counter() - start)

    results.append({
        "scheme": "ecc-p256",
        "type": "classical-signature",
        "avg_ms": (total_time / iterations) * 1000,
        "ops_per_sec": iterations / total_time,
        "success_rate": (success_count / iterations) * 100
    })

    # ── KEM (Kyber) ───────────────────────────────────────
    for scheme in ["kyber512", "kyber768", "kyber1024"]:
        print(f"🔐 Benchmarking {scheme} (FULL lifecycle)...")

        for _ in range(5):
            key_res = generate_key(scheme)
            key_id = key_res["key"]["key_id"]
            enc = encrypt("warmup", key_id)
            decrypt(enc["ciphertext"], key_id)

        success_count = 0
        total_time = 0.0

        for _ in range(iterations):
            start = time.perf_counter()
            key_res = generate_key(scheme)
            key_id = key_res["key"]["key_id"]
            enc_res = encrypt("test", key_id)
            dec_res = decrypt(enc_res["ciphertext"], key_id)
            if dec_res.get("plaintext") == "test":
                success_count += 1
            total_time += (time.perf_counter() - start)

        results.append({
            "scheme": scheme.lower(),
            "type": "kem-full",
            "avg_ms": (total_time / iterations) * 1000,
            "ops_per_sec": iterations / total_time,
            "success_rate": (success_count / iterations) * 100
        })

    # ── Signatures (Dilithium + Falcon) ───────────────────
    for scheme in ["dilithium2", "dilithium3", "dilithium5", "falcon512", "falcon1024"]:
        print(f"🔐 Benchmarking {scheme} (FULL lifecycle)...")

        for _ in range(5):
            key_res = generate_key(scheme)
            key_id = key_res["key"]["key_id"]
            sig = sign("warmup", key_id)["signature"]
            verify("warmup", sig, key_id)

        success_count = 0
        total_time = 0.0

        for _ in range(iterations):
            start = time.perf_counter()
            key_res = generate_key(scheme)
            key_id = key_res["key"]["key_id"]
            sig = sign("test", key_id)["signature"]
            res = verify("test", sig, key_id)
            if res.get("valid", False):
                success_count += 1
            total_time += (time.perf_counter() - start)

        results.append({
            "scheme": scheme.lower(),
            "type": "signature-full",
            "avg_ms": (total_time / iterations) * 1000,
            "ops_per_sec": iterations / total_time,
            "success_rate": (success_count / iterations) * 100
        })

    path = f"{RESULTS_DIR}/api_metrics.json"
    with open(path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n✅ API results saved → {path}")
    pretty(results)

    return results

# ============================================================
# FULL BENCHMARK
# ============================================================

def run_full_benchmark():
    print("\n🚀 Running FULL system benchmark (Rust + API)...\n")

    rust_start = time.perf_counter()
    rust = run_rust_benchmark()
    rust_time = time.perf_counter() - rust_start
    print(f"⏱  Rust benchmark runtime: {round(rust_time, 3)}s")

    api_start = time.perf_counter()
    api = run_benchmark()
    api_time = time.perf_counter() - api_start
    print(f"⏱  API benchmark runtime: {round(api_time, 3)}s")

    combined = {"rust": rust, "api": api}

    path = f"{RESULTS_DIR}/combined.json"
    with open(path, "w") as f:
        json.dump(combined, f, indent=2)

    print(f"\n🔥 Combined results saved → {path}")

    print("\n📊 --- CORE vs SYSTEM COMPARISON ---\n")

    # Rust output is a list of dicts with "scheme" and "avg_ms"
    rust_map = {}
    if isinstance(rust, list):
        rust_map = {d["scheme"].lower(): d["avg_ms"] for d in rust if "scheme" in d}

    for entry in api:
        scheme = entry["scheme"].lower()
        api_ms = entry["avg_ms"]
        rust_ms = rust_map.get(scheme)

        print(f"{scheme.upper()}:")
        if rust_ms:
            slowdown = api_ms / rust_ms if rust_ms > 0 else 0
            print(f"  🦀 Core (Rust):   {round(rust_ms, 4)} ms")
            print(f"  🌐 System (API):  {round(api_ms, 4)} ms")
            print(f"  ⚡ Slowdown:      {round(slowdown, 1)}x")
        else:
            print(f"  🦀 Core (Rust):   N/A")
            print(f"  🌐 System (API):  {round(api_ms, 4)} ms")
            print(f"  ⚡ Slowdown:      N/A (no Rust baseline)")
        print()

# ============================================================
# TEST
# ============================================================

def run_test(iterations=5, parameter_set="kyber768"):
    if "kyber" not in parameter_set:
        fail("Test only supports KEM (Kyber)")

    print(f"\n🚀 Running {iterations} tests ({parameter_set})...\n")

    success_count = 0
    total_time = 0.0

    for i in range(iterations):
        start = time.perf_counter()

        key_res = generate_key(parameter_set)
        key_id = key_res["key"]["key_id"]

        enc_res = encrypt("hello quantum", key_id)
        dec_res = decrypt(enc_res["ciphertext"], key_id)

        success = dec_res.get("plaintext") == "hello quantum"

        elapsed = time.perf_counter() - start
        total_time += elapsed

        if success:
            success_count += 1

        print(f"Run {i+1}: success={success}, time={round(elapsed, 4)}s")

    print("\n📊 --- RESULTS ---")
    print(f"Success Rate: {(success_count / iterations) * 100}%")
    print(f"Avg Time:     {round(total_time / iterations, 4)}s")

# ============================================================
# CHARTS
# ============================================================

def run_all_charts():
    print("\n📈 Generating all charts...\n")

    if not os.path.isdir(CHARTS_DIR):
        fail(f"Charts directory not found: {CHARTS_DIR}")

    scripts = [
        os.path.join(CHARTS_DIR, f)
        for f in os.listdir(CHARTS_DIR)
        if f.endswith(".py")
    ]

    if not scripts:
        print("⚠️  No chart scripts found in charts/")
        return

    for script in scripts:
        try:
            print(f"▶ Running {os.path.basename(script)}...")
            subprocess.run(["python3", script], check=True)
        except Exception as e:
            print(f"⚠️  Failed: {script} → {e}")

    print("\n✅ All charts generated.\n")


def run_single_chart(name=None):
    if not os.path.isdir(CHARTS_DIR):
        fail(f"Charts directory not found: {CHARTS_DIR}")

    scripts = [f for f in os.listdir(CHARTS_DIR) if f.endswith(".py")]

    if not scripts:
        fail("No chart scripts found.")

    script_map = {str(i + 1): s for i, s in enumerate(sorted(scripts))}
    name_map = {s.replace(".py", ""): s for s in scripts}

    if not name:
        print("\n📈 Available charts:\n")
        for idx, script in script_map.items():
            print(f"[{idx}] {script.replace('.py', '')}")
        choice = input("\nSelect a chart (number or name): ").strip()
    else:
        choice = name.strip()

    selected_script = script_map.get(choice) or name_map.get(choice)

    if not selected_script:
        print("\n❌ Invalid selection.\n")
        print("Available options:")
        for k in sorted(name_map.keys()):
            print(f"  - {k}")
        return

    script_path = os.path.join(CHARTS_DIR, selected_script)
    print(f"\n📊 Running {selected_script}...\n")
    subprocess.run(["python3", script_path], check=True)

# ============================================================
# USAGE
# ============================================================

def print_usage():
    print("\nQ-SENTRY Quantum CLI\n")
    print("CRYPTO:")
    print("  keygen [param]")
    print("  encrypt <key_id> <plaintext>")
    print("  decrypt <key_id> '<ciphertext_json>'")
    print("  sign <key_id> <message>")
    print("  verify <key_id> <message> <signature>")
    print("\nDISCOVERY:")
    print("  list")
    print("\nTESTING:")
    print("  test [kyber512|kyber768|kyber1024]")
    print("\nBENCHMARKING:")
    print("  benchmark")
    print("  benchmark-core")
    print("  benchmark-full")
    print("\nSIMULATION:")
    print("  simulate <key_id> [years]")
    print("  simulate-portfolio")
    print("\nPOLICY & GOVERNANCE:")
    print("  policy-check <scheme> <param>")
    print("  policy-drift")
    print("  lifecycle <key_id>")
    print("  migrate-check <key_id>")
    print("\nVISUALIZATION:")
    print("  charts")
    print("  chart [name]")
    print()

# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(0)

    command = sys.argv[1]

    if command == "keygen":
        cmd_keygen()
    elif command == "encrypt":
        cmd_encrypt()
    elif command == "decrypt":
        cmd_decrypt()
    elif command == "sign":
        cmd_sign()
    elif command == "verify":
        cmd_verify()
    elif command == "list":
        cmd_list()
    elif command == "test":
        param = sys.argv[2] if len(sys.argv) > 2 else "kyber768"
        run_test(5, param)
    elif command == "benchmark":
        run_benchmark(1000)
    elif command == "benchmark-core":
        run_rust_benchmark()
    elif command == "benchmark-full":
        run_full_benchmark()
    elif command == "simulate":
        cmd_simulate()
    elif command == "simulate-portfolio":
        cmd_simulate_portfolio()
    elif command == "policy-check":
        cmd_policy_check()
    elif command == "policy-drift":
        cmd_policy_drift()
    elif command == "lifecycle":
        cmd_lifecycle()              # ← FIXED: now defined above
    elif command == "migrate-check":
        cmd_migrate_check()
    elif command == "charts":
        run_all_charts()
    elif command == "chart":
        if len(sys.argv) >= 3:
            run_single_chart(sys.argv[2])
        else:
            run_single_chart()
    else:
        print(f"\n❌ Unknown command: {command}\n")
        print_usage()