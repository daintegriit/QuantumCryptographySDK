# backend/agility/adapters.py
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, Any, Optional


# ============================================================
# Adapter Result Models
# ============================================================

@dataclass(frozen=True)
class AdapterHealth:
    adapter_name: str
    backend_type: str           # SOFTWARE | HARDWARE | SIMULATION | QUANTUM
    status: str                 # OK | DEGRADED | UNAVAILABLE
    details: Dict[str, Any]
    timestamp_utc: str


@dataclass(frozen=True)
class AdapterKeyMaterial:
    """
    Abstract key material container.

    This allows:
      - Rust-backed keys
      - Hardware-backed keys
      - Quantum-simulated keys
      - Software placeholders
    """
    key_id: str
    scheme: str
    parameter_set: str
    public_material: str
    private_material: Optional[str]
    metadata: Dict[str, Any]


# ============================================================
# Base Adapter Interface (CRITICAL)
# ============================================================

class CryptoAdapter(ABC):
    """
    Abstract cryptographic adapter.

    This is the SINGLE most important abstraction in QuantumShield.

    It ensures:
      - cryptographic agility
      - long-term survivability
      - hardware independence
      - governance continuity

    NOTHING above this layer should care how crypto is implemented.
    """

    # ------------------------
    # Identity
    # ------------------------

    @property
    @abstractmethod
    def adapter_name(self) -> str:
        pass

    @property
    @abstractmethod
    def backend_type(self) -> str:
        """
        SOFTWARE | HARDWARE | SIMULATION | QUANTUM
        """
        pass

    # ------------------------
    # Core crypto operations
    # ------------------------

    @abstractmethod
    def generate_key(self, params: Dict[str, Any]) -> AdapterKeyMaterial:
        """
        Generate key material using the adapter backend.

        params may include:
          - scheme
          - parameter_set
          - security_level
          - longevity
        """
        pass

    @abstractmethod
    def encrypt(self, plaintext: str, key: AdapterKeyMaterial) -> str:
        pass

    @abstractmethod
    def decrypt(self, ciphertext: str, key: AdapterKeyMaterial) -> str:
        pass

    # ------------------------
    # Governance hooks
    # ------------------------

    @abstractmethod
    def supports_scheme(self, scheme: str) -> bool:
        """
        Used by policy + registry to select adapters.
        """
        pass

    @abstractmethod
    def health(self) -> AdapterHealth:
        """
        Adapter health check.
        Required for audits, SLAs, and compliance.
        """
        pass


# ============================================================
# Software Reference Adapter (DEFAULT)
# ============================================================

class SoftwareReferenceAdapter(CryptoAdapter):
    """
    Pure software adapter.

    Used for:
      - development
      - CI
      - reproducibility
      - fallback safety

    THIS is what you are currently using implicitly.
    """

    @property
    def adapter_name(self) -> str:
        return "software-reference"

    @property
    def backend_type(self) -> str:
        return "SOFTWARE"

    def generate_key(self, params: Dict[str, Any]) -> AdapterKeyMaterial:
        from backend.key_management.keygen import generate_key

        record = generate_key(params)
        return AdapterKeyMaterial(
            key_id=record["key_id"],
            scheme=record["algorithm"],
            parameter_set=record["parameter_set"],
            public_material=record["public_key"],
            private_material=record["private_key"],
            metadata={
                "source": "software",
                "created_at_utc": record["created_at_utc"],
            },
        )

    def encrypt(self, plaintext: str, key: AdapterKeyMaterial) -> str:
        import base64
        combined = f"{key.public_material}:{plaintext}".encode("utf-8")
        return base64.b64encode(combined).decode("utf-8")

    def decrypt(self, ciphertext: str, key: AdapterKeyMaterial) -> str:
        import base64
        decoded = base64.b64decode(ciphertext).decode("utf-8")
        prefix = f"{key.public_material}:"
        if not decoded.startswith(prefix):
            raise ValueError("Invalid ciphertext or key")
        return decoded[len(prefix):]

    def supports_scheme(self, scheme: str) -> bool:
        return True  # reference adapter supports all for dev

    def health(self) -> AdapterHealth:
        return AdapterHealth(
            adapter_name=self.adapter_name,
            backend_type=self.backend_type,
            status="OK",
            details={"mode": "reference"},
            timestamp_utc=datetime.now(timezone.utc).isoformat(),
        )


# ============================================================
# Simulation Adapter (Quantum / Threat Modeling)
# ============================================================

class QuantumSimulationAdapter(CryptoAdapter):
    """
    Adapter for quantum threat simulation.

    This DOES NOT encrypt production data.
    It exists to:
      - model future quantum break risk
      - feed migration engines
      - test registry assumptions
    """

    @property
    def adapter_name(self) -> str:
        return "quantum-simulation"

    @property
    def backend_type(self) -> str:
        return "SIMULATION"

    def generate_key(self, params: Dict[str, Any]) -> AdapterKeyMaterial:
        raise NotImplementedError("Simulation adapter does not generate real keys")

    def encrypt(self, plaintext: str, key: AdapterKeyMaterial) -> str:
        raise NotImplementedError("Simulation adapter cannot encrypt")

    def decrypt(self, ciphertext: str, key: AdapterKeyMaterial) -> str:
        raise NotImplementedError("Simulation adapter cannot decrypt")

    def supports_scheme(self, scheme: str) -> bool:
        return True

    def health(self) -> AdapterHealth:
        return AdapterHealth(
            adapter_name=self.adapter_name,
            backend_type=self.backend_type,
            status="OK",
            details={"purpose": "quantum-risk-modeling"},
            timestamp_utc=datetime.now(timezone.utc).isoformat(),
        )


# ============================================================
# Adapter Registry (Runtime Selection)
# ============================================================

_ADAPTERS: Dict[str, CryptoAdapter] = {
    "software": SoftwareReferenceAdapter(),
    "simulation": QuantumSimulationAdapter(),
}


def list_adapters() -> Dict[str, Dict[str, Any]]:
    return {
        name: asdict(adapter.health())
        for name, adapter in _ADAPTERS.items()
    }


def get_adapter(name: str = "software") -> CryptoAdapter:
    if name not in _ADAPTERS:
        raise ValueError(f"Unknown crypto adapter: {name}")
    return _ADAPTERS[name]


def select_adapter_for_scheme(scheme: str) -> CryptoAdapter:
    """
    Policy-aware adapter selection.
    """
    for adapter in _ADAPTERS.values():
        if adapter.supports_scheme(scheme):
            return adapter
    raise RuntimeError(f"No adapter supports scheme '{scheme}'")