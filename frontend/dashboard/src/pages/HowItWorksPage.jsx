// src/pages/HowItWorksPage.jsx
import { useTheme } from "../context/ThemeContext";

export default function HowItWorksPage() {
  const { theme } = useTheme();

  return (
    <div className="space-y-12 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${theme.panelTitle}`}>How It Works</h1>
        <p className={theme.mutedText}>
          A plain-language explanation of post-quantum cryptography, why it matters,
          and how QuantumShield implements it end-to-end.
        </p>
      </div>

      {/* 1 — The Threat */}
      <Section theme={theme} n="1" title="The Quantum Threat" color="red">
        <p className={theme.mutedText}>
          Classical computers secure the internet using hard math problems — factoring large numbers (RSA)
          or solving discrete logarithms (ECC). These problems take billions of years on today's computers.
        </p>
        <p className={`${theme.mutedText} mt-3`}>
          Quantum computers running <strong className="text-red-400">Shor's Algorithm</strong> can solve
          these problems in hours. A sufficiently powerful quantum computer would instantly break every
          RSA and ECC key protecting HTTPS, banking, email, and government infrastructure.
        </p>
        <Callout theme={theme} type="danger">
          <strong>Harvest Now, Decrypt Later:</strong> Adversaries are already recording encrypted traffic today
          to decrypt it once quantum computers arrive. Data encrypted with RSA/ECC is already compromised
          if it needs to remain secret beyond ~2030–2035.
        </Callout>
      </Section>

      {/* 2 — The Solution */}
      <Section theme={theme} n="2" title="Post-Quantum Cryptography" color="cyan">
        <p className={theme.mutedText}>
          Post-quantum cryptography (PQC) uses mathematical problems that are hard for
          <em> both</em> classical and quantum computers. NIST ran a decade-long competition
          and standardized four algorithms in 2024:
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "ML-KEM (Kyber)",      fips: "FIPS 203", use: "Key exchange & encryption", color: "cyan" },
            { name: "ML-DSA (Dilithium)",  fips: "FIPS 204", use: "Digital signatures",         color: "purple" },
            { name: "SLH-DSA (SPHINCS+)",  fips: "FIPS 205", use: "Hash-based signatures",      color: "green" },
            { name: "FN-DSA (Falcon)",     fips: "FIPS 206", use: "Compact signatures",          color: "orange" },
          ].map(({ name, fips, use, color }) => (
            <div key={name} className={`${theme.panel} p-4 rounded-xl border border-${color}-500/20`}>
              <div className={`font-semibold text-${color}-400 text-sm`}>{name}</div>
              <div className="text-xs text-gray-500 font-mono">{fips}</div>
              <div className={`text-xs mt-1 ${theme.mutedText}`}>{use}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 3 — KEM: How Encryption Works */}
      <Section theme={theme} n="3" title="How Key Encapsulation (KEM) Works" color="cyan">
        <p className={theme.mutedText}>
          KEM replaces RSA encryption. Instead of encrypting data directly with a public key,
          it establishes a shared secret that both parties use to derive a symmetric key (AES-256).
        </p>
        <div className="mt-6 space-y-3">
          {[
            { step: "1", actor: "Sender",    action: "Generates keypair → shares public key",                                        color: "gray" },
            { step: "2", actor: "Encryptor", action: "Runs KEM Encapsulate(public_key) → gets (ciphertext, shared_secret)",          color: "cyan" },
            { step: "3", actor: "Encryptor", action: "Encrypts message with AES-256(shared_secret) → sends ciphertext",              color: "cyan" },
            { step: "4", actor: "Receiver",  action: "Runs KEM Decapsulate(private_key, ciphertext) → recovers shared_secret",       color: "green" },
            { step: "5", actor: "Receiver",  action: "Decrypts with AES-256(shared_secret) → recovers plaintext",                    color: "green" },
          ].map(({ step, actor, action, color }) => (
            <div key={step} className="flex gap-4 items-start">
              <div className={`shrink-0 w-7 h-7 rounded-full bg-${color}-500/20 text-${color}-400 text-xs flex items-center justify-center font-bold`}>
                {step}
              </div>
              <div className="flex-1 text-sm">
                <span className={`font-semibold text-${color}-400`}>{actor}: </span>
                <span className={theme.mutedText}>{action}</span>
              </div>
            </div>
          ))}
        </div>
        <Callout theme={theme} type="info">
          QuantumShield uses <strong className="text-cyan-400">Kyber (ML-KEM)</strong> for KEM operations,
          with AES-256-GCM for the symmetric layer. The Rust crypto core handles encapsulation/decapsulation
          at ~27,000 operations/second.
        </Callout>
      </Section>

      {/* 4 — Signatures */}
      <Section theme={theme} n="4" title="How Digital Signatures Work" color="purple">
        <p className={theme.mutedText}>
          Signatures prove authenticity and integrity — that a message came from who it claims,
          and hasn't been tampered with. Post-quantum signatures replace RSA-PSS and ECDSA.
        </p>
        <div className="mt-6 space-y-3">
          {[
            { step: "1", actor: "Signer",   action: "Generates keypair → shares public key",                         color: "gray" },
            { step: "2", actor: "Signer",   action: "Runs Sign(private_key, message) → produces signature",          color: "purple" },
            { step: "3", actor: "Signer",   action: "Sends: message + signature",                                     color: "purple" },
            { step: "4", actor: "Verifier", action: "Runs Verify(public_key, message, signature) → true/false",      color: "green" },
          ].map(({ step, actor, action, color }) => (
            <div key={step} className="flex gap-4 items-start">
              <div className={`shrink-0 w-7 h-7 rounded-full bg-${color}-500/20 text-${color}-400 text-xs flex items-center justify-center font-bold`}>
                {step}
              </div>
              <div className="flex-1 text-sm">
                <span className={`font-semibold text-${color}-400`}>{actor}: </span>
                <span className={theme.mutedText}>{action}</span>
              </div>
            </div>
          ))}
        </div>
        <Callout theme={theme} type="info">
          QuantumShield supports <strong className="text-purple-400">Dilithium (ML-DSA)</strong>,
          <strong className="text-orange-400"> Falcon</strong>, and
          <strong className="text-green-400"> SPHINCS+</strong> for signatures.
          Dilithium is recommended for most use cases. Falcon for size-constrained environments.
          SPHINCS+ when you want hash-only security assumptions.
        </Callout>
      </Section>

      {/* 5 — Architecture */}
      <Section theme={theme} n="5" title="QuantumShield Architecture" color="green">
        <p className={theme.mutedText}>
          QuantumShield is a multi-layer cryptographic governance platform:
        </p>
        <div className="mt-6 space-y-2">
          {[
            { layer: "Rust Crypto Core",    desc: "High-performance cryptographic operations via liboqs bindings. Handles KEM encap/decap, sign/verify at hardware speed.", color: "orange" },
            { layer: "Python/FastAPI Backend", desc: "Governance layer — key lifecycle, policy enforcement, audit logging, telemetry, anomaly detection, migration planning.", color: "cyan" },
            { layer: "Policy Engine",       desc: "NIST-aligned policy matrix evaluates every key against allowed schemes, security levels, and longevity requirements.", color: "purple" },
            { layer: "Audit Log",           desc: "Append-only JSONL audit trail records every crypto operation. Used for telemetry, replay, anomaly detection, and compliance.", color: "yellow" },
            { layer: "React Dashboard",     desc: "Governance console — key explorer, risk summary, policy drift, simulations, explainability, audit replay.", color: "green" },
            { layer: "CLI",                 desc: "Full command-line interface for all crypto operations, lifecycle management, and governance.", color: "gray" },
          ].map(({ layer, desc, color }) => (
            <div key={layer} className={`${theme.panel} p-4 rounded-xl flex gap-4`}>
              <div className={`shrink-0 w-2 rounded-full bg-${color}-500/60`} />
              <div>
                <div className={`text-sm font-semibold text-${color}-400`}>{layer}</div>
                <div className={`text-xs mt-1 ${theme.mutedText}`}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 6 — Key Lifecycle */}
      <Section theme={theme} n="6" title="Key Lifecycle" color="yellow">
        <p className={theme.mutedText}>
          Every cryptographic key has a lifecycle. QuantumShield tracks and enforces it automatically.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { phase: "Generation",  desc: "Key generated with policy check. Algorithm, parameter set, and longevity validated against NIST standards.", icon: "🔑", color: "cyan" },
            { phase: "Active",      desc: "Key in use for crypto operations. All usage events logged to immutable audit trail.", icon: "✅", color: "green" },
            { phase: "Monitor",     desc: "Key approaching quantum safety margin. Rotation or migration planning recommended.", icon: "👁️", color: "yellow" },
            { phase: "Migrate Soon", desc: "Quantum break year within safety margin. Migration to stronger key is required.", icon: "⚠️", color: "orange" },
            { phase: "Superseded",  desc: "Key replaced by rotation or migration. Retained for audit and decryption of historical data.", icon: "🔁", color: "gray" },
            { phase: "Emergency",   desc: "Key is at or past estimated quantum break year. Immediate action required.", icon: "🚨", color: "red" },
          ].map(({ phase, desc, icon, color }) => (
            <div key={phase} className={`${theme.panel} p-4 rounded-xl border border-${color}-500/20`}>
              <div className="text-2xl mb-2">{icon}</div>
              <div className={`text-sm font-semibold text-${color}-400`}>{phase}</div>
              <div className={`text-xs mt-1 ${theme.mutedText}`}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 7 — Policy Drift */}
      <Section theme={theme} n="7" title="Policy Drift Detection" color="purple">
        <p className={theme.mutedText}>
          Policy drift is the silent degradation of cryptographic governance over time —
          rising denial rates, new unapproved schemes appearing, or keys going unrotated.
        </p>
        <p className={`${theme.mutedText} mt-3`}>
          QuantumShield compares a baseline window (e.g. last 90 days) against a recent window
          (e.g. last 14 days). If deny rates rise, new schemes appear, or rotation frequency drops,
          drift is flagged before it becomes a compliance failure.
        </p>
        <Callout theme={theme} type="warn">
          Policy drift is often invisible until an audit. QuantumShield surfaces it continuously
          so governance teams can act before regulators do.
        </Callout>
      </Section>

      {/* 8 — Quantum Safety Simulation */}
      <Section theme={theme} n="8" title="Quantum Safety Simulation" color="cyan">
        <p className={theme.mutedText}>
          The simulation engine projects each key's cryptographic durability year-by-year
          based on estimated quantum break timelines from the NIST PQC registry.
        </p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { label: "SAFE",         desc: "Quantum break year far in future",       color: "green" },
            { label: "MONITOR",      desc: "Within 15 years of break estimate",      color: "yellow" },
            { label: "MIGRATE SOON", desc: "Within safety margin years",             color: "orange" },
            { label: "BROKEN",       desc: "Past estimated quantum break year",      color: "red" },
          ].map(({ label, desc, color }) => (
            <div key={label} className={`p-3 rounded-xl bg-${color}-500/10 border border-${color}-500/30`}>
              <div className={`font-semibold text-${color}-400`}>{label}</div>
              <div className="text-gray-500 mt-1">{desc}</div>
            </div>
          ))}
        </div>
        <p className={`${theme.mutedText} text-xs mt-4`}>
          Simulation scenarios: Conservative (quantum arrives 2035), Baseline (2040),
          Aggressive (2030), Breakthrough (2028). Run via Simulations page or CLI.
        </p>
      </Section>

      {/* 9 — Security Model */}
      <Section theme={theme} n="9" title="Security Model & Guarantees" color="green">
        <div className="space-y-3">
          {[
            { claim: "Private keys never leave the process",   detail: "Key generation always uses Python/liboqs. Private keys are stored encrypted at rest and never passed through subprocess calls or API responses.", ok: true },
            { claim: "All crypto ops are audit-logged",        detail: "Every keygen, encrypt, decrypt, sign, verify event is written to an append-only JSONL audit log with timestamp, key_id, scheme, and metadata.", ok: true },
            { claim: "Policy is enforced at every operation",  detail: "Every crypto operation checks the key against the NIST policy matrix. Blocked keys cannot be used for encryption or signing.", ok: true },
            { claim: "No probabilistic inference",             detail: "Governance explanations and anomaly detection are deterministic — derived entirely from audit logs and policy rules, not ML models.", ok: true },
            { claim: "Rust crypto core for performance",       detail: "KEM encap/decap and sign/verify run through the Rust binary via subprocess bridge. Python fallback always available if Rust is unavailable.", ok: true },
            { claim: "Classical algorithms not recommended",   detail: "RSA and ECC keys can be created for migration baseline comparison, but the policy engine blocks them from active crypto use.", ok: false },
          ].map(({ claim, detail, ok }) => (
            <div key={claim} className={`${theme.panel} p-4 rounded-xl flex gap-3`}>
              <span className={`shrink-0 text-lg ${ok ? "text-green-400" : "text-yellow-400"}`}>
                {ok ? "✓" : "⚠"}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-200">{claim}</div>
                <div className={`text-xs mt-1 ${theme.mutedText}`}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function Section({ theme, n, title, color, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full bg-${color}-500/20 text-${color}-400 text-sm flex items-center justify-center font-bold shrink-0`}>
          {n}
        </div>
        <h2 className={`text-lg font-bold ${theme.panelTitle}`}>{title}</h2>
      </div>
      <div className={`pl-11`}>{children}</div>
    </div>
  );
}

function Callout({ theme, type, children }) {
  const styles = {
    info:   "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
    warn:   "border-yellow-500/30 bg-yellow-500/5 text-yellow-300",
    danger: "border-red-500/30 bg-red-500/5 text-red-300",
  };
  return (
    <div className={`mt-4 p-4 rounded-xl border text-sm ${styles[type]}`}>
      {children}
    </div>
  );
}