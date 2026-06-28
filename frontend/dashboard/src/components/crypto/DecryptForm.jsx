// src/components/crypto/DecryptForm.jsx
import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { apiPost } from "../../services/apiClient";

export default function DecryptForm({ activeKey }) {
  const { theme } = useTheme();
  const [ciphertextInput, setCiphertextInput] = useState("");
  const [plaintext, setPlaintext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleDecrypt() {
    if (!ciphertextInput.trim() || !activeKey) return;
    try {
      setLoading(true);
      setError(null);
      setPlaintext(null);

      // BUG FIX 1: original sent { ciphertext } as string
      // Backend expects ciphertext as an object: { kem_ciphertext, nonce, data }
      // BUG FIX 2: original didn't send key_id
      let ciphertext;
      try {
        ciphertext = JSON.parse(ciphertextInput);
      } catch {
        setError("Ciphertext must be valid JSON. Paste the full ciphertext object from the encrypt step.");
        return;
      }

      const res = await apiPost("/api/decrypt", {
        ciphertext,
        key_id: activeKey.key_id,
      });
      setPlaintext(res.plaintext);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${theme.panel} p-6 rounded-xl space-y-4`}>
      <div>
        <h3 className={`text-sm font-semibold ${theme.panelTitle}`}>Decryption</h3>
        <p className={theme.mutedText}>Decrypt ciphertext using the active key.</p>
      </div>

      <div className="text-xs">
        <span className="text-gray-400">Active Key:</span>{" "}
        {activeKey ? (
          <span className="text-green-400 font-mono">{activeKey.key_id}</span>
        ) : (
          <span className="text-red-400">None</span>
        )}
      </div>

      <textarea
        value={ciphertextInput}
        onChange={(e) => setCiphertextInput(e.target.value)}
        placeholder='Paste ciphertext JSON e.g. {"kem_ciphertext":"...","nonce":"...","data":"..."}'
        rows={5}
        disabled={!activeKey}
        className={`w-full rounded p-2 text-xs font-mono bg-black/30 border border-gray-700 text-gray-200 resize-none focus:outline-none focus:border-cyan-500/50 ${!activeKey ? "opacity-50" : ""}`}
      />

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

      {error && (
        <div className="text-xs text-red-400 border border-red-500/30 rounded p-2">{error}</div>
      )}

      {plaintext && (
        <div className="border border-green-500/20 rounded p-3 text-xs">
          <div className="text-gray-400 mb-1">Decrypted Output</div>
          <code className="text-green-300 break-all whitespace-pre-wrap">{plaintext}</code>
        </div>
      )}
    </div>
  );
}