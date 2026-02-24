import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

import KeyExplainDrawer from "./KeyExplainDrawer";
import KeyTimeline from "../replay/KeyTimeline";

import {
  KeysAPI,
  TelemetryAPI,
} from "../../services/apiClient";

/**
 * KeyExplorer
 *
 * Deep inspection surface for cryptographic keys.
 *
 * - Deterministic
 * - Audit-safe
 * - Environment portable
 * - Uses centralized API client
 */
export default function KeyExplorer() {
  const { theme } = useTheme();

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [explainKeyId, setExplainKeyId] = useState(null);
  const [replayKeyId, setReplayKeyId] = useState(null);

  // =====================================================
  // Load keys + governance metadata
  // =====================================================
  useEffect(() => {
    let mounted = true;

    async function loadKeys() {
      try {
        setLoading(true);
        setError(null);

        const { keys: rawKeys = [] } = await KeysAPI.list();

        const enriched = await Promise.all(
          rawKeys.map(async (k) => {
            const keyId = k.key_id;

            const policyRes = await KeysAPI.status(keyId);

            return {
              ...k,
              policy: policyRes?.policy || null,
              telemetry: null,   // placeholder
              migration: null,   // placeholder
            };
          })
        );

        if (mounted) setKeys(enriched);
      } catch (err) {
        console.error("KeyExplorer error:", err);
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadKeys();
    return () => {
      mounted = false;
    };
  }, []);

  // =====================================================
  // States
  // =====================================================
  if (loading) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <p className={theme.mutedText}>Loading key governance data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl border border-red-500`}>
        <p className="text-red-400 font-semibold">Key Explorer Error</p>
        <p className={theme.mutedText}>{error}</p>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================
  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
            🗂️ Key Explorer
          </h2>
          <p className={theme.mutedText}>
            Inspect cryptographic keys, policy posture, usage, and migration risk.
          </p>
        </div>

        <div className={`${theme.panel} rounded-xl overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <Th>ID</Th>
                <Th>Scheme</Th>
                <Th>Posture</Th>
                <Th>Policy</Th>
                <Th>Migration</Th>
                <Th>Usage</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {keys.map((k) => {
                const governance = deriveGovernanceStatus(k);

                return (
                  <tr
                    key={k.key_id}
                    className="border-b border-gray-800 hover:bg-gray-900/40"
                  >
                    <Td mono>{shortId(k.key_id)}</Td>

                    <Td>
                      <div className="font-medium">{k.algorithm}</div>
                      <div className="text-xs text-gray-400">
                        {k.parameter_set}
                      </div>
                    </Td>

                    <Td>
                      <StatusBadge
                        value={governance.posture}
                        type={governance.postureType}
                      />
                    </Td>

                    <Td>
                      <StatusBadge
                        value={governance.policy}
                        type={governance.policyType}
                      />
                    </Td>

                    <Td>
                      <StatusBadge
                        value={governance.migration}
                        type={governance.migrationType}
                      />
                    </Td>

                    <Td>
                      <div className="text-xs">
                        🔐 {k.telemetry?.encrypt_count ?? "—"} enc
                      </div>
                      <div className="text-xs">
                        🔓 {k.telemetry?.decrypt_count ?? "—"} dec
                      </div>
                    </Td>

                    <Td>
                      <div className="flex gap-2">
                        <ActionButton
                          label="Explain"
                          onClick={() => setExplainKeyId(k.key_id)}
                        />
                        <ActionButton
                          label="Replay"
                          onClick={() => setReplayKeyId(k.key_id)}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explain drawer */}
      {explainKeyId && (
        <KeyExplainDrawer
          keyId={explainKeyId}
          onClose={() => setExplainKeyId(null)}
        />
      )}

      {/* Replay drawer */}
      {replayKeyId && (
        <div className="fixed inset-0 z-40 bg-black/60 flex justify-center items-center">
          <div className={`${theme.panel} w-full max-w-3xl p-6 rounded-xl`}>
            <div className="flex justify-between mb-4">
              <h3 className="text-lg font-semibold">Key Replay</h3>
              <button
                className="text-xs text-red-400"
                onClick={() => setReplayKeyId(null)}
              >
                Close
              </button>
            </div>

            <KeyTimeline keyId={replayKeyId} />
          </div>
        </div>
      )}
    </>
  );
}

// =====================================================
// Governance Normalization (CRITICAL)
// =====================================================

function deriveGovernanceStatus(key) {
  const policyAllowed = key.policy?.allowed;
  const severity = key.migration?.severity;

  const posture =
    policyAllowed === false || severity === "EMERGENCY"
      ? "CRITICAL"
      : severity === "MIGRATE_SOON"
      ? "ELEVATED"
      : "STABLE";

  return {
    posture,
    postureType:
      posture === "CRITICAL"
        ? "danger"
        : posture === "ELEVATED"
        ? "warn"
        : "ok",

    policy: policyAllowed === false ? "DENIED" : "ALLOWED",
    policyType: policyAllowed === false ? "danger" : "ok",

    migration: severity || "OK",
    migrationType:
      severity === "EMERGENCY"
        ? "danger"
        : severity === "MIGRATE_SOON"
        ? "warn"
        : "ok",
  };
}

// =====================================================
// Helpers
// =====================================================

function shortId(id) {
  return id.slice(0, 8) + "…";
}

function Th({ children }) {
  return (
    <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-400">
      {children}
    </th>
  );
}

function Td({ children, mono = false }) {
  return (
    <td className={`px-4 py-3 ${mono ? "font-mono text-cyan-400" : ""}`}>
      {children}
    </td>
  );
}

function StatusBadge({ value, type }) {
  const colors = {
    ok: "bg-green-500/10 text-green-400 border-green-500/30",
    warn: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    danger: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={`px-2 py-1 rounded-md text-xs border ${
        colors[type] || colors.ok
      }`}
    >
      {value}
    </span>
  );
}

function ActionButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
    >
      {label}
    </button>
  );
}