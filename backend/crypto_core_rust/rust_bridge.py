from __future__ import annotations

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

def _find_bin() -> Optional[Path]:
    base = Path(__file__).resolve().parent

    candidates = [
        # Docker container (Dockerfile copies here)
        Path("/app/crypto_core_bin"),
        # Local dev build
        base / "target" / "release" / "crypto_core_bin",
        # Project root fallback
        base.parent / "crypto_core_bin",
    ]

    for path in candidates:
        if path.exists():
            return path

    return None


class RustSubprocessBridge:
    def __init__(self, bin_path: Path):
        self.bin_path = bin_path
        self.available = True

    def _call(self, *args: str) -> Any:
        result = subprocess.run(
            [str(self.bin_path)] + list(args),
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Rust binary failed: {result.stderr.strip()}")
        stdout = result.stdout.strip()
        if not stdout:
            raise RuntimeError("Rust binary returned empty output")
        for i, ch in enumerate(stdout):
            if ch in ('{', '['):
                return json.loads(stdout[i:])
        raise RuntimeError(f"No JSON in Rust output: {stdout[:200]}")

    def kem_encap(self, scheme: str, public_key_b64: str) -> Dict[str, Any]:
        return self._call("encap", scheme, public_key_b64)

    def kem_decap(self, scheme: str, private_key_b64: str, ciphertext_b64: str) -> Dict[str, Any]:
        return self._call("decap", scheme, private_key_b64, ciphertext_b64)

    def sign(self, scheme: str, private_key_b64: str, message: str) -> Dict[str, Any]:
        return self._call("sign", scheme, private_key_b64, message)

    def verify(self, scheme: str, public_key_b64: str, message: str, signature_b64: str) -> Dict[str, Any]:
        return self._call("verify", scheme, public_key_b64, message, signature_b64)

    def benchmark(self, iterations: int = 100) -> Any:
        return self._call("benchmark", str(iterations))

    def health(self) -> bool:
        try:
            result = self._call("health")
            return result.get("status") == "ok"
        except Exception:
            return False


class NullBridge:
    available = False
    def __getattr__(self, name):
        raise RuntimeError("Rust crypto bridge not available")


_bridge: Optional[RustSubprocessBridge | NullBridge] = None


def get_bridge() -> RustSubprocessBridge | NullBridge:
    global _bridge
    if _bridge is not None:
        return _bridge

    bin_path = _find_bin()
    if bin_path:
        try:
            bridge = RustSubprocessBridge(bin_path)
            if bridge.health():
                logger.info("Rust crypto bridge loaded: %s", bin_path)
                _bridge = bridge
                return _bridge
            else:
                logger.warning("Rust binary found but health check failed: %s", bin_path)
        except Exception as e:
            logger.warning("Rust bridge failed: %s", e)
    else:
        logger.info("Rust binary not found — using Python/liboqs")

    _bridge = NullBridge()
    return _bridge


def rust_available() -> bool:
    return get_bridge().available
