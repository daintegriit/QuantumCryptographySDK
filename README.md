# Q-SENTRY

**Post-Quantum Cryptographic Governance Framework**

[![NIST FIPS 203](https://img.shields.io/badge/NIST-FIPS%20203-blue)](https://csrc.nist.gov/publications/detail/fips/203/final)
[![NIST FIPS 204](https://img.shields.io/badge/NIST-FIPS%20204-blue)](https://csrc.nist.gov/publications/detail/fips/204/final)
[![NIST FIPS 205](https://img.shields.io/badge/NIST-FIPS%20205-blue)](https://csrc.nist.gov/publications/detail/fips/205/final)
[![NIST FIPS 206](https://img.shields.io/badge/NIST-FIPS%20206-blue)](https://csrc.nist.gov/publications/detail/fips/206/final)
[![liboqs](https://img.shields.io/badge/liboqs-0.15.0-green)](https://github.com/open-quantum-safe/liboqs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

Q-SENTRY is an AI governance-driven framework for post-quantum cryptographic infrastructure. Unlike conventional cryptographic systems that operate as static primitive-execution toolchains, Q-SENTRY treats cryptographic assets as **continuously governed operational entities** whose security posture evolves over time.

The framework integrates policy-aware governance, append-only telemetry, lifecycle intelligence, migration simulation, deterministic replay, and hybrid Python–Rust execution into a unified operational architecture.

> **Paper:** *Q-SENTRY: An AI Governance-Driven Framework for Post-Quantum Cryptographic Infrastructure* — under submission

---

## Why Q-SENTRY?

Deploying post-quantum cryptography introduces challenges far beyond primitive-level correctness:

- **Harvest Now, Decrypt Later** — adversaries record encrypted traffic today to decrypt once quantum computers arrive
- **Algorithm Renaming** — NIST renamed Kyber → ML-KEM, Dilithium → ML-DSA across liboqs versions, breaking existing systems
- **Lifecycle Blindness** — conventional KMS systems have no quantum risk awareness, migration forecasting, or drift detection
- **Audit Gaps** — no existing system provides deterministic replay of cryptographic governance decisions

Q-SENTRY solves all of these with a unified governance layer that adds **~3.4ms overhead per operation** — acceptable for production API deployment.

---

## Supported Algorithms

53 parameter sets across 8 PQC families, all via [liboqs 0.15.0](https://openquantumsafe.org/liboqs/):

| Family | Standard | Variants | Type |
|--------|----------|----------|------|
| Kyber / ML-KEM | NIST FIPS 203 | 512, 768, 1024 | KEM |
| FrodoKEM | ISO/NIST | 640, 976, 1344 × AES/SHAKE | KEM |
| BIKE | NIST 2025 | L1, L3, L5 | KEM |
| Dilithium / ML-DSA | NIST FIPS 204 | 2/3/5 + ML-DSA-44/65/87 | Signature |
| Falcon / FN-DSA | NIST FIPS 206 | 512, 1024, padded-512, padded-1024 | Signature |
| SPHINCS+ | NIST FIPS 205 | 12 variants (SHA2+SHAKE × 128/192/256 × f/s) | Signature |
| SLH-DSA | NIST FIPS 205 | 12 pure variants (canonical FIPS name) | Signature |
| MAYO | NIST Add. Sigs R2 | 1, 2, 3, 5 (research) | Signature |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React Dashboard                     │
│   Key Explorer · Risk Summary · Policy Drift ·       │
│   Simulations · Telemetry · Audit Replay · CLI       │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP/REST
┌─────────────────────▼───────────────────────────────┐
│              FastAPI Governance Layer                 │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │Policy Engine│  │Key Lifecycle │  │  Telemetry  │ │
│  │NIST matrix  │  │Migration sim │  │Append-only  │ │
│  │Risk scoring │  │Drift detect  │  │JSONL audit  │ │
│  └─────────────┘  └──────────────┘  └─────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │           Python/liboqs Crypto Core              │ │
│  │  KEM encap/decap · Sign/Verify · Key generation  │ │
│  └───────────────────┬─────────────────────────────┘ │
│                      │ subprocess bridge              │
│  ┌───────────────────▼─────────────────────────────┐ │
│  │              Rust Crypto Binary                  │ │
│  │         (Kyber · Falcon · high-perf ops)         │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Key Features

### Governance
- **Policy-aware key generation** — every key validated against NIST policy matrix before creation
- **Multi-factor risk scoring** — base risk + deprecation + longevity + migration readiness
- **Policy drift detection** — baseline vs recent window deny rate comparison
- **Adaptive remediation** — SAFE → MONITOR → MIGRATE_SOON → EMERGENCY lifecycle states

### Telemetry & Audit
- **Append-only audit log** — fsync'd JSONL, dual-write to policy and telemetry logs
- **Deterministic replay** — reconstruct full key lifecycle from audit events
- **Anomaly detection** — deterministic, rule-based (no ML hallucinations)
- **Per-key telemetry** — encrypt/decrypt/sign/verify counts, age, last used

### Simulation
- **50-year quantum risk projection** — year-by-year SAFE/MONITOR/MIGRATE_SOON/BROKEN
- **Portfolio simulation** — conservative/baseline/aggressive/breakthrough scenarios
- **Migration safety margin** — configurable years before estimated quantum break

### Performance (Apple M-series, liboqs 0.15.0)
| Operation | Raw liboqs | Q-SENTRY API | Governance overhead |
|-----------|-----------|--------------|-------------------|
| ML-KEM-768 encap | 0.024ms | 3.5ms | +3.5ms |
| ML-DSA-65 sign | 0.34ms | 3.7ms | +3.4ms |
| Falcon-512 sign | 0.16ms | 3.5ms | +3.3ms |
| SPHINCS+-SHA2-128f sign | 15ms | 28ms | +13ms |
| Policy check | — | 2.1ms | — |
| 50yr simulation | — | 5.9ms | — |

---

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/daintegriit/QuantumCryptographySDK.git
cd QuantumCryptographySDK
docker compose up --build
```

- Dashboard: http://localhost:3008
- API: http://localhost:8008
- API docs: http://localhost:8008/docs

### Local Development

```bash
# Prerequisites: Python 3.10+, liboqs 0.15.0, cmake
git clone https://github.com/daintegriit/QuantumCryptographySDK.git
cd QuantumCryptographySDK

python3 -m venv oqs-env
source oqs-env/bin/activate
pip install -r backend/requirements.txt

cd backend
uvicorn main:app --port 8008 --reload
```

---

## CLI Usage

```bash
cd backend

# Generate a Kyber-768 key (recommended KEM)
python3 cli/quantum_cli.py keygen --algorithm kyber --parameter-set kyber768

# Generate ML-DSA-65 signature key (FIPS 204 name)
python3 cli/quantum_cli.py keygen --algorithm dilithium --parameter-set dilithium3

# Generate SLH-DSA key (FIPS 205 canonical)
python3 cli/quantum_cli.py keygen --algorithm slh-dsa --parameter-set SLH_DSA_PURE_SHA2_128F

# Generate BIKE key (NIST 2025 code-based KEM)
python3 cli/quantum_cli.py keygen --algorithm bike --parameter-set BIKE-L1

# Encrypt / Decrypt
python3 cli/quantum_cli.py encrypt --key-id <KEY_ID> --plaintext "hello"
python3 cli/quantum_cli.py decrypt --key-id <KEY_ID> --ciphertext '<JSON>'

# Sign / Verify
python3 cli/quantum_cli.py sign --key-id <KEY_ID> --message "hello"

# Governance
python3 cli/quantum_cli.py lifecycle --key-id <KEY_ID>
python3 cli/quantum_cli.py simulate --key-id <KEY_ID> --horizon-years 50
python3 cli/quantum_cli.py policy-drift
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/keygen` | POST | Generate PQC key with policy validation |
| `/api/encrypt` | POST | KEM encapsulation + AES-256-GCM |
| `/api/decrypt` | POST | KEM decapsulation + AES-256-GCM |
| `/api/sign` | POST | Post-quantum digital signature |
| `/api/verify` | POST | Signature verification |
| `/api/keys` | GET | List all governed keys |
| `/api/keys/{id}/status` | GET | Key lifecycle status |
| `/api/keys/{id}/simulation` | GET | 50-year quantum risk projection |
| `/api/keys/{id}/migration` | GET | Migration severity + recommendation |
| `/api/keys/{id}/replay` | GET | Deterministic audit replay |
| `/api/policy-drift` | GET | System-wide governance drift analysis |
| `/api/telemetry/system` | GET | System-wide telemetry snapshot |
| `/api/anomalies/scan` | GET | Deterministic anomaly detection |
| `/api/algorithms/supported` | GET | Live liboqs mechanism list |
| `/health` | GET | Backend health check |

Full interactive docs at `/docs` (Swagger UI).

---

## Benchmarks

Run the NeurIPS-style benchmark harness:

```bash
# Full benchmark (500 iterations, ~45 min)
python3 benchmark_harness.py --iterations 500 --output results_paper/

# Governance overhead analysis (raw liboqs vs Q-SENTRY API)
python3 benchmark_overhead.py --iterations 500 --output results_paper/

# Quick sanity check (50 iterations, ~5 min)
python3 benchmark_harness.py --quick --output results_quick/
```

Outputs: `results.json`, `results.md`, `tables.tex` (LaTeX tables for paper).

---

## Project Structure

```
QuantumResistantCryptographySDK/
├── backend/
│   ├── api/                    # FastAPI route handlers
│   │   ├── algorithms.py       # Live liboqs mechanism introspection
│   │   ├── encrypt_api.py      # KEM encrypt/decrypt
│   │   ├── sign_api.py         # Sign/verify (all families)
│   │   ├── keys.py             # Key lifecycle management
│   │   └── ...
│   ├── key_management/
│   │   ├── keygen.py           # Key generation + PARAM_MAP (53 schemes)
│   │   ├── registry.py         # Scheme profiles + quantum break estimates
│   │   └── rotation.py         # Key rotation engine
│   ├── policy/
│   │   ├── nist_pqc.py         # NIST policy matrix + risk scoring
│   │   ├── parameter_validation.py  # Scheme normalization
│   │   └── security_store.py   # Audit log dual-write
│   ├── telemetry/
│   │   ├── audit_log.py        # Append-only JSONL
│   │   └── replay.py           # Deterministic replay engine
│   ├── simulations/
│   │   └── simulations.py      # 50-year migration projection
│   ├── crypto_core_rust/       # Rust crypto binary + bridge
│   ├── Dockerfile              # liboqs 0.15.0 from source
│   └── main.py                 # FastAPI app
├── frontend/dashboard/
│   └── src/
│       ├── pages/              # Dashboard, Crypto, Algorithms, CLI, HowItWorks...
│       ├── components/         # KeyExplorer, PolicyDrift, Simulation...
│       └── services/           # API client layer
├── cli/
│   └── quantum_cli.py          # Full CLI interface
├── benchmark_harness.py        # NeurIPS Tables I-IV
├── benchmark_overhead.py       # NeurIPS Table V (governance overhead)
├── benchmark_rust.py           # Rust bridge analysis
└── docker-compose.yml
```

---

## Algorithm Selection Guide

| Use case | Recommended |
|----------|-------------|
| Key exchange / encryption | `kyber768` (ML-KEM-768) |
| Digital signatures | `dilithium3` (ML-DSA-65) |
| Smallest signatures | `falcon512` |
| Maximum conservative security | `sphincs-sha2-128s` |
| FIPS 205 canonical (future-proof) | `SLH_DSA_PURE_SHA2_128F` |
| Code-based KEM diversity | `BIKE-L1` |
| 256-bit security level | `kyber1024` + `dilithium5` |
| IoT / embedded / certificates | `falcon-padded-512` |
| Long-term archival (50yr+) | `kyber1024` + `falcon1024` |
| Distrust lattice assumptions | `sphincs-sha2-256f` (hash only) |

---

## Security Notes

- **Private keys never leave the process** — generation always via Python/liboqs, never subprocess
- **All operations are audit-logged** — append-only JSONL with fsync
- **Policy enforced at every operation** — blocked keys cannot be used
- **Governance is deterministic** — no ML models, no probabilistic inference
- **Classical algorithms blocked** — RSA/ECC cannot be used for active crypto operations

---

## Citation

```bibtex
@article{qsentry2026,
  title={Q-SENTRY: An AI Governance-Driven Framework for Post-Quantum Cryptographic Infrastructure},
  author={Carp, Darryl},
  journal={Under submission},
  year={2026}
}
```

---

## License

MIT License — see [LICENSE](LICENSE)

---

*Q-SENTRY — Cryptographic assets as continuously governed operational entities.*