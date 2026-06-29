import { useEffect, useState } from "react";
import { FaTerminal, FaCheckCircle, FaCopy, FaDownload, FaDocker, FaCog } from "react-icons/fa";
import { apiGet } from "../services/apiClient";

const CLI_COMMANDS = [
  { group: "Key Generation — KEM (Encryption)", commands: [
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm kyber --parameter-set kyber512",           desc: "Kyber-512 / ML-KEM-512 (128-bit)",              label: "kg-k512" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm kyber --parameter-set kyber768",           desc: "Kyber-768 / ML-KEM-768 (192-bit) ★ recommended", label: "kg-k768" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm kyber --parameter-set kyber1024",          desc: "Kyber-1024 / ML-KEM-1024 (256-bit)",            label: "kg-k1024" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm frodokem --parameter-set frodokem-640-aes",   desc: "FrodoKEM-640-AES (128-bit, conservative)",  label: "kg-f640" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm frodokem --parameter-set frodokem-976-shake", desc: "FrodoKEM-976-SHAKE (192-bit, conservative)", label: "kg-f976" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm frodokem --parameter-set frodokem-1344-aes",  desc: "FrodoKEM-1344-AES (256-bit, max security)",  label: "kg-f1344" },
  ]},
  { group: "Key Generation — Signatures", commands: [
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm dilithium --parameter-set dilithium2",     desc: "Dilithium-2 / ML-DSA-44 (128-bit)",             label: "kg-d2" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm dilithium --parameter-set dilithium3",     desc: "Dilithium-3 / ML-DSA-65 (192-bit) ★ recommended", label: "kg-d3" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm dilithium --parameter-set dilithium5",     desc: "Dilithium-5 / ML-DSA-87 (256-bit)",             label: "kg-d5" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm falcon --parameter-set falcon512",         desc: "Falcon-512 (128-bit, smallest sigs)",           label: "kg-f512" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm falcon --parameter-set falcon1024",        desc: "Falcon-1024 (256-bit)",                         label: "kg-f1024" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm falcon --parameter-set falcon-padded-512", desc: "Falcon-padded-512 (constant-time)",             label: "kg-fp512" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm sphincs --parameter-set sphincs-sha2-128f", desc: "SPHINCS+-SHA2-128f (hash-based, conservative)", label: "kg-s128f" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm sphincs --parameter-set sphincs-sha2-128s", desc: "SPHINCS+-SHA2-128s (smallest SPHINCS+ sig)",    label: "kg-s128s" },
    { cmd: "python3 cli/quantum_cli.py keygen --algorithm sphincs --parameter-set sphincs-sha2-256f", desc: "SPHINCS+-SHA2-256f (256-bit, hash-based)",      label: "kg-s256f" },
  ]},
  { group: "Encryption & Decryption", commands: [
    { cmd: 'python3 cli/quantum_cli.py encrypt --key-id <KEY_ID> --plaintext "hello world"', desc: "Encrypt plaintext with a KEM key",           label: "enc" },
    { cmd: "python3 cli/quantum_cli.py decrypt --key-id <KEY_ID> --ciphertext '<JSON>'",     desc: "Decrypt ciphertext (paste JSON from encrypt)", label: "dec" },
  ]},
  { group: "Signing & Verification", commands: [
    { cmd: 'python3 cli/quantum_cli.py sign --key-id <KEY_ID> --message "hello"',                     desc: "Sign a message",     label: "sign" },
    { cmd: 'python3 cli/quantum_cli.py verify --key-id <KEY_ID> --message "hello" --signature <SIG>', desc: "Verify a signature", label: "verify" },
  ]},
  { group: "Lifecycle & Governance", commands: [
    { cmd: "python3 cli/quantum_cli.py lifecycle --key-id <KEY_ID>",                   desc: "View key lifecycle and migration status", label: "lifecycle" },
    { cmd: "python3 cli/quantum_cli.py simulate --key-id <KEY_ID> --horizon-years 50", desc: "50-year quantum risk simulation",         label: "simulate" },
    { cmd: "python3 cli/quantum_cli.py migrate-check --key-id <KEY_ID>",               desc: "Check migration readiness",              label: "migrate" },
    { cmd: "python3 cli/quantum_cli.py policy-drift",                                  desc: "System-wide policy drift analysis",      label: "drift" },
  ]},
];

export default function CliPage() {
  const [health, setHealth] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    apiGet("/health").then(setHealth).catch(() => setHealth(null));
  }, []);

  function copy(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-10 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <FaTerminal style={{ color: "var(--accent)" }} /> CLI Setup
        </h1>
        <p className="mt-1" style={{ color: "var(--text-muted)" }}>
          Full command-line access to key generation, encryption, signing, lifecycle management,
          and governance for all supported PQC algorithms.
        </p>
      </div>

      {/* Backend status */}
      <div className="rounded-xl p-4 flex items-center gap-3 text-sm"
        style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <span className={`w-2.5 h-2.5 rounded-full ${health ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
        <span style={{ color: "var(--text-muted)" }}>
          Backend: {health ? `Online · v${health.version || "0.1.0"}` : "Offline"}
        </span>
        {health && (
          <span className="ml-auto text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            {health.environment || "docker"}
          </span>
        )}
      </div>

      {/* Prerequisites */}
      <Section title="Prerequisites" icon={<FaCog />}>
        <div className="space-y-2">
          {[
            ["Python",        "3.10+", "python3 --version"],
            ["liboqs-python", "0.10+", "pip show liboqs"],
            ["requests",      "any",   "pip show requests"],
          ].map(([pkg, ver, check]) => (
            <div key={pkg} className="flex items-center justify-between rounded-lg px-4 py-2 text-sm"
              style={{ border: "1px solid var(--border)", background: "var(--input-bg)" }}>
              <div>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{pkg}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>{ver}</span>
              </div>
              <CopyButton text={check} label={pkg} copied={copied} onCopy={copy} />
            </div>
          ))}
        </div>
      </Section>

      {/* Installation */}
      <Section title="Installation" icon={<FaDownload />}>
        <div className="space-y-4">
          <Step n={1} title="Clone the repo">
            <CodeBlock code={"git clone https://github.com/your-org/QuantumResistantCryptographySDK.git\ncd QuantumResistantCryptographySDK"} label="clone" copied={copied} onCopy={copy} />
          </Step>
          <Step n={2} title="Create and activate virtual environment">
            <CodeBlock code={"python3 -m venv oqs-env\nsource oqs-env/bin/activate   # macOS/Linux\n# oqs-env\\Scripts\\activate    # Windows"} label="venv" copied={copied} onCopy={copy} />
          </Step>
          <Step n={3} title="Install dependencies">
            <CodeBlock code="pip install -r backend/requirements.txt" label="pip" copied={copied} onCopy={copy} />
          </Step>
          <Step n={4} title="Verify CLI works">
            <CodeBlock code={"cd backend\npython3 cli/quantum_cli.py --help"} label="verify" copied={copied} onCopy={copy} />
          </Step>
        </div>
      </Section>

      {/* Commands */}
      <Section title="CLI Commands" icon={<FaTerminal />}>
        <div className="space-y-8">
          {CLI_COMMANDS.map((group) => (
            <div key={group.group} className="space-y-2">
              <div className="text-xs uppercase tracking-wide font-semibold pb-1"
                style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                {group.group}
              </div>
              {group.commands.map((item) => (
                <div key={item.label} className="rounded-xl p-3"
                  style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
                  <div className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{item.desc}</div>
                  <div className="flex items-center justify-between gap-4">
                    <code className="text-xs font-mono break-all flex-1" style={{ color: "var(--accent)" }}>{item.cmd}</code>
                    <CopyButton text={item.cmd} label={item.label} copied={copied} onCopy={copy} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* Environment Variables */}
      <Section title="Environment Variables" icon={<FaCog />}>
        <div className="space-y-2">
          {[
            ["QS_API_BASE",          "http://localhost:8008",        "Backend API URL"],
            ["QS_KEYSTORE_DIR",      "_keystore/keys",               "Key storage directory"],
            ["QS_AUDIT_LOG_PATH",    "telemetry/audit_log.jsonl",    "Telemetry/replay audit log"],
            ["QS_AUDIT_POLICY_PATH", "telemetry/audit_policy.jsonl", "Policy audit log"],
          ].map(([key, val, desc]) => (
            <div key={key} className="grid grid-cols-3 gap-4 rounded-lg px-4 py-3 text-xs"
              style={{ border: "1px solid var(--border)", background: "var(--input-bg)" }}>
              <code className="font-mono" style={{ color: "var(--accent)" }}>{key}</code>
              <code className="font-mono" style={{ color: "var(--text-primary)" }}>{val}</code>
              <span style={{ color: "var(--text-muted)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Docker */}
      <Section title="Run with Docker" icon={<FaDocker />}>
        <CodeBlock code="docker compose up --build" label="docker" copied={copied} onCopy={copy} />
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Backend: <code style={{ color: "var(--accent)" }}>http://localhost:8008</code>
          {" · "}
          Dashboard: <code style={{ color: "var(--accent)" }}>http://localhost:3008</code>
        </p>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2 pb-2"
        style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border)" }}>
        <span style={{ color: "var(--accent)" }}>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold"
        style={{ background: "var(--accent-subtle, rgba(6,182,212,0.15))", color: "var(--accent)" }}>
        {n}
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ code, label, copied, onCopy }) {
  return (
    <div className="relative group">
      <pre className="rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre"
        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--accent)" }}>
        {code}
      </pre>
      <button onClick={() => onCopy(code, label)}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded transition opacity-0 group-hover:opacity-100 flex items-center gap-1"
        style={{ background: "var(--accent-subtle, rgba(6,182,212,0.15))", color: "var(--accent)", border: "1px solid var(--border)" }}>
        {copied === label ? <><FaCheckCircle className="text-xs" /> Copied!</> : <><FaCopy className="text-xs" /> Copy</>}
      </button>
    </div>
  );
}

function CopyButton({ text, label, copied, onCopy }) {
  return (
    <button onClick={() => onCopy(text, label)}
      className="shrink-0 text-xs px-2 py-1 rounded transition flex items-center gap-1"
      style={{ background: "var(--accent-subtle, rgba(6,182,212,0.15))", color: "var(--accent)", border: "1px solid var(--border)" }}>
      {copied === label ? <><FaCheckCircle className="text-xs" /> Copied</> : <><FaCopy className="text-xs" /> Copy</>}
    </button>
  );
}
