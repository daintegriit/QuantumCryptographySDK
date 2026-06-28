// src/components/crypto/VerifyForm.jsx
import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { apiPost } from "../../services/apiClient";

export default function VerifyForm({ activeKey }) {
  const { theme } = useTheme();
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleVerify() {
    if (!message.trim() || !signature.trim() || !activeKey) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const res = await apiPost("/api/verify", {
        message,
        signature,
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
        <h3 className={`text-sm font-semibold ${theme.panelTitle}`}>Verify Signature</h3>
        <p className={theme.mutedText}>
          Verify a post-quantum signature against a message and public key.
        </p>
      </div>

      <div className="text-xs">
        <span className="text-gray-400">Active Key:</span>{" "}
        {activeKey ? (
          <span className="text-purple-400 font-mono">{activeKey.key_id}</span>
        ) : (
          <span className="text-red-400">None</span>
        )}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Original message"
        rows={3}
        disabled={!activeKey}
        className={`w-full rounded p-2 text-sm font-mono bg-black/30 border border-gray-700 text-gray-200 resize-none focus:outline-none focus:border-purple-500/50 ${!activeKey ? "opacity-50" : ""}`}
      />

      <textarea
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        placeholder="Paste signature from Sign step"
        rows={4}
        disabled={!activeKey}
        className={`w-full rounded p-2 text-xs font-mono bg-black/30 border border-gray-700 text-gray-200 resize-none focus:outline-none focus:border-purple-500/50 ${!activeKey ? "opacity-50" : ""}`}
      />

      <button
        onClick={handleVerify}
        disabled={!activeKey || loading}
        className={`px-4 py-2 rounded text-sm font-medium transition ${
          !activeKey || loading
            ? "bg-gray-500/30 text-gray-400 cursor-not-allowed"
            : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
        }`}
      >
        {loading ? "Verifying…" : "Verify"}
      </button>

      {error && (
        <div className="text-xs text-red-400 border border-red-500/30 rounded p-2">{error}</div>
      )}

      {result && (
        <div className={`border rounded p-4 text-sm font-semibold ${
          result.valid
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}>
          {result.valid ? "✓ Signature Valid" : "✗ Signature Invalid"}
          <div className="text-xs font-normal mt-1 text-gray-400">
            Backend: <span className={result.valid ? "text-green-400" : "text-red-400"}>
              {result.crypto_backend || "python"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}