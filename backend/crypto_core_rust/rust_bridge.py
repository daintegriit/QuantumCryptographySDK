from __future__ import annotations
import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ============================================================
# PyO3 FFI Bridge (fast path — zero subprocess overhead)
# ============================================================
class RustFFIBridge:
    """Direct PyO3 FFI — 16-94x faster than subprocess."""
    available = True

    def __init__(self, module):
        self._m = module

    def kem_encap(self, scheme: str, public_key_b64: str) -> Dict[str, Any]:
        return json.loads(self._m.py_kem_encapsulate(scheme, public_key_b64))

    def kem_decap(self, scheme: str, private_key_b64: str, ciphertext_b64: str) -> Dict[str, Any]:
        return json.loads(self._m.py_kem_decapsulate(scheme, private_key_b64, ciphertext_b64))

    def sign(self, scheme: str, private_key_b64: str, message: str) -> Dict[str, Any]:
        return json.loads(self._m.py_sign_message(scheme, private_key_b64, message))

    def verify(self, scheme: str, public_key_b64: str, message: str, signature_b64: str) -> Dict[str, Any]:
        return json.loads(self._m.py_verify_signature(scheme, public_key_b64, message, signature_b64))

    def health(self) -> bool:
        try:
            result = json.loads(self._m.py_kem_keygen("Kyber768"))
            return "public_key" in result
        except Exception:
            return False

# ============================================================
# Subprocess Bridge (slow fallback)
# ============================================================
def _find_bin() -> Optional[Path]:
    base = Path(__file__).resolve().parent
    candidates = [
        Path("/app/crypto_core_bin"),
        base / "target" / "release" / "crypto_core_bin",
        base.parent / "crypto_core_bin",
    ]
    for path in candidates:
        if path.exists():
            return path
    return None

class RustSubprocessBridge:
    available = True

    def __init__(self, bin_path: Path):
        self.bin_path = bin_path

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

    def health(self) -> bool:
        try:
            return self._call("health").get("status") == "ok"
        except Exception:
            return False

class NullBridge:
    available = False
    def __getattr__(self, name):
        raise RuntimeError("Rust crypto bridge not available")

# ============================================================
# Bridge factory — FFI first, subprocess fallback, then null
# ============================================================
_bridge = None

def get_bridge():
    global _bridge
    if _bridge is not None:
        return _bridge

    # 1. Try PyO3 FFI first (fastest)
    try:
        import crypto_core_rust as _ffi
        bridge = RustFFIBridge(_ffi)
        if bridge.health():
            logger.info("Rust crypto bridge: PyO3 FFI loaded (fast path)")
            _bridge = bridge
            return _bridge
    except ImportError:
        logger.info("PyO3 FFI not available — trying subprocess")
    except Exception as e:
        logger.warning("PyO3 FFI failed: %s", e)

    # 2. Try subprocess binary (slower fallback)
    bin_path = _find_bin()
    if bin_path:
        try:
            bridge = RustSubprocessBridge(bin_path)
            if bridge.health():
                logger.info("Rust crypto bridge: subprocess loaded (slow path): %s", bin_path)
                _bridge = bridge
                return _bridge
        except Exception as e:
            logger.warning("Subprocess bridge failed: %s", e)

    # 3. Null bridge — Python/liboqs handles everything
    logger.info("Rust bridge unavailable — using Python/liboqs directly")
    _bridge = NullBridge()
    return _bridge

def rust_available() -> bool:
    return get_bridge().available
