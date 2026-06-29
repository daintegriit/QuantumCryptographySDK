import { FaAtom, FaShieldAlt, FaKey, FaPen, FaLayerGroup, FaSync, FaChartLine, FaFlask, FaLock, FaCheckCircle, FaExclamationTriangle, FaBolt, FaServer, FaCog, FaScroll, FaCode, FaTerminal, FaEye } from "react-icons/fa";

const SECTION_ICONS = {
  "1": <FaAtom />, "2": <FaShieldAlt />, "3": <FaKey />, "4": <FaPen />,
  "5": <FaLayerGroup />, "6": <FaSync />, "7": <FaChartLine />, "8": <FaFlask />, "9": <FaLock />,
};

const COLOR_HEX = {
  cyan: "var(--accent)", purple: "#a78bfa", orange: "#fb923c",
  green: "#4ade80", yellow: "#facc15", red: "#f87171", gray: "#9ca3af",
};

export default function HowItWorksPage() {
  return (
    <div className="space-y-12 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <FaAtom style={{ color: "var(--accent)" }} /> How It Works
        </h1>
        <p className="mt-1" style={{ color: "var(--text-muted)" }}>
          A plain-language explanation of post-quantum cryptography, why it matters, and how QuantumShield implements it end-to-end.
        </p>
      </div>

      <Section n="1" title="The Quantum Threat" color="red">
        <p style={{ color: "var(--text-muted)" }}>Classical computers secure the internet using hard math problems — factoring large numbers (RSA) or solving discrete logarithms (ECC). These problems take billions of years on today's computers.</p>
        <p className="mt-3" style={{ color: "var(--text-muted)" }}>Quantum computers running <strong className="text-red-400">Shor's Algorithm</strong> can solve these problems in hours.</p>
        <Callout type="danger"><strong>Harvest Now, Decrypt Later:</strong> Adversaries are already recording encrypted traffic today to decrypt it once quantum computers arrive. Data encrypted with RSA/ECC is already compromised if it needs to remain secret beyond ~2030–2035.</Callout>
      </Section>

      <Section n="2" title="Post-Quantum Cryptography" color="cyan">
        <p style={{ color: "var(--text-muted)" }}>Post-quantum cryptography (PQC) uses mathematical problems that are hard for <em>both</em> classical and quantum computers. NIST standardized four algorithms in 2024:</p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "ML-KEM (Kyber)",     fips: "FIPS 203", use: "Key exchange & encryption", color: "cyan" },
            { name: "ML-DSA (Dilithium)", fips: "FIPS 204", use: "Digital signatures",         color: "purple" },
            { name: "SLH-DSA (SPHINCS+)", fips: "FIPS 205", use: "Hash-based signatures",      color: "green" },
            { name: "FN-DSA (Falcon)",    fips: "FIPS 206", use: "Compact signatures",          color: "orange" },
          ].map(({ name, fips, use, color }) => (
            <div key={name} className="p-4 rounded-xl" style={{ background: "var(--panel)", border: `1px solid ${COLOR_HEX[color]}30` }}>
              <div className="font-semibold text-sm flex items-center gap-2" style={{ color: COLOR_HEX[color] }}><FaShieldAlt className="text-xs" />{name}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{fips}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{use}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section n="3" title="How Key Encapsulation (KEM) Works" color="cyan">
        <p style={{ color: "var(--text-muted)" }}>KEM replaces RSA encryption. Instead of encrypting data directly with a public key, it establishes a shared secret both parties use to derive a symmetric key (AES-256).</p>
        <div className="mt-6 space-y-3">
          {[
            { step: "1", actor: "Sender",    action: "Generates keypair → shares public key",                                  color: "gray" },
            { step: "2", actor: "Encryptor", action: "Runs KEM Encapsulate(public_key) → gets (ciphertext, shared_secret)",    color: "cyan" },
            { step: "3", actor: "Encryptor", action: "Encrypts message with AES-256(shared_secret) → sends ciphertext",        color: "cyan" },
            { step: "4", actor: "Receiver",  action: "Runs KEM Decapsulate(private_key, ciphertext) → recovers shared_secret", color: "green" },
            { step: "5", actor: "Receiver",  action: "Decrypts with AES-256(shared_secret) → recovers plaintext",              color: "green" },
          ].map(({ step, actor, action, color }) => (
            <div key={step} className="flex gap-4 items-start">
              <div className="shrink-0 w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold"
                style={{ background: `${COLOR_HEX[color]}20`, color: COLOR_HEX[color] }}>{step}</div>
              <div className="flex-1 text-sm">
                <span className="font-semibold" style={{ color: COLOR_HEX[color] }}>{actor}: </span>
                <span style={{ color: "var(--text-muted)" }}>{action}</span>
              </div>
            </div>
          ))}
        </div>
        <Callout type="info">QuantumShield uses <strong style={{ color: "var(--accent)" }}>Kyber (ML-KEM)</strong> for KEM operations, with AES-256-GCM for the symmetric layer. The Rust crypto core handles encapsulation/decapsulation at ~27,000 operations/second.</Callout>
      </Section>

      <Section n="4" title="How Digital Signatures Work" color="purple">
        <p style={{ color: "var(--text-muted)" }}>Signatures prove authenticity and integrity — that a message came from who it claims, and hasn't been tampered with.</p>
        <div className="mt-6 space-y-3">
          {[
            { step: "1", actor: "Signer",   action: "Generates keypair → shares public key",                    color: "gray" },
            { step: "2", actor: "Signer",   action: "Runs Sign(private_key, message) → produces signature",     color: "purple" },
            { step: "3", actor: "Signer",   action: "Sends: message + signature",                               color: "purple" },
            { step: "4", actor: "Verifier", action: "Runs Verify(public_key, message, signature) → true/false", color: "green" },
          ].map(({ step, actor, action, color }) => (
            <div key={step} className="flex gap-4 items-start">
              <div className="shrink-0 w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold"
                style={{ background: `${COLOR_HEX[color]}20`, color: COLOR_HEX[color] }}>{step}</div>
              <div className="flex-1 text-sm">
                <span className="font-semibold" style={{ color: COLOR_HEX[color] }}>{actor}: </span>
                <span style={{ color: "var(--text-muted)" }}>{action}</span>
              </div>
            </div>
          ))}
        </div>
        <Callout type="info">QuantumShield supports <strong className="text-purple-400">Dilithium (ML-DSA)</strong>, <strong className="text-orange-400">Falcon</strong>, and <strong className="text-green-400">SPHINCS+</strong> for signatures.</Callout>
      </Section>

      <Section n="5" title="QuantumShield Architecture" color="green">
        <p style={{ color: "var(--text-muted)" }}>QuantumShield is a multi-layer cryptographic governance platform:</p>
        <div className="mt-6 space-y-2">
          {[
            { layer: "Rust Crypto Core",      desc: "High-performance cryptographic operations via liboqs bindings. Handles KEM encap/decap, sign/verify at hardware speed.", color: "orange", icon: <FaBolt /> },
            { layer: "Python/FastAPI Backend", desc: "Governance layer — key lifecycle, policy enforcement, audit logging, telemetry, anomaly detection, migration planning.", color: "cyan",   icon: <FaServer /> },
            { layer: "Policy Engine",          desc: "NIST-aligned policy matrix evaluates every key against allowed schemes, security levels, and longevity requirements.",   color: "purple", icon: <FaCog /> },
            { layer: "Audit Log",              desc: "Append-only JSONL audit trail records every crypto operation. Used for telemetry, replay, anomaly detection, and compliance.", color: "yellow", icon: <FaScroll /> },
            { layer: "React Dashboard",        desc: "Governance console — key explorer, risk summary, policy drift, simulations, explainability, audit replay.",               color: "green",  icon: <FaCode /> },
            { layer: "CLI",                    desc: "Full command-line interface for all crypto operations, lifecycle management, and governance.",                             color: "gray",   icon: <FaTerminal /> },
          ].map(({ layer, desc, color, icon }) => (
            <div key={layer} className="p-4 rounded-xl flex gap-4" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
              <div className="shrink-0 mt-0.5" style={{ color: COLOR_HEX[color] }}>{icon}</div>
              <div>
                <div className="text-sm font-semibold" style={{ color: COLOR_HEX[color] }}>{layer}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n="6" title="Key Lifecycle" color="yellow">
        <p style={{ color: "var(--text-muted)" }}>Every cryptographic key has a lifecycle. QuantumShield tracks and enforces it automatically.</p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { phase: "Generation",   desc: "Key generated with policy check. Algorithm, parameter set, and longevity validated against NIST standards.", icon: <FaKey />,              color: "cyan" },
            { phase: "Active",       desc: "Key in use for crypto operations. All usage events logged to immutable audit trail.",                        icon: <FaCheckCircle />,      color: "green" },
            { phase: "Monitor",      desc: "Key approaching quantum safety margin. Rotation or migration planning recommended.",                          icon: <FaEye />,              color: "yellow" },
            { phase: "Migrate Soon", desc: "Quantum break year within safety margin. Migration to stronger key is required.",                            icon: <FaExclamationTriangle />, color: "orange" },
            { phase: "Superseded",   desc: "Key replaced by rotation or migration. Retained for audit and decryption of historical data.",               icon: <FaSync />,             color: "gray" },
            { phase: "Emergency",    desc: "Key is at or past estimated quantum break year. Immediate action required.",                                 icon: <FaBolt />,             color: "red" },
          ].map(({ phase, desc, icon, color }) => (
            <div key={phase} className="p-4 rounded-xl" style={{ background: "var(--panel)", border: `1px solid ${COLOR_HEX[color]}30` }}>
              <div className="text-xl mb-2" style={{ color: COLOR_HEX[color] }}>{icon}</div>
              <div className="text-sm font-semibold" style={{ color: COLOR_HEX[color] }}>{phase}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section n="7" title="Policy Drift Detection" color="purple">
        <p style={{ color: "var(--text-muted)" }}>Policy drift is the silent degradation of cryptographic governance over time — rising denial rates, new unapproved schemes appearing, or keys going unrotated.</p>
        <p className="mt-3" style={{ color: "var(--text-muted)" }}>QuantumShield compares a baseline window against a recent window. If deny rates rise, new schemes appear, or rotation frequency drops, drift is flagged before it becomes a compliance failure.</p>
        <Callout type="warn">Policy drift is often invisible until an audit. QuantumShield surfaces it continuously so governance teams can act before regulators do.</Callout>
      </Section>

      <Section n="8" title="Quantum Safety Simulation" color="cyan">
        <p style={{ color: "var(--text-muted)" }}>The simulation engine projects each key's cryptographic durability year-by-year based on estimated quantum break timelines from the NIST PQC registry.</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { label: "SAFE",         desc: "Quantum break year far in future",  color: "green" },
            { label: "MONITOR",      desc: "Within 15 years of break estimate", color: "yellow" },
            { label: "MIGRATE SOON", desc: "Within safety margin years",        color: "orange" },
            { label: "BROKEN",       desc: "Past estimated quantum break year", color: "red" },
          ].map(({ label, desc, color }) => (
            <div key={label} className="p-3 rounded-xl" style={{ background: `${COLOR_HEX[color]}10`, border: `1px solid ${COLOR_HEX[color]}30` }}>
              <div className="font-semibold" style={{ color: COLOR_HEX[color] }}>{label}</div>
              <div className="mt-1" style={{ color: "var(--text-muted)" }}>{desc}</div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>Simulation scenarios: Conservative (2035), Baseline (2040), Aggressive (2030), Breakthrough (2028).</p>
      </Section>

      <Section n="9" title="Security Model & Guarantees" color="green">
        <div className="space-y-3">
          {[
            { claim: "Private keys never leave the process",  detail: "Key generation always uses Python/liboqs. Private keys are stored encrypted at rest and never passed through subprocess calls or API responses.", ok: true },
            { claim: "All crypto ops are audit-logged",       detail: "Every keygen, encrypt, decrypt, sign, verify event is written to an append-only JSONL audit log with timestamp, key_id, scheme, and metadata.", ok: true },
            { claim: "Policy is enforced at every operation", detail: "Every crypto operation checks the key against the NIST policy matrix. Blocked keys cannot be used for encryption or signing.", ok: true },
            { claim: "No probabilistic inference",            detail: "Governance explanations and anomaly detection are deterministic — derived entirely from audit logs and policy rules, not ML models.", ok: true },
            { claim: "Rust crypto core for performance",      detail: "KEM encap/decap and sign/verify run through the Rust binary via subprocess bridge. Python fallback always available.", ok: true },
            { claim: "Classical algorithms not recommended",  detail: "RSA and ECC keys can be created for migration baseline comparison, but the policy engine blocks them from active crypto use.", ok: false },
          ].map(({ claim, detail, ok }) => (
            <div key={claim} className="p-4 rounded-xl flex gap-3" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
              <span className="shrink-0 text-lg" style={{ color: ok ? "#4ade80" : "#facc15" }}>
                {ok ? <FaCheckCircle /> : <FaExclamationTriangle />}
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{claim}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ n, title, color, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full text-sm flex items-center justify-center font-bold shrink-0"
          style={{ background: `${COLOR_HEX[color]}20`, color: COLOR_HEX[color] }}>
          {SECTION_ICONS[n]}
        </div>
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      <div className="pl-11">{children}</div>
    </div>
  );
}

function Callout({ type, children }) {
  const styles = {
    info:   { border: "rgba(6,182,212,0.3)",   bg: "rgba(6,182,212,0.05)",   color: "var(--accent)", icon: <FaShieldAlt /> },
    warn:   { border: "rgba(250,204,21,0.3)",  bg: "rgba(250,204,21,0.05)",  color: "#facc15",        icon: <FaExclamationTriangle /> },
    danger: { border: "rgba(239,68,68,0.3)",   bg: "rgba(239,68,68,0.05)",   color: "#f87171",        icon: <FaBolt /> },
  };
  const s = styles[type];
  return (
    <div className="mt-4 p-4 rounded-xl border text-sm flex gap-3"
      style={{ borderColor: s.border, background: s.bg, color: s.color }}>
      <span className="shrink-0 mt-0.5">{s.icon}</span>
      <div>{children}</div>
    </div>
  );
}
