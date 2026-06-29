import { useState } from "react";
import { FaLock, FaSpinner, FaExclamationTriangle, FaCheckCircle, FaCopy } from "react-icons/fa";
import { apiPost } from "../../services/apiClient";

export default function EncryptForm({ activeKey }) {
  const [plaintext, setPlaintext] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleEncrypt() {
    if (!plaintext.trim() || !activeKey) return;
    try {
      setLoading(true); setError(null); setResult(null);
      const res = await apiPost("/api/encrypt", { plaintext, key_id: activeKey.key_id });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(result.ciphertext));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaLock style={{ color: "var(--accent)" }} /> Encryption
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Encrypt data using the active key.</p>
      </div>

      <div className="text-xs">
        <span style={{ color: "var(--text-muted)" }}>Active Key:</span>{" "}
        {activeKey ? (
          <span className="font-mono text-green-400">{activeKey.key_id}</span>
        ) : (
          <span className="text-red-400">None — generate and activate a key first</span>
        )}
      </div>

      <textarea
        value={plaintext}
        onChange={e => setPlaintext(e.target.value)}
        placeholder="Enter plaintext to encrypt"
        rows={4}
        disabled={!activeKey}
        className="w-full rounded p-2 text-sm font-mono resize-none focus:outline-none transition"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          opacity: !activeKey ? 0.5 : 1,
        }}
      />

      <button
        onClick={handleEncrypt}
        disabled={!activeKey || loading}
        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition"
        style={{
          background: !activeKey || loading ? "rgba(107,114,128,0.2)" : "var(--accent-subtle, rgba(6,182,212,0.15))",
          color: !activeKey || loading ? "var(--text-muted)" : "var(--accent)",
          cursor: !activeKey || loading ? "not-allowed" : "pointer",
          border: "1px solid var(--border)",
        }}
      >
        {loading ? <><FaSpinner className="animate-spin text-xs" /> Encrypting…</> : <><FaLock className="text-xs" /> Encrypt</>}
      </button>

      {error && (
        <div className="text-xs rounded p-2 flex items-center gap-2 text-red-400"
          style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="rounded p-3 text-xs" style={{ border: "1px solid var(--border)", background: "var(--input-bg)" }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ color: "var(--text-muted)" }}>Ciphertext</span>
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs transition"
                style={{ color: copied ? "#4ade80" : "var(--accent)" }}>
                {copied ? <><FaCheckCircle /> Copied</> : <><FaCopy /> Copy</>}
              </button>
            </div>
            <code className="break-all text-xs" style={{ color: "var(--accent)" }}>
              {JSON.stringify(result.ciphertext)}
            </code>
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Backend: <span style={{ color: "var(--accent)" }}>{result.crypto_backend || "python"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
