// src/components/crypto/KeygenPanel.jsx
import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { apiPost } from "../../services/apiClient";
import { useActiveKey } from "../../context/ActiveKeyContext";

const ALGORITHM_OPTIONS = [
  // ── KEM ─────────────────────────────────────────────────
  { group: "KEM — Key Encapsulation (NIST FIPS 203)",
    options: [
      { label: "Kyber-512 / ML-KEM-512 (128-bit)",   algorithm: "kyber",  parameterSet: "kyber512" },
      { label: "Kyber-768 / ML-KEM-768 (192-bit) ★", algorithm: "kyber",  parameterSet: "kyber768" },
      { label: "Kyber-1024 / ML-KEM-1024 (256-bit)", algorithm: "kyber",  parameterSet: "kyber1024" },
      { label: "ML-KEM-512 (FIPS name)",              algorithm: "ml-kem", parameterSet: "ml-kem-512" },
      { label: "ML-KEM-768 (FIPS name) ★",           algorithm: "ml-kem", parameterSet: "ml-kem-768" },
      { label: "ML-KEM-1024 (FIPS name)",             algorithm: "ml-kem", parameterSet: "ml-kem-1024" },
    ],
  },
  { group: "FrodoKEM — Conservative LWE-based KEM",
    options: [
      { label: "FrodoKEM-640-AES (128-bit)",    algorithm: "frodokem", parameterSet: "frodokem-640-aes" },
      { label: "FrodoKEM-640-SHAKE (128-bit)",  algorithm: "frodokem", parameterSet: "frodokem-640-shake" },
      { label: "FrodoKEM-976-AES (192-bit)",    algorithm: "frodokem", parameterSet: "frodokem-976-aes" },
      { label: "FrodoKEM-976-SHAKE (192-bit)",  algorithm: "frodokem", parameterSet: "frodokem-976-shake" },
      { label: "FrodoKEM-1344-AES (256-bit)",   algorithm: "frodokem", parameterSet: "frodokem-1344-aes" },
      { label: "FrodoKEM-1344-SHAKE (256-bit)", algorithm: "frodokem", parameterSet: "frodokem-1344-shake" },
    ],
  },
  { group: "BIKE — Code-based KEM (NIST 2025)",
    options: [
      { label: "BIKE-L1 (128-bit)", algorithm: "bike", parameterSet: "BIKE-L1" },
      { label: "BIKE-L3 (192-bit)", algorithm: "bike", parameterSet: "BIKE-L3" },
      { label: "BIKE-L5 (256-bit)", algorithm: "bike", parameterSet: "BIKE-L5" },
    ],
  },
  // ── Dilithium ────────────────────────────────────────────
  { group: "Dilithium / ML-DSA — Signatures (NIST FIPS 204)",
    options: [
      { label: "Dilithium-2 / ML-DSA-44 (128-bit)",  algorithm: "dilithium", parameterSet: "dilithium2" },
      { label: "Dilithium-3 / ML-DSA-65 (192-bit) ★",algorithm: "dilithium", parameterSet: "dilithium3" },
      { label: "Dilithium-5 / ML-DSA-87 (256-bit)",  algorithm: "dilithium", parameterSet: "dilithium5" },
    ],
  },
  // ── Falcon ───────────────────────────────────────────────
  { group: "Falcon — Compact Signatures (NIST FIPS 206)",
    options: [
      { label: "Falcon-512 (128-bit, smallest sigs)",         algorithm: "falcon", parameterSet: "falcon512" },
      { label: "Falcon-1024 (256-bit)",                       algorithm: "falcon", parameterSet: "falcon1024" },
      { label: "Falcon-padded-512 (128-bit, constant-time)",  algorithm: "falcon", parameterSet: "falcon-padded-512" },
      { label: "Falcon-padded-1024 (256-bit, constant-time)", algorithm: "falcon", parameterSet: "falcon-padded-1024" },
    ],
  },
  // ── SPHINCS+ ─────────────────────────────────────────────
  { group: "SPHINCS+ — Hash-Based Signatures (legacy name)",
    options: [
      { label: "SPHINCS+-SHA2-128f (128-bit, fast)",     algorithm: "sphincs", parameterSet: "sphincs-sha2-128f" },
      { label: "SPHINCS+-SHA2-128s (128-bit, small sig)",algorithm: "sphincs", parameterSet: "sphincs-sha2-128s" },
      { label: "SPHINCS+-SHA2-192f (192-bit, fast)",     algorithm: "sphincs", parameterSet: "sphincs-sha2-192f" },
      { label: "SPHINCS+-SHA2-256f (256-bit, fast)",     algorithm: "sphincs", parameterSet: "sphincs-sha2-256f" },
      { label: "SPHINCS+-SHAKE-128f (128-bit, fast)",    algorithm: "sphincs", parameterSet: "sphincs-shake-128f" },
      { label: "SPHINCS+-SHAKE-256f (256-bit, fast)",    algorithm: "sphincs", parameterSet: "sphincs-shake-256f" },
    ],
  },
  // ── SLH-DSA ──────────────────────────────────────────────
  { group: "SLH-DSA — Hash-Based Signatures (NIST FIPS 205)",
    options: [
      { label: "SLH-DSA-SHA2-128f (128-bit, fast) ★",    algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHA2_128F" },
      { label: "SLH-DSA-SHA2-128s (128-bit, small sig)",  algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHA2_128S" },
      { label: "SLH-DSA-SHA2-192f (192-bit, fast)",       algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHA2_192F" },
      { label: "SLH-DSA-SHA2-192s (192-bit, small sig)",  algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHA2_192S" },
      { label: "SLH-DSA-SHA2-256f (256-bit, fast)",       algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHA2_256F" },
      { label: "SLH-DSA-SHA2-256s (256-bit, small sig)",  algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHA2_256S" },
      { label: "SLH-DSA-SHAKE-128f (128-bit, fast)",      algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHAKE_128F" },
      { label: "SLH-DSA-SHAKE-128s (128-bit, small sig)", algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHAKE_128S" },
      { label: "SLH-DSA-SHAKE-192f (192-bit, fast)",      algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHAKE_192F" },
      { label: "SLH-DSA-SHAKE-256f (256-bit, fast)",      algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHAKE_256F" },
      { label: "SLH-DSA-SHAKE-256s (256-bit, small sig)", algorithm: "slh-dsa", parameterSet: "SLH_DSA_PURE_SHAKE_256S" },
    ],
  },
  // ── MAYO ─────────────────────────────────────────────────
  { group: "MAYO — Research Candidate (NIST Round 2)",
    options: [
      { label: "MAYO-1 (128-bit, research)",  algorithm: "mayo", parameterSet: "MAYO-1" },
      { label: "MAYO-2 (128-bit, research)",  algorithm: "mayo", parameterSet: "MAYO-2" },
      { label: "MAYO-3 (192-bit, research)",  algorithm: "mayo", parameterSet: "MAYO-3" },
      { label: "MAYO-5 (256-bit, research)",  algorithm: "mayo", parameterSet: "MAYO-5" },
    ],
  },
];

const KEM_ALGS = new Set(["kyber", "ml-kem", "frodokem", "bike"]);

export default function KeygenPanel({ onActivated }) {
  const { theme } = useTheme();
  const { refreshActiveKey } = useActiveKey();
  const [selected, setSelected] = useState("kyber|kyber768");
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function getSelected() {
    for (const group of ALGORITHM_OPTIONS)
      for (const opt of group.options)
        if (`${opt.algorithm}|${opt.parameterSet}` === selected) return opt;
    return ALGORITHM_OPTIONS[0].options[1];
  }

  async function generateKey() {
    const opt = getSelected();
    try {
      setLoading(true); setError(null); setResult(null);
      const res = await apiPost("/api/keygen", {
        algorithm: opt.algorithm,
        parameter_set: opt.parameterSet,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function activateKey() {
    if (!result?.key?.key_id) return;
    try {
      setActivating(true); setError(null);
      await apiPost(`/api/keys/${result.key.key_id}/activate`);
      onActivated?.();
      refreshActiveKey?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActivating(false);
    }
  }

  const opt = getSelected();
  const isKem = KEM_ALGS.has(opt.algorithm);
  const isResearch = opt.algorithm === "mayo";
  const typeColor = isKem ? "text-cyan-400" : isResearch ? "text-yellow-400" : "text-purple-400";
  const typeLabel = isKem ? "KEM" : isResearch ? "SIG (Research)" : "Signature";

  return (
    <div className={`${theme.panel} p-6 rounded-xl space-y-4`}>
      <div>
        <h3 className={`text-sm font-semibold ${theme.panelTitle}`}>Key Generation</h3>
        <p className={theme.mutedText}>
          Generate post-quantum keys with NIST policy validation.
          KEM keys → Encrypt/Decrypt · Signature keys → Sign/Verify.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Algorithm & Parameter Set
        </label>
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setResult(null); setError(null); }}
          className="w-full px-3 py-2 rounded bg-black/40 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
        >
          {ALGORITHM_OPTIONS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.options.map((o) => (
                <option key={`${o.algorithm}|${o.parameterSet}`} value={`${o.algorithm}|${o.parameterSet}`}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex gap-4 text-xs">
          <span className="text-gray-500">Type: <span className={typeColor}>{typeLabel}</span></span>
          <span className="text-gray-500">Param: <span className="text-gray-300 font-mono">{opt.parameterSet}</span></span>
        </div>
        {isResearch && (
          <div className="text-xs text-yellow-400 border border-yellow-500/30 rounded p-2">
            ⚠ Research candidate — not approved for production use
          </div>
        )}
      </div>

      <button
        onClick={generateKey}
        disabled={loading}
        className={`w-full px-4 py-2 rounded text-sm font-medium transition ${
          loading ? "bg-cyan-500/30 text-cyan-200 cursor-not-allowed"
                  : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
        }`}
      >
        {loading ? "Generating…" : "Generate Key"}
      </button>

      {error && (
        <div className="text-xs text-red-400 border border-red-500/30 rounded p-2">{error}</div>
      )}

      {result && (
        <div className="space-y-3 text-xs border border-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-gray-400">Key ID</span>
              <div className="font-mono text-cyan-400 truncate">{result.key.key_id}</div></div>
            <div><span className="text-gray-400">Type</span>
              <div className={typeColor}>{result.key.key_type?.toUpperCase()}</div></div>
            <div><span className="text-gray-400">Algorithm</span>
              <div className="text-gray-200">{result.key.algorithm}</div></div>
            <div><span className="text-gray-400">Params</span>
              <div className="font-mono text-gray-300 truncate">{result.key.parameter_set}</div></div>
            <div><span className="text-gray-400">Security</span>
              <div className="text-gray-200">{result.key.security_level}</div></div>
            <div><span className="text-gray-400">Policy</span>
              <div className={result.policy?.allowed ? "text-green-400" : "text-red-400"}>
                {result.policy?.allowed ? "ALLOWED" : "DENIED"}</div></div>
          </div>
          {result.policy?.warnings?.length > 0 && (
            <div className="text-xs text-yellow-400 border border-yellow-500/20 rounded p-2">
              {result.policy.warnings[0]}
            </div>
          )}
          {result.policy?.allowed && (
            <button
              onClick={activateKey}
              disabled={activating}
              className={`w-full px-3 py-2 rounded text-sm font-medium transition ${
                activating ? "bg-green-500/30 text-green-200 cursor-not-allowed"
                           : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              }`}
            >
              {activating ? "Activating…" : "Set as Active Key"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}