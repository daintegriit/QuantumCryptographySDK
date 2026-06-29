import { useState } from "react";
import { FaCheckCircle, FaTimesCircle, FaSpinner, FaExclamationTriangle, FaSearch } from "react-icons/fa";
import { apiPost } from "../../services/apiClient";

export default function VerifyForm({ activeKey }) {
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleVerify() {
    if (!message.trim() || !signature.trim() || !activeKey) return;
    try {
      setLoading(true); setError(null); setResult(null);
      const res = await apiPost("/api/verify", { message, signature, key_id: activeKey.key_id });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const textareaStyle = (disabled) => ({
    background: "var(--input-bg)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaSearch style={{ color: "#a78bfa" }} /> Verify Signature
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Verify a post-quantum signature against a message and public key.
        </p>
      </div>

      <div className="text-xs">
        <span style={{ color: "var(--text-muted)" }}>Active Key:</span>{" "}
        {activeKey ? (
          <span className="font-mono text-purple-400">{activeKey.key_id}</span>
        ) : (
          <span className="text-red-400">None</span>
        )}
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Original message"
        rows={3}
        disabled={!activeKey}
        className="w-full rounded p-2 text-sm font-mono resize-none focus:outline-none transition"
        style={textareaStyle(!activeKey)}
      />

      <textarea
        value={signature}
        onChange={e => setSignature(e.target.value)}
        placeholder="Paste signature from Sign step"
        rows={4}
        disabled={!activeKey}
        className="w-full rounded p-2 text-xs font-mono resize-none focus:outline-none transition"
        style={textareaStyle(!activeKey)}
      />

      <button
        onClick={handleVerify}
        disabled={!activeKey || loading}
        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition"
        style={{
          background: !activeKey || loading ? "rgba(107,114,128,0.2)" : "rgba(167,139,250,0.15)",
          color: !activeKey || loading ? "var(--text-muted)" : "#a78bfa",
          cursor: !activeKey || loading ? "not-allowed" : "pointer",
          border: "1px solid var(--border)",
        }}
      >
        {loading ? <><FaSpinner className="animate-spin text-xs" /> Verifying…</> : <><FaSearch className="text-xs" /> Verify</>}
      </button>

      {error && (
        <div className="text-xs rounded p-2 flex items-center gap-2 text-red-400"
          style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {result && (
        <div className="rounded p-4 text-sm font-semibold flex flex-col gap-1"
          style={{
            border: result.valid ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(239,68,68,0.3)",
            background: result.valid ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)",
            color: result.valid ? "#4ade80" : "#f87171",
          }}>
          <span className="flex items-center gap-2">
            {result.valid ? <FaCheckCircle /> : <FaTimesCircle />}
            {result.valid ? "Signature Valid" : "Signature Invalid"}
          </span>
          <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
            Backend: <span style={{ color: result.valid ? "#4ade80" : "#f87171" }}>{result.crypto_backend || "python"}</span>
          </span>
        </div>
      )}
    </div>
  );
}
