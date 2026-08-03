from __future__ import annotations
import json
import logging
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ============================================================
# PyO3 FFI Bridge (fast path)
# ============================================================
class RustFFIBridge:
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
            result = json.loads(self._m.py_kem_keygen('Kyber768'))
            return 'public_key' in result
        except Exception as e:
            logger.warning('FFI health check failed: %s', e)
            return False

# ============================================================
# Subprocess Bridge (fallback)
# ============================================================
def _find_bin() -> Optional[Path]:
    base = Path(__file__).resolve().parent.parent
    candidates = [
        Path('/app/crypto_core_bin'),
        base / 'target' / 'release' / 'crypto_core_bin',
        base.parent / 'crypto_core_bin',
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
            raise RuntimeError(f'Rust binary failed: {result.stderr.strip()}')
        stdout = result.stdout.strip()
        for i, ch in enumerate(stdout):
            if ch in ('{', '['):
                return json.loads(stdout[i:])
        raise RuntimeError(f'No JSON in output: {stdout[:200]}')

    def kem_encap(self, scheme, pk): return self._call('encap', scheme, pk)
    def kem_decap(self, scheme, sk, ct): return self._call('decap', scheme, sk, ct)
    def sign(self, scheme, sk, msg): return self._call('sign', scheme, sk, msg)
    def verify(self, scheme, pk, msg, sig): return self._call('verify', scheme, pk, msg, sig)
    def health(self):
        try: return self._call('health').get('status') == 'ok'
        except: return False

class NullBridge:
    available = False
    def __getattr__(self, name):
        raise RuntimeError('Rust crypto bridge not available')

_bridge = None

def get_bridge():
    global _bridge
    if _bridge is not None:
        return _bridge

    # 1. Try PyO3 FFI (fast path)
    try:
        import importlib
        # Import the TOP-LEVEL crypto_core_rust (the .so file)
        import sys
        # Temporarily remove local path to get the installed .so
        ffi_mod = None
        for finder in sys.meta_path:
            try:
                spec = finder.find_spec('crypto_core_rust', None)
                if spec and spec.origin and spec.origin.endswith('.so'):
                    ffi_mod = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(ffi_mod)
                    break
            except Exception:
                continue

        if ffi_mod is None:
            # Direct import fallback
            import crypto_core_rust as ffi_mod

        if hasattr(ffi_mod, 'py_kem_keygen'):
            bridge = RustFFIBridge(ffi_mod)
            if bridge.health():
                logger.info('Rust crypto bridge: PyO3 FFI (fast path)')
                _bridge = bridge
                return _bridge
    except Exception as e:
        logger.warning('PyO3 FFI failed: %s', e)

    # 2. Subprocess fallback
    bin_path = _find_bin()
    if bin_path:
        try:
            bridge = RustSubprocessBridge(bin_path)
            if bridge.health():
                logger.info('Rust crypto bridge: subprocess (slow path)')
                _bridge = bridge
                return _bridge
        except Exception as e:
            logger.warning('Subprocess bridge failed: %s', e)

    logger.info('No Rust bridge — using Python/liboqs')
    _bridge = NullBridge()
    return _bridge

def rust_available() -> bool:
    return get_bridge().available
