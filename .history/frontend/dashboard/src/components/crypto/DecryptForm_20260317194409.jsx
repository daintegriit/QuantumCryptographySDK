// src/components/crypto/DecryptForm.jsx

import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { apiPost } from "../../services/apiClient";

/**
 * DecryptForm
 *
 * Production decryption surface.
 *
 * - Uses ACTIVE key passed from CryptoPage
 * - No internal key fetching
 * - Disabled when no active key exists
 * - Deterministic KMS-style UX
 */
export default function DecryptForm({ activeKey }) {
  const { theme } = useTheme();

  const [ciphertext, setCiphertext] = useState("");
  const [plaintext, setPlaintext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleDecrypt() {
    if (!ciphertext.trim() || !activeKey) return;

    try {
      setLoading(true);
      setError(null);
      setPlaintext(null);

      const res = await apiPost("/api/decrypt", { ciphertext });
      setPlaintext(res.plaintext);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${theme.panel} p-6 rounded-xl space-y-4`}>
      {/* Header */}
      <div>
        <h3 className={`text-sm font-semibold ${theme.panelTitle}`}>
          Decryption
        </h3>
        <p className={theme.mutedText}>
          Decrypt ciphertext using the currently active cryptographic key.
        </p>
      </div>

      {/* Active Key Indicator */}
      <div className="text-xs">
        <span className="text-gray-400">Active Key:</span>{" "}
        {activeKey ? (
          <span className="text-green-400 font-mono">
            {activeKey.key_id}
          </span>
        ) : (
          <span className="text-red-400">None</span>
        )}
      </div>

      {/* Input */}
      <textarea
        value={ciphertext}
        onChange={(e) => setCiphertext(e.target.value)}
        placeholder="Paste ciphertext"
        rows={4}
        disabled={!activeKey}
        className={`input ${theme.input}`}
      />

      {/* Action */}
      <button
        onClick={handleDecrypt}
        disabled={!activeKey || loading}
        className={`px-4 py-2 rounded text-sm font-medium transition ${
          !activeKey || loading
            ? "bg-gray-500/30 text-gray-400 cursor-not-allowed"
            : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
        }`}
      >
        {loading ? "Decrypting…" : "Decrypt"}
      </button>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 border border-red-500/30 rounded p-2">
          {error}
        </div>
      )}

      {/* Output */}
      {plaintext && (
        <div className="border border-green-500/20 rounded p-3 text-xs">
          <div className="text-gray-400 mb-1">Decrypted Output</div>
          <code className="text-green-300 break-all whitespace-pre-wrap">
            {plaintext}
          </code>
        </div>
      )}
    </div>
  );
}