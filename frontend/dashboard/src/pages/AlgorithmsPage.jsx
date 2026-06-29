import { useEffect, useState } from "react";
import { FaMicrochip, FaShieldAlt, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { apiGet } from "../services/apiClient";

const ALGORITHMS = [
  {
    family: "Kyber / ML-KEM", type: "KEM", standard: "NIST FIPS 203",
    description: "Module-Lattice Key Encapsulation Mechanism. Primary NIST-standardized post-quantum KEM. Use for key exchange and hybrid encryption.",
    color: "cyan",
    variants: [
      { param: "kyber512",       alias: "ML-KEM-512",  security: "128-bit", nistLevel: 1, keySize: "800B / 1632B",   ciphertext: "768B",  speed: "Fastest",  status: "RECOMMENDED" },
      { param: "kyber768",       alias: "ML-KEM-768",  security: "192-bit", nistLevel: 3, keySize: "1184B / 2400B",  ciphertext: "1088B", speed: "Fast",     status: "RECOMMENDED" },
      { param: "kyber1024",      alias: "ML-KEM-1024", security: "256-bit", nistLevel: 5, keySize: "1568B / 3168B",  ciphertext: "1568B", speed: "Standard", status: "HIGH SECURITY" },
      { param: "ml-kem-512",     alias: "ML-KEM-512",  security: "128-bit", nistLevel: 1, keySize: "800B / 1632B",   ciphertext: "768B",  speed: "Fastest",  status: "FIPS NAME" },
      { param: "ml-kem-768",     alias: "ML-KEM-768",  security: "192-bit", nistLevel: 3, keySize: "1184B / 2400B",  ciphertext: "1088B", speed: "Fast",     status: "FIPS NAME" },
      { param: "ml-kem-1024",    alias: "ML-KEM-1024", security: "256-bit", nistLevel: 5, keySize: "1568B / 3168B",  ciphertext: "1568B", speed: "Standard", status: "FIPS NAME" },
    ],
  },
  {
    family: "Dilithium / ML-DSA", type: "Signature", standard: "NIST FIPS 204",
    description: "Module-Lattice Digital Signature Algorithm. Primary NIST-standardized post-quantum signature scheme.",
    color: "purple",
    variants: [
      { param: "dilithium2", alias: "ML-DSA-44", security: "128-bit", nistLevel: 2, keySize: "1312B / 2528B", sigSize: "2420B", speed: "Fastest",  status: "RECOMMENDED" },
      { param: "dilithium3", alias: "ML-DSA-65", security: "192-bit", nistLevel: 3, keySize: "1952B / 4000B", sigSize: "3293B", speed: "Fast",     status: "RECOMMENDED" },
      { param: "dilithium5", alias: "ML-DSA-87", security: "256-bit", nistLevel: 5, keySize: "2592B / 4864B", sigSize: "4595B", speed: "Standard", status: "HIGH SECURITY" },
      { param: "ml-dsa-44",  alias: "ML-DSA-44", security: "128-bit", nistLevel: 2, keySize: "1312B / 2528B", sigSize: "2420B", speed: "Fastest",  status: "FIPS NAME" },
      { param: "ml-dsa-65",  alias: "ML-DSA-65", security: "192-bit", nistLevel: 3, keySize: "1952B / 4000B", sigSize: "3293B", speed: "Fast",     status: "FIPS NAME" },
      { param: "ml-dsa-87",  alias: "ML-DSA-87", security: "256-bit", nistLevel: 5, keySize: "2592B / 4864B", sigSize: "4595B", speed: "Standard", status: "FIPS NAME" },
    ],
  },
  {
    family: "Falcon", type: "Signature", standard: "NIST FIPS 206",
    description: "NTRU-lattice based signature scheme. Smallest signatures of any NIST PQC scheme. Ideal for IoT, certificates, and embedded systems.",
    color: "orange",
    variants: [
      { param: "falcon512",          alias: "Falcon-512",         security: "128-bit", nistLevel: 1, keySize: "897B / 1281B",   sigSize: "~666B",  speed: "Standard", status: "RECOMMENDED" },
      { param: "falcon1024",         alias: "Falcon-1024",        security: "256-bit", nistLevel: 5, keySize: "1793B / 2305B",  sigSize: "~1280B", speed: "Standard", status: "HIGH SECURITY" },
      { param: "falcon-padded-512",  alias: "Falcon-padded-512",  security: "128-bit", nistLevel: 1, keySize: "897B / 1281B",   sigSize: "809B",   speed: "Standard", status: "CONSTANT TIME" },
      { param: "falcon-padded-1024", alias: "Falcon-padded-1024", security: "256-bit", nistLevel: 5, keySize: "1793B / 2305B",  sigSize: "1577B",  speed: "Standard", status: "CONSTANT TIME" },
    ],
  },
  {
    family: "SPHINCS+ / SLH-DSA", type: "Signature", standard: "NIST FIPS 205",
    description: "Hash-based stateless signatures. Conservative choice — security based only on hash functions. Larger sigs but maximum long-term trust.",
    color: "green",
    variants: [
      { param: "sphincs-sha2-128f",  alias: "SPHINCS+-SHA2-128f", security: "128-bit", nistLevel: 1, sigSize: "17.1KB", speed: "Slow",    status: "RECOMMENDED" },
      { param: "sphincs-sha2-192f",  alias: "SPHINCS+-SHA2-192f", security: "192-bit", nistLevel: 3, sigSize: "35.7KB", speed: "Slow",    status: "RECOMMENDED" },
      { param: "sphincs-sha2-256f",  alias: "SPHINCS+-SHA2-256f", security: "256-bit", nistLevel: 5, sigSize: "49.9KB", speed: "Slow",    status: "HIGH SECURITY" },
      { param: "sphincs-sha2-128s",  alias: "SPHINCS+-SHA2-128s", security: "128-bit", nistLevel: 1, sigSize: "7.9KB",  speed: "Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-sha2-192s",  alias: "SPHINCS+-SHA2-192s", security: "192-bit", nistLevel: 3, sigSize: "16.2KB", speed: "Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-sha2-256s",  alias: "SPHINCS+-SHA2-256s", security: "256-bit", nistLevel: 5, sigSize: "29.8KB", speed: "Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-shake-128f", alias: "SPHINCS+-SHAKE-128f", security: "128-bit", nistLevel: 1, sigSize: "17.1KB", speed: "Slow",   status: "RECOMMENDED" },
      { param: "sphincs-shake-192f", alias: "SPHINCS+-SHAKE-192f", security: "192-bit", nistLevel: 3, sigSize: "35.7KB", speed: "Slow",   status: "RECOMMENDED" },
      { param: "sphincs-shake-256f", alias: "SPHINCS+-SHAKE-256f", security: "256-bit", nistLevel: 5, sigSize: "49.9KB", speed: "Slow",   status: "HIGH SECURITY" },
      { param: "sphincs-shake-128s", alias: "SPHINCS+-SHAKE-128s", security: "128-bit", nistLevel: 1, sigSize: "7.9KB",  speed: "Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-shake-192s", alias: "SPHINCS+-SHAKE-192s", security: "192-bit", nistLevel: 3, sigSize: "16.2KB", speed: "Slowest", status: "SMALLEST SIG" },
      { param: "sphincs-shake-256s", alias: "SPHINCS+-SHAKE-256s", security: "256-bit", nistLevel: 5, sigSize: "29.8KB", speed: "Slowest", status: "SMALLEST SIG" },
    ],
  },
  {
    family: "FrodoKEM", type: "KEM", standard: "ISO/NIST Candidate",
    description: "LWE-based KEM. Conservative alternative to Kyber — unstructured lattices, larger keys but more conservative security assumptions.",
    color: "yellow",
    variants: [
      { param: "frodokem-640-aes",    alias: "FrodoKEM-640-AES",    security: "128-bit", nistLevel: 1, keySize: "9616B / 19888B",  ciphertext: "9720B",  speed: "Slow",    status: "CONSERVATIVE" },
      { param: "frodokem-640-shake",  alias: "FrodoKEM-640-SHAKE",  security: "128-bit", nistLevel: 1, keySize: "9616B / 19888B",  ciphertext: "9720B",  speed: "Slow",    status: "CONSERVATIVE" },
      { param: "frodokem-976-aes",    alias: "FrodoKEM-976-AES",    security: "192-bit", nistLevel: 3, keySize: "15632B / 31296B", ciphertext: "15744B", speed: "Slower",  status: "CONSERVATIVE" },
      { param: "frodokem-976-shake",  alias: "FrodoKEM-976-SHAKE",  security: "192-bit", nistLevel: 3, keySize: "15632B / 31296B", ciphertext: "15744B", speed: "Slower",  status: "CONSERVATIVE" },
      { param: "frodokem-1344-aes",   alias: "FrodoKEM-1344-AES",   security: "256-bit", nistLevel: 5, keySize: "21520B / 43088B", ciphertext: "21632B", speed: "Slowest", status: "MAX SECURITY" },
      { param: "frodokem-1344-shake", alias: "FrodoKEM-1344-SHAKE", security: "256-bit", nistLevel: 5, keySize: "21520B / 43088B", ciphertext: "21632B", speed: "Slowest", status: "MAX SECURITY" },
    ],
  },
];

const COLOR_MAP = {
  cyan:   { text: "var(--accent)",  border: "rgba(6,182,212,0.25)",   bg: "rgba(6,182,212,0.05)"   },
  purple: { text: "#a78bfa",        border: "rgba(167,139,250,0.25)", bg: "rgba(167,139,250,0.05)" },
  orange: { text: "#fb923c",        border: "rgba(251,146,60,0.25)",  bg: "rgba(251,146,60,0.05)"  },
  green:  { text: "#4ade80",        border: "rgba(74,222,128,0.25)",  bg: "rgba(74,222,128,0.05)"  },
  yellow: { text: "#facc15",        border: "rgba(250,204,21,0.25)",  bg: "rgba(250,204,21,0.05)"  },
};

const STATUS_COLORS = {
  "RECOMMENDED":   "#4ade80",
  "HIGH SECURITY": "#60a5fa",
  "CONSERVATIVE":  "#facc15",
  "CONSTANT TIME": "var(--accent)",
  "SMALLEST SIG":  "#a78bfa",
  "MAX SECURITY":  "#f87171",
  "FIPS NAME":     "var(--text-muted)",
};

export default function AlgorithmsPage() {
  const [supported, setSupported] = useState(null);

  useEffect(() => {
    apiGet("/api/algorithms/supported").then(setSupported).catch(() => setSupported(null));
  }, []);

  const totalVariants = ALGORITHMS.reduce((n, a) => n + a.variants.length, 0);

  return (
    <div className="space-y-10 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <FaMicrochip style={{ color: "var(--accent)" }} /> Supported Algorithms
        </h1>
        <p className="mt-1" style={{ color: "var(--text-muted)" }}>
          Complete reference for all post-quantum cryptographic algorithms supported by QuantumShield,
          implemented via liboqs. All primary schemes are NIST FIPS standardized.
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        {[
          [`${totalVariants} Parameter Sets`, "var(--accent)",  "rgba(6,182,212,0.2)"],
          ["2 KEM Families",                  "var(--accent)",  "rgba(6,182,212,0.2)"],
          ["3 Signature Families",            "#a78bfa",         "rgba(167,139,250,0.2)"],
          ["NIST FIPS 203/204/205/206",       "#4ade80",         "rgba(74,222,128,0.2)"],
          ["liboqs 0.10+",                    "var(--text-muted)", "var(--border)"],
        ].map(([label, color, border]) => (
          <span key={label} className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ color, border: `1px solid ${border}`, background: `${border}` }}>
            {label}
          </span>
        ))}
      </div>

      {/* Live support */}
      {supported && (
        <div className="rounded-xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FaShieldAlt style={{ color: "var(--accent)" }} /> Live Backend Support
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="mb-2 font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                KEM ({supported.kem?.length || 0} mechanisms)
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(supported.kem || []).map(m => (
                  <div key={m} className="font-mono flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                    <FaCheckCircle className="text-xs" /> {m}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Signature ({supported.signature?.length || 0} mechanisms)
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(supported.signature || []).map(m => (
                  <div key={m} className="font-mono flex items-center gap-1.5 text-purple-400">
                    <FaCheckCircle className="text-xs" /> {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick decision guide */}
      <div className="rounded-xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Quick Decision Guide</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ["I need key exchange / encryption",     "kyber768 (ML-KEM-768)"],
            ["I need digital signatures",            "dilithium3 (ML-DSA-65)"],
            ["I need the smallest signatures",       "falcon512"],
            ["I need maximum conservative security", "sphincs-sha2-128s"],
            ["I need 256-bit security",              "kyber1024 + dilithium5"],
            ["I distrust lattice assumptions",       "sphincs-sha2-256f"],
            ["IoT / embedded / certificates",        "falcon-padded-512"],
            ["Long-term archival (50yr+)",           "kyber1024 + falcon1024"],
            ["Conservative KEM alternative",         "frodokem-976-shake"],
            ["Maximum KEM security",                 "frodokem-1344-aes"],
          ].map(([q, a]) => (
            <div key={q} className="flex gap-3 text-xs rounded-lg p-3"
              style={{ border: "1px solid var(--border)", background: "var(--input-bg)" }}>
              <span className="flex-1" style={{ color: "var(--text-muted)" }}>{q}</span>
              <code className="font-mono shrink-0" style={{ color: "var(--accent)" }}>{a}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Algorithm families */}
      {ALGORITHMS.map((alg) => {
        const c = COLOR_MAP[alg.color];
        return (
          <div key={alg.family} className="rounded-xl overflow-hidden"
            style={{ background: "var(--panel)", border: `1px solid ${c.border}` }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)", background: c.bg }}>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold" style={{ color: c.text }}>{alg.family}</h2>
                <span className="px-2 py-0.5 rounded-md text-xs border"
                  style={{ color: alg.type === "KEM" ? "var(--accent)" : "#a78bfa",
                           borderColor: alg.type === "KEM" ? "rgba(6,182,212,0.3)" : "rgba(167,139,250,0.3)",
                           background: alg.type === "KEM" ? "rgba(6,182,212,0.1)" : "rgba(167,139,250,0.1)" }}>
                  {alg.type}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{alg.standard}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {alg.variants.length} variants</span>
              </div>
              <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{alg.description}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Input param","oqs Name","Security","NIST L",
                      ...(alg.variants[0].ciphertext ? ["Ciphertext"] : []),
                      ...(alg.variants[0].sigSize    ? ["Sig Size"]   : []),
                      "Key (pub/priv)","Speed","Status"].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs uppercase tracking-wide font-medium"
                        style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alg.variants.map((v, i) => (
                    <tr key={v.param} style={{ borderBottom: "1px solid var(--border)", background: i % 2 ? "var(--input-bg)" : "transparent" }}>
                      <td className="px-4 py-2.5 font-mono" style={{ color: "var(--accent)" }}>{v.param}</td>
                      <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-muted)" }}>{v.alias}</td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text-primary)" }}>{v.security}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-1.5 py-0.5 rounded font-mono text-xs"
                          style={{ background: "var(--input-bg)", color: "var(--text-secondary, var(--text-primary))", border: "1px solid var(--border)" }}>
                          L{v.nistLevel}
                        </span>
                      </td>
                      {alg.variants[0].ciphertext && <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-muted)" }}>{v.ciphertext || "—"}</td>}
                      {alg.variants[0].sigSize    && <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-muted)" }}>{v.sigSize || "—"}</td>}
                      <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-muted)" }}>{v.keySize || "—"}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>{v.speed}</td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: STATUS_COLORS[v.status] || "var(--text-muted)" }}>{v.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Classical baseline */}
      <div className="rounded-xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaExclamationTriangle className="text-yellow-400" /> Classical Baseline (migration context)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Algorithm","Type","Classical Security","Quantum Security","Status"].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs uppercase tracking-wide font-medium"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["RSA-2048",  "Encryption/Sig",   "112-bit", "~0-bit (Shor's)",  false],
                ["RSA-4096",  "Encryption/Sig",   "140-bit", "~0-bit (Shor's)",  false],
                ["ECC P-256", "Key Exchange/Sig", "128-bit", "~0-bit (Shor's)",  false],
                ["ECC P-384", "Key Exchange/Sig", "192-bit", "~0-bit (Shor's)",  false],
                ["AES-256",   "Symmetric",        "256-bit", "128-bit (Grover)", true],
                ["SHA-256",   "Hash",             "256-bit", "128-bit (Grover)", true],
                ["SHA-3",     "Hash",             "256-bit", "128-bit (Grover)", true],
              ].map(([alg, type, cls, qnt, safe]) => (
                <tr key={alg} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-2.5 font-mono" style={{ color: "var(--text-primary)" }}>{alg}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>{type}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>{cls}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: safe ? "#4ade80" : "#f87171" }}>{qnt}</td>
                  <td className="px-4 py-2.5 font-semibold text-xs flex items-center gap-1.5 mt-1"
                    style={{ color: safe ? "#4ade80" : "#f87171" }}>
                    {safe ? <FaCheckCircle className="text-xs" /> : <FaExclamationTriangle className="text-xs" />}
                    {safe ? "SAFE" : "MIGRATE NOW"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          All asymmetric classical algorithms (RSA, ECC, DH) are broken by Shor's algorithm on a sufficiently
          powerful quantum computer. Begin migration now — data encrypted today can be harvested and decrypted later.
        </p>
      </div>
    </div>
  );
}
