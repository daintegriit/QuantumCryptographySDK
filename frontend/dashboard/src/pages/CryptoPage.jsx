// src/pages/CryptoPage.jsx
import { useEffect, useState } from "react";
import SectionHeader from "../components/layout/SectionHeader";
import KeygenPanel from "../components/crypto/KeygenPanel";
import EncryptForm from "../components/crypto/EncryptForm";
import DecryptForm from "../components/crypto/DecryptForm";
import SignForm from "../components/crypto/SignForm";
import VerifyForm from "../components/crypto/VerifyForm";
import { apiGet } from "../services/apiClient";
import { useActiveKey } from "../context/ActiveKeyContext";
import { useTheme } from "../context/ThemeContext";

const TABS = ["Encrypt / Decrypt", "Sign / Verify"];

export default function CryptoPage() {
  const { theme } = useTheme();
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
      />

      {/* Active Key Banner */}
      <div className="border border-cyan-500/30 rounded-xl p-4 text-sm">
        {loading ? (
          <span className="text-gray-400">Checking active key…</span>
        ) : activeKey ? (
          <div className="flex flex-wrap gap-6 items-center justify-between">
            <div className="space-y-1">
              <div className="text-green-400 font-semibold">Active Key Enabled</div>
              <div>
                <span className="text-gray-400">Key ID:</span>{" "}
                <span className="font-mono text-cyan-300">{activeKey.key_id}</span>
              </div>
              <div className="flex gap-4 text-xs">
                <span>
                  <span className="text-gray-400">Algorithm:</span>{" "}
                  <span className="text-gray-200">{activeKey.algorithm}</span>
                </span>
                <span>
                  <span className="text-gray-400">Params:</span>{" "}
                  <span className="text-gray-200">{activeKey.parameter_set}</span>
                </span>
                <span>
                  <span className="text-gray-400">Type:</span>{" "}
                  <span className={isKem ? "text-cyan-400" : "text-purple-400"}>
                    {activeKey.key_type?.toUpperCase()}
                  </span>
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {isKem && "→ Use Encrypt / Decrypt tab"}
              {isSig && "→ Use Sign / Verify tab"}
            </div>
          </div>
        ) : (
          <div className="text-yellow-400">
            ⚠ No active key — generate a key below and click "Set as Active Key"
          </div>
        )}
      </div>

      {/* Key Generation */}
      <KeygenPanel onActivated={refreshActiveKey} />

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              tab === i
                ? "bg-cyan-500/15 text-cyan-400 border-b-2 border-cyan-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && (
        <div className="space-y-4">
          {activeKey && !isKem && (
            <div className="text-xs text-yellow-400 border border-yellow-500/30 rounded-lg p-3">
              ⚠ Active key is a <strong>{activeKey.key_type}</strong> key — it cannot encrypt/decrypt.
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
            <div className="text-xs text-yellow-400 border border-yellow-500/30 rounded-lg p-3">
              ⚠ Active key is a <strong>{activeKey.key_type}</strong> key — it cannot sign/verify.
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