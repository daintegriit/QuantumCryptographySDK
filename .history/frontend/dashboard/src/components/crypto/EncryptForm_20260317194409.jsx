// src/components/crypto/EncryptForm.jsx

import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { apiPost } from "../../services/apiClient";

/**
 * EncryptForm
 *
 * Production encryption surface.
 *
 * - Uses ACTIVE key passed from CryptoPage
 * - No internal key fetching
 * - Disabled if no active key
 * - KMS-style deterministic UX
 */
export default function EncryptForm({ activeKey }) {
  const { theme } = useTheme();

  const [plaintext, setPlaintext] = useState("");
  const [ciphertext, setCiphertext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleEncrypt() {
    if (!plaintext.trim() || !activeKey) return;

    try {
      setLoading(true);
      setError(null);
      setCiphertext(null);

      const res = await apiPost("/api/encrypt", { plaintext });
      setCiphertext(res.ciphertext);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${theme.panel} p-6 rounded-xl space-y-4`}>
      <div>
        <h3 className={`text-sm font-semibold ${theme.panelTitle}`}>
          Encryption
        </h3>
        <p className={theme.mutedText}>
          Encrypt data using the currently active cryptographic key.
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

      <textarea
        value={plaintext}
        onChange={(e) => setPlaintext(e.target.value)}
        placeholder="Enter plaintext"
        rows={4}
        disabled={!activeKey}
        className={`input ${theme.input}`}
      />

      <button
        onClick={handleEncrypt}
        disabled={!activeKey || loading}
        className={`px-4 py-2 rounded text-sm font-medium transition ${
          !activeKey || loading
            ? "bg-gray-500/30 text-gray-400 cursor-not-allowed"
            : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
        }`}
      >
        {loading ? "Encrypting…" : "Encrypt"}
      </button>

      {error && (
        <div className="text-xs text-red-400 border border-red-500/30 rounded p-2">
          {error}
        </div>
      )}

      {ciphertext && (
        <div className="border border-cyan-500/20 rounded p-3 text-xs">
          <div className="text-gray-400 mb-1">Encrypted Output</div>
          <code className="text-cyan-300 break-all">{ciphertext}</code>
        </div>
      )}
    </div>
  );
}