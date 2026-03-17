// src/components/crypto/KeygenPanel.jsx

import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { apiPost } from "../../services/apiClient";
import { useActiveKey } from "../../context/ActiveKeyContext";

/**
 * KeygenPanel
 *
 * Production key generation + activation surface.
 *
 * - Generates real keys
 * - Explicitly activates keys
 * - Lifecycle-aware
 * - Industry-standard UX (KMS-style)
 */
export default function KeygenPanel({ onActivated }) {
  const { theme } = useTheme();
  const { refreshActiveKey } = useActiveKey();

  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function generateKey() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const res = await apiPost("/api/keygen", {});
      setResult(res);
    } catch (err) {
      console.error("Key generation failed:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function activateKey() {
    if (!result?.key?.key_id) return;

    try {
      setActivating(true);
      setError(null);

      // Uses lifecycle / rotation engine
      await apiPost(
        `/api/keys/${result.key.key_id}/activate`
      );

      onActivated?.();        // CryptoPage + Encrypt/Decrypt
      refreshActiveKey?.();  // Sidebar + Audit + Telemetry

    } catch (err) {
      console.error("Activation failed:", err);
      setError(err.message);
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className={`${theme.panel} p-6 rounded-xl flex flex-col h-full`}>
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <h3 className={`text-sm font-semibold mb-2 ${theme.panelTitle}`}>
        🔐 Key Generation
      </h3>

      <p className={theme.mutedText}>
        Generate post-quantum cryptographic keys with policy validation.
      </p>

      {/* ============================= */}
      {/* Generate Button */}
      {/* ============================= */}
      <button
        onClick={generateKey}
        disabled={loading}
        className={`
          mt-4 px-4 py-2 rounded text-sm font-medium transition
          ${
            loading
              ? "bg-cyan-500/30 text-cyan-200 cursor-not-allowed"
              : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
          }
        `}
      >
        {loading ? "Generating…" : "Generate Key"}
      </button>

      {/* ============================= */}
      {/* Error */}
      {/* ============================= */}
      {error && (
        <div className="mt-4 text-xs text-red-400 border border-red-500/30 rounded p-2">
          {error}
        </div>
      )}

      {/* ============================= */}
      {/* Result */}
      {/* ============================= */}
      {result && (
        <div className="mt-4 space-y-2 text-xs">
          <div>
            <span className="text-gray-400">Algorithm:</span>{" "}
            <span className="text-cyan-400 font-mono">
              {result.key.algorithm}
            </span>
          </div>

          <div>
            <span className="text-gray-400">Key ID:</span>{" "}
            <span className="text-cyan-400 font-mono">
              {result.key.key_id}
            </span>
          </div>

          <div>
            <span className="text-gray-400">Policy:</span>{" "}
            <span
              className={
                result.policy?.allowed
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {result.policy?.allowed ? "ALLOWED" : "DENIED"}
            </span>
          </div>

          {/* ============================= */}
          {/* Activate Button */}
          {/* ============================= */}
          {result.policy?.allowed && (
            <button
              onClick={activateKey}
              disabled={activating}
              className={`
                mt-3 w-full px-3 py-2 rounded text-sm font-medium transition
                ${
                  activating
                    ? "bg-green-500/30 text-green-200 cursor-not-allowed"
                    : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                }
              `}
            >
              {activating ? "Activating…" : "Set as Active Key"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}