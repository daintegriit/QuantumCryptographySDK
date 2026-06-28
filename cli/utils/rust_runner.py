# cli/utils/rust_runner.py

import subprocess
import json

def run_rust_benchmark():
    result = subprocess.run(
        ["cargo", "run", "--release"],
        cwd="rust_benchmark",   # your Rust project folder
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        raise RuntimeError(f"Rust benchmark failed:\n{result.stderr}")

    return json.loads(result.stdout)