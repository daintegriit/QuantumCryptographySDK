import { useState } from "react";
import { FaPen, FaSpinner, FaExclamationTriangle, FaCopy, FaCheckCircle } from "react-icons/fa";
import { apiPost } from "../../services/apiClient";

export default function SignForm({ activeKey }) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSign() {
    if (!message.trim() || !activeKey) return;
    try {
      setLoading(true); setError(null); setResult(null);
      const res = await apiPost("/api/sign", { message, key_id: activeKey.key_id });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(result.signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaPen style={{ color: "#a78bfa" }} /> Sign Message
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Create a post-quantum digital signature using the active signature key.
        </p>
      </div>

      <div className="text-xs">
        <span style={{ color: "var(--text-muted)" }}>Active Key:</span>{" "}
        {activeKey ? (
          <span className="font-mono text-purple-400">{activeKey.key_id}</span>
        ) : (
          <span className="text-red-400">None — set a Dilithium, Falcon, or SPHINCS+ key active</span>
        )}
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Enter message to sign"
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
        onClick={handleSign}
        disabled={!activeKey || loading}
        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition"
        style={{
          background: !activeKey || loading ? "rgba(107,114,128,0.2)" : "rgba(167,139,250,0.15)",
          color: !activeKey || loading ? "var(--text-muted)" : "#a78bfa",
          cursor: !activeKey || loading ? "not-allowed" : "pointer",
          border: "1px solid var(--border)",
        }}
      >
        {loading ? <><FaSpinner className="animate-spin text-xs" /> Signing…</> : <><FaPen className="text-xs" /> Sign</>}
      </button>

      {error && (
        <div className="text-xs rounded p-2 flex items-center gap-2 text-red-400"
          style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="rounded p-3 text-xs" style={{ border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.05)" }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ color: "var(--text-muted)" }}>
                Signature · Scheme: <span className="text-purple-400 font-mono">{result.scheme}</span>
              </span>
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs transition"
                style={{ color: copied ? "#4ade80" : "#a78bfa" }}>
                {copied ? <><FaCheckCircle /> Copied</> : <><FaCopy /> Copy</>}
              </button>
            </div>
            <code className="text-purple-300 break-all text-xs leading-relaxed">{result.signature}</code>
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Backend: <span className="text-purple-400">{result.crypto_backend || "python"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
