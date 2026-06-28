// src/components/crypto/EncryptForm.jsx
import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { apiPost } from "../../services/apiClient";

export default function EncryptForm({ activeKey }) {
  const { theme } = useTheme();
  const [plaintext, setPlaintext] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleEncrypt() {
    if (!plaintext.trim() || !activeKey) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      // BUG FIX: original sent { plaintext } without key_id
      // Backend requires key_id to know which key to encrypt with
      const res = await apiPost("/api/encrypt", {
        plaintext,
        key_id: activeKey.key_id,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${theme.panel} p-6 rounded-xl space-y-4`}>
      <div>
        <h3 className={`text-sm font-semibold ${theme.panelTitle}`}>Encryption</h3>
        <p className={theme.mutedText}>Encrypt data using the active key.</p>
      </div>

      <div className="text-xs">
        <span className="text-gray-400">Active Key:</span>{" "}
        {activeKey ? (
          <span className="text-green-400 font-mono">{activeKey.key_id}</span>
        ) : (
          <span className="text-red-400">None — generate and activate a key first</span>
        )}
      </div>

      <textarea
        value={plaintext}
        onChange={(e) => setPlaintext(e.target.value)}
        placeholder="Enter plaintext to encrypt"
        rows={4}
        disabled={!activeKey}
        className={`w-full rounded p-2 text-sm font-mono bg-black/30 border border-gray-700 text-gray-200 resize-none focus:outline-none focus:border-cyan-500/50 ${!activeKey ? "opacity-50" : ""}`}
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
        <div className="text-xs text-red-400 border border-red-500/30 rounded p-2">{error}</div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="border border-cyan-500/20 rounded p-3 text-xs">
            <div className="text-gray-400 mb-1">Ciphertext (save this to decrypt)</div>
            <code className="text-cyan-300 break-all text-xs">
              {JSON.stringify(result.ciphertext)}
            </code>
          </div>
          <div className="text-xs text-gray-500">
            Backend: <span className="text-cyan-400">{result.crypto_backend || "python"}</span>
          </div>
        </div>
      )}
    </div>
  );
}