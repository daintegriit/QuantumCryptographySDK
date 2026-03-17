// src/pages/CryptoPage.jsx

import { useEffect, useState } from "react";
import SectionHeader from "../components/layout/SectionHeader";

import KeygenPanel from "../components/crypto/KeygenPanel";
import EncryptForm from "../components/crypto/EncryptForm";
import DecryptForm from "../components/crypto/DecryptForm";

import { apiGet } from "../services/apiClient";

export default function CryptoPage() {
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadActiveKey() {
    try {
      setLoading(true);
      const res = await apiGet("/api/keys/active");
      setActiveKey(res?.active ? res.key : null);
    } catch {
      setActiveKey(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActiveKey();
  }, []);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Crypto Operations"
        subtitle="Key generation, encryption, decryption, and lifecycle control"
      />

      {/* Active Key Banner */}
      <div className="border border-cyan-500/30 rounded-xl p-4 text-sm">
        {loading ? (
          <span className="text-gray-400">Checking active key…</span>
        ) : activeKey ? (
          <div className="space-y-1">
            <div className="text-green-400 font-semibold">
              Active Key Enabled
            </div>
            <div>
              <span className="text-gray-400">Key ID:</span>{" "}
              <span className="font-mono text-cyan-300">
                {activeKey.key_id}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Algorithm:</span>{" "}
              {activeKey.algorithm}
            </div>
          </div>
        ) : (
          <div className="text-yellow-400">
            ⚠ No active key selected — encryption and decryption are disabled
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <KeygenPanel onActivated={loadActiveKey} />
        <EncryptForm activeKey={activeKey} />
        <DecryptForm activeKey={activeKey} />
      </div>
    </div>
  );
}