import { useState } from "react";
import { FaLockOpen, FaSpinner, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import { apiPost } from "../../services/apiClient";

export default function DecryptForm({ activeKey }) {
  const [ciphertextInput, setCiphertextInput] = useState("");
  const [plaintext, setPlaintext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleDecrypt() {
    if (!ciphertextInput.trim() || !activeKey) return;
    try {
      setLoading(true); setError(null); setPlaintext(null);
      let ciphertext;
      try {
        ciphertext = JSON.parse(ciphertextInput);
      } catch {
        setError("Ciphertext must be valid JSON. Paste the full ciphertext object from the encrypt step.");
        return;
      }
      const res = await apiPost("/api/decrypt", { ciphertext, key_id: activeKey.key_id });
      setPlaintext(res.plaintext);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaLockOpen style={{ color: "var(--accent)" }} /> Decryption
        </h3>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Decrypt ciphertext using the active key.</p>
      </div>

      <div className="text-xs">
        <span style={{ color: "var(--text-muted)" }}>Active Key:</span>{" "}
        {activeKey ? (
          <span className="font-mono text-green-400">{activeKey.key_id}</span>
        ) : (
          <span className="text-red-400">None</span>
        )}
      </div>

      <textarea
        value={ciphertextInput}
        onChange={e => setCiphertextInput(e.target.value)}
        placeholder='Paste ciphertext JSON e.g. {"kem_ciphertext":"...","nonce":"...","data":"..."}'
        rows={5}
        disabled={!activeKey}
        className="w-full rounded p-2 text-xs font-mono resize-none focus:outline-none transition"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          opacity: !activeKey ? 0.5 : 1,
        }}
      />

      <button
        onClick={handleDecrypt}
        disabled={!activeKey || loading}
        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition"
        style={{
          background: !activeKey || loading ? "rgba(107,114,128,0.2)" : "var(--accent-subtle, rgba(6,182,212,0.15))",
          color: !activeKey || loading ? "var(--text-muted)" : "var(--accent)",
          cursor: !activeKey || loading ? "not-allowed" : "pointer",
          border: "1px solid var(--border)",
        }}
      >
        {loading ? <><FaSpinner className="animate-spin text-xs" /> Decrypting…</> : <><FaLockOpen className="text-xs" /> Decrypt</>}
      </button>

      {error && (
        <div className="text-xs rounded p-2 flex items-center gap-2 text-red-400"
          style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {plaintext && (
        <div className="rounded p-3 text-xs" style={{ border: "1px solid rgba(74,222,128,0.2)", background: "rgba(74,222,128,0.05)" }}>
          <div className="flex items-center gap-1.5 mb-1 text-green-400">
            <FaCheckCircle className="text-xs" /> Decrypted Output
          </div>
          <code className="break-all whitespace-pre-wrap text-green-300">{plaintext}</code>
        </div>
      )}
    </div>
  );
}
