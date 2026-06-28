// src/pages/CliPage.jsx
import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { apiGet } from "../services/apiClient";

const CLI_COMMANDS = [
  // ── Key Generation ──────────────────────────────────────
  { group: "Key Generation — KEM (Encryption)",
    commands: [
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm kyber --parameter-set kyber512",          desc: "Kyber-512 / ML-KEM-512 (128-bit)",    label: "kg-k512" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm kyber --parameter-set kyber768",          desc: "Kyber-768 / ML-KEM-768 (192-bit) ★ recommended", label: "kg-k768" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm kyber --parameter-set kyber1024",         desc: "Kyber-1024 / ML-KEM-1024 (256-bit)",  label: "kg-k1024" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm frodokem --parameter-set frodokem-640-aes",   desc: "FrodoKEM-640-AES (128-bit, conservative)", label: "kg-f640" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm frodokem --parameter-set frodokem-976-shake", desc: "FrodoKEM-976-SHAKE (192-bit, conservative)", label: "kg-f976" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm frodokem --parameter-set frodokem-1344-aes",  desc: "FrodoKEM-1344-AES (256-bit, max security)", label: "kg-f1344" },
    ],
  },
  { group: "Key Generation — Signatures",
    commands: [
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm dilithium --parameter-set dilithium2",    desc: "Dilithium-2 / ML-DSA-44 (128-bit)",   label: "kg-d2" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm dilithium --parameter-set dilithium3",    desc: "Dilithium-3 / ML-DSA-65 (192-bit) ★ recommended", label: "kg-d3" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm dilithium --parameter-set dilithium5",    desc: "Dilithium-5 / ML-DSA-87 (256-bit)",   label: "kg-d5" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm falcon --parameter-set falcon512",        desc: "Falcon-512 (128-bit, smallest sigs)",  label: "kg-f512" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm falcon --parameter-set falcon1024",       desc: "Falcon-1024 (256-bit)",                label: "kg-f1024" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm falcon --parameter-set falcon-padded-512",  desc: "Falcon-padded-512 (constant-time)",  label: "kg-fp512" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm falcon --parameter-set falcon-padded-1024", desc: "Falcon-padded-1024 (constant-time)", label: "kg-fp1024" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm sphincs --parameter-set sphincs-sha2-128f", desc: "SPHINCS+-SHA2-128f (hash-based, conservative)", label: "kg-s128f" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm sphincs --parameter-set sphincs-sha2-128s", desc: "SPHINCS+-SHA2-128s (smallest SPHINCS+ sig)", label: "kg-s128s" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm sphincs --parameter-set sphincs-sha2-256f", desc: "SPHINCS+-SHA2-256f (256-bit, hash-based)", label: "kg-s256f" },
      { cmd: "python3 cli/quantum_cli.py keygen --algorithm sphincs --parameter-set sphincs-shake-128f","desc": "SPHINCS+-SHAKE-128f (SHAKE variant)", label: "kg-ss128f" },
    ],
  },
  // ── Crypto Operations ───────────────────────────────────
  { group: "Encryption & Decryption",
    commands: [
      { cmd: 'python3 cli/quantum_cli.py encrypt --key-id <KEY_ID> --plaintext "hello world"', desc: "Encrypt plaintext with a KEM key",    label: "enc" },
      { cmd: "python3 cli/quantum_cli.py decrypt --key-id <KEY_ID> --ciphertext '<JSON>'",     desc: "Decrypt ciphertext (paste JSON from encrypt)", label: "dec" },
    ],
  },
  { group: "Signing & Verification",
    commands: [
      { cmd: 'python3 cli/quantum_cli.py sign --key-id <KEY_ID> --message "hello"',                    desc: "Sign a message",         label: "sign" },
      { cmd: 'python3 cli/quantum_cli.py verify --key-id <KEY_ID> --message "hello" --signature <SIG>', desc: "Verify a signature",     label: "verify" },
    ],
  },
  // ── Governance ──────────────────────────────────────────
  { group: "Lifecycle & Governance",
    commands: [
      { cmd: "python3 cli/quantum_cli.py lifecycle --key-id <KEY_ID>",                  desc: "View key lifecycle and migration status",  label: "lifecycle" },
      { cmd: "python3 cli/quantum_cli.py simulate --key-id <KEY_ID> --horizon-years 50",desc: "50-year quantum risk simulation",          label: "simulate" },
      { cmd: "python3 cli/quantum_cli.py migrate-check --key-id <KEY_ID>",              desc: "Check migration readiness",               label: "migrate" },
      { cmd: "python3 cli/quantum_cli.py policy-drift",                                 desc: "System-wide policy drift analysis",       label: "drift" },
    ],
  },
];

export default function CliPage() {
  const { theme } = useTheme();
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
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${theme.panelTitle}`}>CLI Setup</h1>
        <p className={theme.mutedText}>
          Full command-line access to key generation, encryption, signing,
          lifecycle management, and governance for all supported PQC algorithms.
        </p>
      </div>

      {/* Backend status */}
      <div className={`${theme.panel} p-4 rounded-xl flex items-center gap-3 text-sm`}>
        <span className={`w-2.5 h-2.5 rounded-full ${health ? "bg-green-400" : "bg-red-500"}`} />
        <span className={theme.mutedText}>
          Backend: {health ? `Online · v${health.version || "0.1.0"}` : "Offline"}
        </span>
        {health && (
          <span className="ml-auto text-xs text-gray-500 font-mono">
            {health.environment || "docker"}
          </span>
        )}
      </div>

      {/* Prerequisites */}
      <Section theme={theme} title="Prerequisites">
        <div className="space-y-2">
          {[
            ["Python",       "3.10+", "python3 --version"],
            ["liboqs-python","0.10+", "pip show liboqs"],
            ["requests",     "any",   "pip show requests"],
          ].map(([pkg, ver, check]) => (
            <div key={pkg} className="flex items-center justify-between border border-gray-800 rounded-lg px-4 py-2 text-sm">
              <div>
                <span className="text-gray-200 font-medium">{pkg}</span>
                <span className="text-gray-500 ml-2 text-xs">{ver}</span>
              </div>
              <CopyButton text={check} label={pkg} copied={copied} onCopy={copy} />
            </div>
          ))}
        </div>
      </Section>

      {/* Installation */}
      <Section theme={theme} title="Installation">
        <div className="space-y-4">
          <Step n={1} title="Clone the repo">
            <CodeBlock
              code={"git clone https://github.com/your-org/QuantumResistantCryptographySDK.git\ncd QuantumResistantCryptographySDK"}
              label="clone" copied={copied} onCopy={copy}
            />
          </Step>
          <Step n={2} title="Create and activate virtual environment">
            <CodeBlock
              code={"python3 -m venv oqs-env\nsource oqs-env/bin/activate   # macOS/Linux\n# oqs-env\\Scripts\\activate    # Windows"}
              label="venv" copied={copied} onCopy={copy}
            />
          </Step>
          <Step n={3} title="Install dependencies">
            <CodeBlock code="pip install -r backend/requirements.txt" label="pip" copied={copied} onCopy={copy} />
          </Step>
          <Step n={4} title="Verify CLI works">
            <CodeBlock code={"cd backend\npython3 cli/quantum_cli.py --help"} label="verify" copied={copied} onCopy={copy} />
          </Step>
        </div>
      </Section>

      {/* Commands — grouped */}
      <Section theme={theme} title="CLI Commands">
        <div className="space-y-8">
          {CLI_COMMANDS.map((group) => (
            <div key={group.group} className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold border-b border-gray-800 pb-1">
                {group.group}
              </div>
              {group.commands.map((item) => (
                <div key={item.label} className={`${theme.panel} p-3 rounded-xl`}>
                  <div className="text-xs text-gray-400 mb-1.5">{item.desc}</div>
                  <div className="flex items-center justify-between gap-4">
                    <code className="text-cyan-300 text-xs font-mono break-all flex-1">{item.cmd}</code>
                    <CopyButton text={item.cmd} label={item.label} copied={copied} onCopy={copy} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* Environment Variables */}
      <Section theme={theme} title="Environment Variables">
        <div className="space-y-2">
          {[
            ["QS_API_BASE",          "http://localhost:8008",          "Backend API URL"],
            ["QS_KEYSTORE_DIR",      "_keystore/keys",                 "Key storage directory"],
            ["QS_AUDIT_LOG_PATH",    "telemetry/audit_log.jsonl",      "Telemetry/replay audit log"],
            ["QS_AUDIT_POLICY_PATH", "telemetry/audit_policy.jsonl",   "Policy audit log"],
          ].map(([key, val, desc]) => (
            <div key={key} className="grid grid-cols-3 gap-4 border border-gray-800 rounded-lg px-4 py-3 text-xs">
              <code className="text-cyan-400 font-mono">{key}</code>
              <code className="text-gray-300 font-mono">{val}</code>
              <span className="text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Docker */}
      <Section theme={theme} title="Run with Docker">
        <CodeBlock code="docker compose up --build" label="docker" copied={copied} onCopy={copy} />
        <p className={`text-xs mt-3 ${theme.mutedText}`}>
          Backend: <code className="text-cyan-400">http://localhost:8008</code>
          {" · "}
          Dashboard: <code className="text-cyan-400">http://localhost:3008</code>
        </p>
      </Section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function Section({ theme, title, children }) {
  return (
    <div className="space-y-4">
      <h2 className={`text-base font-semibold ${theme.panelTitle} border-b border-gray-800 pb-2`}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold">
        {n}
      </div>
      <div className="flex-1 space-y-2">
        <div className="text-sm text-gray-300 font-medium">{title}</div>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ code, label, copied, onCopy }) {
  return (
    <div className="relative group">
      <pre className="bg-black/40 border border-gray-800 rounded-lg p-4 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <button
        onClick={() => onCopy(code, label)}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition opacity-0 group-hover:opacity-100"
      >
        {copied === label ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function CopyButton({ text, label, copied, onCopy }) {
  return (
    <button
      onClick={() => onCopy(text, label)}
      className="shrink-0 text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition"
    >
      {copied === label ? "✓" : "Copy"}
    </button>
  );
}