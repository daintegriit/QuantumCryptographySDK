// src/pages/AlgorithmsPage.jsx
import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { apiGet } from "../services/apiClient";

const ALGORITHMS = [
  {
    family: "Kyber / ML-KEM",
    type: "KEM",
    standard: "NIST FIPS 203",
    description: "Module-Lattice Key Encapsulation Mechanism. Primary NIST-standardized post-quantum KEM. Use for key exchange and hybrid encryption.",
    color: "cyan",
    variants: [
      { param: "kyber512",       alias: "ML-KEM-512",  security: "128-bit", nistLevel: 1, keySize: "800B / 1632B",  ciphertext: "768B",  speed: "⚡ Fastest",  status: "RECOMMENDED" },
      { param: "kyber768",       alias: "ML-KEM-768",  security: "192-bit", nistLevel: 3, keySize: "1184B / 2400B", ciphertext: "1088B", speed: "⚡ Fast",     status: "RECOMMENDED" },
      { param: "kyber1024",      alias: "ML-KEM-1024", security: "256-bit", nistLevel: 5, keySize: "1568B / 3168B", ciphertext: "1568B", speed: "✓ Standard",  status: "HIGH SECURITY" },
      { param: "ml-kem-512",     alias: "ML-KEM-512",  security: "128-bit", nistLevel: 1, keySize: "800B / 1632B",  ciphertext: "768B",  speed: "⚡ Fastest",  status: "FIPS NAME" },
      { param: "ml-kem-768",     alias: "ML-KEM-768",  security: "192-bit", nistLevel: 3, keySize: "1184B / 2400B", ciphertext: "1088B", speed: "⚡ Fast",     status: "FIPS NAME" },
      { param: "ml-kem-1024",    alias: "ML-KEM-1024", security: "256-bit", nistLevel: 5, keySize: "1568B / 3168B", ciphertext: "1568B", speed: "✓ Standard",  status: "FIPS NAME" },
    ],
  },
  {
    family: "Dilithium / ML-DSA",
    type: "Signature",
    standard: "NIST FIPS 204",
    description: "Module-Lattice Digital Signature Algorithm. Primary NIST-standardized post-quantum signature scheme. Use for code signing, authentication, and document signing.",
    color: "purple",
    variants: [
      { param: "dilithium2", alias: "ML-DSA-44", security: "128-bit", nistLevel: 2, keySize: "1312B / 2528B", sigSize: "2420B",  speed: "⚡ Fastest",  status: "RECOMMENDED" },
      { param: "dilithium3", alias: "ML-DSA-65", security: "192-bit", nistLevel: 3, keySize: "1952B / 4000B", sigSize: "3293B",  speed: "⚡ Fast",     status: "RECOMMENDED" },
      { param: "dilithium5", alias: "ML-DSA-87", security: "256-bit", nistLevel: 5, keySize: "2592B / 4864B", sigSize: "4595B",  speed: "✓ Standard",  status: "HIGH SECURITY" },
      { param: "ml-dsa-44",  alias: "ML-DSA-44", security: "128-bit", nistLevel: 2, keySize: "1312B / 2528B", sigSize: "2420B",  speed: "⚡ Fastest",  status: "FIPS NAME" },
      { param: "ml-dsa-65",  alias: "ML-DSA-65", security: "192-bit", nistLevel: 3, keySize: "1952B / 4000B", sigSize: "3293B",  speed: "⚡ Fast",     status: "FIPS NAME" },
      { param: "ml-dsa-87",  alias: "ML-DSA-87", security: "256-bit", nistLevel: 5, keySize: "2592B / 4864B", sigSize: "4595B",  speed: "✓ Standard",  status: "FIPS NAME" },
    ],
  },
  {
    family: "Falcon",
    type: "Signature",
    standard: "NIST FIPS 206",
    description: "NTRU-lattice based signature scheme. Smallest signatures of any NIST PQC scheme. Ideal for IoT, certificates, and embedded systems.",
    color: "orange",
    variants: [
      { param: "falcon512",          alias: "Falcon-512",          security: "128-bit", nistLevel: 1, keySize: "897B / 1281B",  sigSize: "~666B",  speed: "✓ Standard",  status: "RECOMMENDED" },
      { param: "falcon1024",         alias: "Falcon-1024",         security: "256-bit", nistLevel: 5, keySize: "1793B / 2305B", sigSize: "~1280B", speed: "✓ Standard",  status: "HIGH SECURITY" },
      { param: "falcon-padded-512",  alias: "Falcon-padded-512",   security: "128-bit", nistLevel: 1, keySize: "897B / 1281B",  sigSize: "809B",   speed: "✓ Standard",  status: "CONSTANT TIME" },
      { param: "falcon-padded-1024", alias: "Falcon-padded-1024",  security: "256-bit", nistLevel: 5, keySize: "1793B / 2305B", sigSize: "1577B",  speed: "✓ Standard",  status: "CONSTANT TIME" },
    ],
  },
  {
    family: "SPHINCS+ / SLH-DSA",
    type: "Signature",
    standard: "NIST FIPS 205",
    description: "Hash-based stateless signatures. Conservative choice — security based only on hash functions, not lattice assumptions. Larger sigs but maximum long-term trust.",
    color: "green",
    variants: [
      // SHA2 fast variants
      { param: "sphincs-sha2-128f", alias: "SPHINCS+-SHA2-128f-simple", security: "128-bit", nistLevel: 1, sigSize: "17.1KB", speed: "🐢 Slow",   status: "RECOMMENDED" },
      { param: "sphincs-sha2-192f", alias: "SPHINCS+-SHA2-192f-simple", security: "192-bit", nistLevel: 3, sigSize: "35.7KB", speed: "🐢 Slow",   status: "RECOMMENDED" },
      { param: "sphincs-sha2-256f", alias: "SPHINCS+-SHA2-256f-simple", security: "256-bit", nistLevel: 5, sigSize: "49.9KB", speed: "🐢 Slow",   status: "HIGH SECURITY" },
      // SHA2 small variants
      { param: "sphincs-sha2-128s", alias: "SPHINCS+-SHA2-128s-simple", security: "128-bit", nistLevel: 1, sigSize: "7.9KB",  speed: "🐢 Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-sha2-192s", alias: "SPHINCS+-SHA2-192s-simple", security: "192-bit", nistLevel: 3, sigSize: "16.2KB", speed: "🐢 Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-sha2-256s", alias: "SPHINCS+-SHA2-256s-simple", security: "256-bit", nistLevel: 5, sigSize: "29.8KB", speed: "🐢 Slowest", status: "SMALLEST SIG" },
      // SHAKE fast variants
      { param: "sphincs-shake-128f", alias: "SPHINCS+-SHAKE-128f-simple", security: "128-bit", nistLevel: 1, sigSize: "17.1KB", speed: "🐢 Slow",   status: "RECOMMENDED" },
      { param: "sphincs-shake-192f", alias: "SPHINCS+-SHAKE-192f-simple", security: "192-bit", nistLevel: 3, sigSize: "35.7KB", speed: "🐢 Slow",   status: "RECOMMENDED" },
      { param: "sphincs-shake-256f", alias: "SPHINCS+-SHAKE-256f-simple", security: "256-bit", nistLevel: 5, sigSize: "49.9KB", speed: "🐢 Slow",   status: "HIGH SECURITY" },
      // SHAKE small variants
      { param: "sphincs-shake-128s", alias: "SPHINCS+-SHAKE-128s-simple", security: "128-bit", nistLevel: 1, sigSize: "7.9KB",  speed: "🐢 Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-shake-192s", alias: "SPHINCS+-SHAKE-192s-simple", security: "192-bit", nistLevel: 3, sigSize: "16.2KB", speed: "🐢 Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-shake-256s", alias: "SPHINCS+-SHAKE-256s-simple", security: "256-bit", nistLevel: 5, sigSize: "29.8KB", speed: "🐢 Slowest", status: "SMALLEST SIG" },
    ],
  },
  {
    family: "FrodoKEM",
    type: "KEM",
    standard: "ISO/NIST Candidate",
    description: "LWE-based KEM. Conservative alternative to Kyber — unstructured lattices, larger keys/ciphertexts but more conservative security assumptions.",
    color: "yellow",
    variants: [
      { param: "frodokem-640-aes",    alias: "FrodoKEM-640-AES",    security: "128-bit", nistLevel: 1, keySize: "9616B / 19888B", ciphertext: "9720B",  speed: "🐢 Slow",    status: "CONSERVATIVE" },
      { param: "frodokem-640-shake",  alias: "FrodoKEM-640-SHAKE",  security: "128-bit", nistLevel: 1, keySize: "9616B / 19888B", ciphertext: "9720B",  speed: "🐢 Slow",    status: "CONSERVATIVE" },
      { param: "frodokem-976-aes",    alias: "FrodoKEM-976-AES",    security: "192-bit", nistLevel: 3, keySize: "15632B / 31296B", ciphertext: "15744B", speed: "🐢 Slower",  status: "CONSERVATIVE" },
      { param: "frodokem-976-shake",  alias: "FrodoKEM-976-SHAKE",  security: "192-bit", nistLevel: 3, keySize: "15632B / 31296B", ciphertext: "15744B", speed: "🐢 Slower",  status: "CONSERVATIVE" },
      { param: "frodokem-1344-aes",   alias: "FrodoKEM-1344-AES",   security: "256-bit", nistLevel: 5, keySize: "21520B / 43088B", ciphertext: "21632B", speed: "🐢 Slowest", status: "MAX SECURITY" },
      { param: "frodokem-1344-shake", alias: "FrodoKEM-1344-SHAKE", security: "256-bit", nistLevel: 5, keySize: "21520B / 43088B", ciphertext: "21632B", speed: "🐢 Slowest", status: "MAX SECURITY" },
    ],
  },
];

const TYPE_COLORS = {
  KEM:       "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  Signature: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const STATUS_COLORS = {
  "RECOMMENDED":   "text-green-400",
  "HIGH SECURITY": "text-blue-400",
  "CONSERVATIVE":  "text-yellow-400",
  "CONSTANT TIME": "text-cyan-400",
  "SMALLEST SIG":  "text-purple-400",
  "MAX SECURITY":  "text-red-400",
  "FIPS NAME":     "text-gray-400",
};

const FAMILY_BORDER = {
  cyan:   "border-cyan-500/30",
  purple: "border-purple-500/30",
  orange: "border-orange-500/30",
  green:  "border-green-500/30",
  yellow: "border-yellow-500/30",
};

const FAMILY_TITLE = {
  cyan:   "text-cyan-400",
  purple: "text-purple-400",
  orange: "text-orange-400",
  green:  "text-green-400",
  yellow: "text-yellow-400",
};

export default function AlgorithmsPage() {
  const { theme } = useTheme();
  const [supported, setSupported] = useState(null);

  useEffect(() => {
    // Fetch what this deployment actually supports
    apiGet("/api/algorithms/supported")
      .then(setSupported)
      .catch(() => setSupported(null));
  }, []);

  const totalVariants = ALGORITHMS.reduce((n, a) => n + a.variants.length, 0);

  return (
    <div className="space-y-10 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${theme.panelTitle}`}>Supported Algorithms</h1>
        <p className={theme.mutedText}>
          Complete reference for all post-quantum cryptographic algorithms supported by QuantumShield,
          implemented via liboqs. All primary schemes are NIST FIPS standardized.
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        {[
          [`${totalVariants} Parameter Sets`, "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"],
          ["2 KEM Families",                  "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"],
          ["3 Signature Families",            "bg-purple-500/10 text-purple-400 border-purple-500/30"],
          ["NIST FIPS 203/204/205/206",       "bg-green-500/10 text-green-400 border-green-500/30"],
          ["liboqs 0.10+ / 0.15+",           "bg-gray-500/10 text-gray-400 border-gray-600"],
        ].map(([label, cls]) => (
          <span key={label} className={`px-3 py-1 rounded-full text-xs border font-medium ${cls}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Live support status */}
      {supported && (
        <div className={`${theme.panel} p-5 rounded-xl border border-gray-800`}>
          <h2 className={`text-sm font-semibold mb-3 ${theme.panelTitle}`}>
            Live Backend Support
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-400 mb-2 font-medium uppercase tracking-wide">
                KEM ({supported.kem?.length || 0} mechanisms)
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(supported.kem || []).map(m => (
                  <div key={m} className="font-mono text-cyan-400">✓ {m}</div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-gray-400 mb-2 font-medium uppercase tracking-wide">
                Signature ({supported.signature?.length || 0} mechanisms)
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(supported.signature || []).map(m => (
                  <div key={m} className="font-mono text-purple-400">✓ {m}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick decision guide */}
      <div className={`${theme.panel} p-5 rounded-xl border border-gray-800`}>
        <h2 className={`text-sm font-semibold mb-4 ${theme.panelTitle}`}>Quick Decision Guide</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ["I need key exchange / encryption",     "kyber768 (ML-KEM-768)"],
            ["I need digital signatures",            "dilithium3 (ML-DSA-65)"],
            ["I need the smallest signatures",       "falcon512"],
            ["I need maximum conservative security", "sphincs-sha2-128s"],
            ["I need 256-bit security",              "kyber1024 + dilithium5"],
            ["I distrust lattice assumptions",       "sphincs-sha2-256f (hash only)"],
            ["IoT / embedded / certificates",        "falcon-padded-512"],
            ["Long-term archival (50yr+)",           "kyber1024 + falcon1024"],
            ["Conservative KEM alternative",         "frodokem-976-shake"],
            ["Maximum KEM security",                 "frodokem-1344-aes"],
          ].map(([q, a]) => (
            <div key={q} className="flex gap-3 text-xs border border-gray-800 rounded-lg p-3">
              <span className="text-gray-400 flex-1">{q}</span>
              <code className="text-cyan-400 font-mono shrink-0">{a}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Algorithm families */}
      {ALGORITHMS.map((alg) => (
        <div key={alg.family} className={`${theme.panel} rounded-xl border ${FAMILY_BORDER[alg.color]} overflow-hidden`}>
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className={`text-lg font-bold ${FAMILY_TITLE[alg.color]}`}>{alg.family}</h2>
              <span className={`px-2 py-0.5 rounded-md text-xs border ${TYPE_COLORS[alg.type]}`}>
                {alg.type}
              </span>
              <span className="text-xs text-gray-500 font-mono">{alg.standard}</span>
              <span className="text-xs text-gray-600">· {alg.variants.length} variants</span>
            </div>
            <p className={`text-sm mt-2 ${theme.mutedText}`}>{alg.description}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wide">
                  <Th>Input param</Th>
                  <Th>oqs Name</Th>
                  <Th>Security</Th>
                  <Th>NIST L</Th>
                  {alg.variants[0].ciphertext && <Th>Ciphertext</Th>}
                  {alg.variants[0].sigSize    && <Th>Sig Size</Th>}
                  <Th>Key (pub/priv)</Th>
                  <Th>Speed</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {alg.variants.map((v, i) => (
                  <tr key={v.param} className={`border-b border-gray-800/50 ${i % 2 === 0 ? "" : "bg-black/10"}`}>
                    <td className="px-4 py-2.5 font-mono text-cyan-300">{v.param}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">{v.alias}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-200">{v.security}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                        L{v.nistLevel}
                      </span>
                    </td>
                    {alg.variants[0].ciphertext && (
                      <td className="px-4 py-2.5 font-mono text-gray-400">{v.ciphertext || "—"}</td>
                    )}
                    {alg.variants[0].sigSize && (
                      <td className="px-4 py-2.5 font-mono text-gray-400">{v.sigSize || "—"}</td>
                    )}
                    <td className="px-4 py-2.5 font-mono text-gray-500">{v.keySize || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400">{v.speed}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-semibold ${STATUS_COLORS[v.status] || "text-gray-400"}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Classical baseline */}
      <div className={`${theme.panel} p-5 rounded-xl border border-gray-800`}>
        <h2 className={`text-sm font-semibold mb-3 ${theme.panelTitle}`}>
          Classical Baseline (migration context)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wide">
                <Th>Algorithm</Th>
                <Th>Type</Th>
                <Th>Classical Security</Th>
                <Th>Quantum Security</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ["RSA-2048",  "Encryption/Sig",  "112-bit", "~0-bit (Shor's)",  "⚠ MIGRATE NOW"],
                ["RSA-4096",  "Encryption/Sig",  "140-bit", "~0-bit (Shor's)",  "⚠ MIGRATE NOW"],
                ["ECC P-256", "Key Exchange/Sig", "128-bit", "~0-bit (Shor's)",  "⚠ MIGRATE NOW"],
                ["ECC P-384", "Key Exchange/Sig", "192-bit", "~0-bit (Shor's)",  "⚠ MIGRATE NOW"],
                ["AES-256",   "Symmetric",        "256-bit", "128-bit (Grover)", "✓ SAFE"],
                ["SHA-256",   "Hash",             "256-bit", "128-bit (Grover)", "✓ SAFE"],
                ["SHA-3",     "Hash",             "256-bit", "128-bit (Grover)", "✓ SAFE"],
              ].map(([alg, type, cls, qnt, status]) => (
                <tr key={alg} className="border-b border-gray-800/50">
                  <td className="px-4 py-2.5 font-mono text-gray-300">{alg}</td>
                  <td className="px-4 py-2.5 text-gray-400">{type}</td>
                  <td className="px-4 py-2.5 text-gray-400">{cls}</td>
                  <td className={`px-4 py-2.5 font-semibold ${status.includes("MIGRATE") ? "text-red-400" : "text-green-400"}`}>
                    {qnt}
                  </td>
                  <td className={`px-4 py-2.5 font-semibold text-xs ${status.includes("MIGRATE") ? "text-red-400" : "text-green-400"}`}>
                    {status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`text-xs mt-3 ${theme.mutedText}`}>
          All asymmetric classical algorithms (RSA, ECC, DH) are broken by Shor's algorithm on a sufficiently
          powerful quantum computer. Cryptographically relevant quantum computers are projected within 10–15 years.
          Begin migration now — data encrypted today can be harvested and decrypted later ("harvest now, decrypt later").
        </p>
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="text-left px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-medium">
      {children}
    </th>
  );
}