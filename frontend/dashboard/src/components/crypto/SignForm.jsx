// src/components/crypto/SignForm.jsx
import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { apiPost } from "../../services/apiClient";

export default function SignForm({ activeKey }) {
  const { theme } = useTheme();
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSign() {
    if (!message.trim() || !activeKey) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const res = await apiPost("/api/sign", {
        message,
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
        <h3 className={`text-sm font-semibold ${theme.panelTitle}`}>Sign Message</h3>
        <p className={theme.mutedText}>
          Create a post-quantum digital signature using the active signature key.
        </p>
      </div>

      <div className="text-xs">
        <span className="text-gray-400">Active Key:</span>{" "}
        {activeKey ? (
          <span className="text-purple-400 font-mono">{activeKey.key_id}</span>
        ) : (
          <span className="text-red-400">None — set a Dilithium, Falcon, or SPHINCS+ key active</span>
        )}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter message to sign"
        rows={4}
        disabled={!activeKey}
        className={`w-full rounded p-2 text-sm font-mono bg-black/30 border border-gray-700 text-gray-200 resize-none focus:outline-none focus:border-purple-500/50 ${!activeKey ? "opacity-50" : ""}`}
      />

      <button
        onClick={handleSign}
        disabled={!activeKey || loading}
        className={`px-4 py-2 rounded text-sm font-medium transition ${
          !activeKey || loading
            ? "bg-gray-500/30 text-gray-400 cursor-not-allowed"
            : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
        }`}
      >
        {loading ? "Signing…" : "Sign"}
      </button>

      {error && (
        <div className="text-xs text-red-400 border border-red-500/30 rounded p-2">{error}</div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="border border-purple-500/20 rounded p-3 text-xs">
            <div className="text-gray-400 mb-1">
              Signature · Scheme: <span className="text-purple-400 font-mono">{result.scheme}</span>
            </div>
            <code className="text-purple-300 break-all text-xs leading-relaxed">
              {result.signature}
            </code>
          </div>
          <div className="text-xs text-gray-500">
            Backend: <span className="text-purple-400">{result.crypto_backend || "python"}</span>
          </div>
        </div>
      )}
    </div>
  );
}