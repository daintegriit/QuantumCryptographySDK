import subprocess
import json
from pathlib import Path

RUST_BIN = Path(__file__).resolve().parent.parent.parent / "rust_benchmark/target/release/rust_benchmark"


def run_rust_benchmark():
    try:
        result = subprocess.run(
            [str(RUST_BIN), "benchmark"],
            capture_output=True,
            text=True,
            check=True
        )

        return json.loads(result.stdout)

    except subprocess.CalledProcessError as e:
        return {"error": e.stderr}