import { useEffect, useState } from "react";
import { FaLock, FaKey, FaCheckCircle, FaExclamationTriangle, FaSpinner } from "react-icons/fa";
import SectionHeader from "../components/layout/SectionHeader";
import KeygenPanel from "../components/crypto/KeygenPanel";
import EncryptForm from "../components/crypto/EncryptForm";
import DecryptForm from "../components/crypto/DecryptForm";
import SignForm from "../components/crypto/SignForm";
import VerifyForm from "../components/crypto/VerifyForm";
import { useActiveKey } from "../context/ActiveKeyContext";

const TABS = ["Encrypt / Decrypt", "Sign / Verify"];

export default function CryptoPage() {
  const { activeKey, refreshActiveKey } = useActiveKey();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    refreshActiveKey().finally(() => setLoading(false));
  }, []);

  const isKem = activeKey?.key_type === "kem";
  const isSig = activeKey?.key_type === "signature";

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Crypto Operations"
        subtitle="Key generation, encryption, decryption, signing, and verification"
        icon={<FaLock style={{ color: "var(--accent)" }} />}
      />

      {/* Active Key Banner */}
      <div className="rounded-xl p-4 text-sm" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        {loading ? (
          <span className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <FaSpinner className="animate-spin text-xs" /> Checking active key…
          </span>
        ) : activeKey ? (
          <div className="flex flex-wrap gap-6 items-center justify-between">
            <div className="space-y-1">
              <div className="font-semibold flex items-center gap-2 text-green-400">
                <FaCheckCircle className="text-xs" /> Active Key Enabled
              </div>
              <div className="text-xs">
                <span style={{ color: "var(--text-muted)" }}>Key ID:</span>{" "}
                <span className="font-mono" style={{ color: "var(--accent)" }}>{activeKey.key_id}</span>
              </div>
              <div className="flex gap-4 text-xs">
                <span>
                  <span style={{ color: "var(--text-muted)" }}>Algorithm:</span>{" "}
                  <span style={{ color: "var(--text-primary)" }}>{activeKey.algorithm}</span>
                </span>
                <span>
                  <span style={{ color: "var(--text-muted)" }}>Params:</span>{" "}
                  <span style={{ color: "var(--text-primary)" }}>{activeKey.parameter_set}</span>
                </span>
                <span>
                  <span style={{ color: "var(--text-muted)" }}>Type:</span>{" "}
                  <span style={{ color: isKem ? "var(--accent)" : "#a78bfa" }}>
                    {activeKey.key_type?.toUpperCase()}
                  </span>
                </span>
              </div>
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {isKem && "→ Use Encrypt / Decrypt tab"}
              {isSig && "→ Use Sign / Verify tab"}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-400">
            <FaExclamationTriangle className="text-xs" />
            No active key — generate a key below and click "Set as Active Key"
          </div>
        )}
      </div>

      {/* Key Generation */}
      <KeygenPanel onActivated={refreshActiveKey} />

      {/* Tab switcher */}
      <div className="flex gap-2 pb-0" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className="px-4 py-2 text-sm font-medium rounded-t-lg transition"
            style={{
              background: tab === i ? "var(--nav-active-bg)" : "transparent",
              color: tab === i ? "var(--accent)" : "var(--text-muted)",
              borderBottom: tab === i ? `2px solid var(--accent)` : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && (
        <div className="space-y-4">
          {activeKey && !isKem && (
            <div className="text-xs rounded-lg p-3 flex items-center gap-2 text-yellow-400"
              style={{ border: "1px solid rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.05)" }}>
              <FaExclamationTriangle />
              Active key is a <strong>{activeKey.key_type}</strong> key — it cannot encrypt/decrypt.
              Generate a Kyber or FrodoKEM key and set it active for encryption.
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EncryptForm activeKey={isKem ? activeKey : null} />
            <DecryptForm activeKey={isKem ? activeKey : null} />
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="space-y-4">
          {activeKey && !isSig && (
            <div className="text-xs rounded-lg p-3 flex items-center gap-2 text-yellow-400"
              style={{ border: "1px solid rgba(234,179,8,0.3)", background: "rgba(234,179,8,0.05)" }}>
              <FaExclamationTriangle />
              Active key is a <strong>{activeKey.key_type}</strong> key — it cannot sign/verify.
              Generate a Dilithium, Falcon, or SPHINCS+ key and set it active for signing.
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SignForm activeKey={isSig ? activeKey : null} />
            <VerifyForm activeKey={isSig ? activeKey : null} />
          </div>
        </div>
      )}
    </div>
  );
}
