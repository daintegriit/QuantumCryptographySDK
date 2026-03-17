// src/pages/AuditPage.jsx

import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";

import Spinner from "../components/common/Spinner";
import EmptyState from "../components/common/EmptyState";
import TimelineEvent from "../components/replay/TimelineEvent";

import { apiGet } from "../services/apiClient";

/**
 * AuditPage
 *
 * System-wide immutable cryptographic audit trail.
 *
 * - Read-only
 * - Deterministic
 * - Compliance-grade
 * - Active key banner always shown (if available)
 */
export default function AuditPage() {
  const { theme } = useTheme();

  const [activeKey, setActiveKey] = useState(null);
  const [audit, setAudit] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  async function loadActiveKey() {
    try {
      const res = await apiGet("/api/keys/active");
      setActiveKey(res?.active ? res.key : null);
    } catch {
      setActiveKey(null);
    }
  }

  // =====================================================
  // Load full audit replay (system-wide)
  // =====================================================
  useEffect(() => {
    async function loadAudit() {
      try {
        setLoading(true);
        setError(null);

        // backend endpoint is /api/telemetry/replay
        const data = await apiGet("/api/telemetry/replay");
        setAudit(data);

        await loadActiveKey();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAudit();
  }, []);

  // =====================================================
  // States
  // =====================================================
  if (loading) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <Spinner label="Reconstructing immutable audit trail…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl border border-red-500`}>
        <p className="text-red-400 font-semibold">Audit Error</p>
        <p className={theme.mutedText}>{error}</p>
      </div>
    );
  }

  const hasTimelines =
    audit?.timelines && Object.keys(audit.timelines).length > 0;

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="space-y-8">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <div>
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
          Audit Trail
        </h2>
        <p className={theme.mutedText}>
          Immutable, chronological record of cryptographic operations, key
          lifecycle transitions, policy enforcement, and quantum-risk decisions.
        </p>
      </div>

      {/* ================= ACTIVE KEY BANNER (SAME STYLE) ================= */}
      <div className="border border-cyan-500/30 rounded-xl p-4 text-sm">
        {activeKey ? (
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
            ⚠ No active key selected — audit is system-wide only
          </div>
        )}
      </div>

      {/* ============================= */}
      {/* No Audit Data */}
      {/* ============================= */}
      {!hasTimelines ? (
        <EmptyState
          title="No Audit Data"
          description="No cryptographic events have been recorded yet."
        />
      ) : (
        <>
          {/* ============================= */}
          {/* Audit Summary */}
          {/* ============================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AuditStat label="Keys Observed" value={audit.total_keys} />

            <AuditStat
              label="Snapshot Generated"
              value={new Date(audit.generated_at_utc).toLocaleString()}
            />

            <AuditStat
              label="Audit Integrity"
              value="Append-Only · Immutable"
              highlight
            />
          </div>

          {/* ============================= */}
          {/* Key Timelines */}
          {/* ============================= */}
          <div className="space-y-6">
            {Object.entries(audit.timelines).map(([keyId, timeline]) => (
              <div
                key={keyId}
                className={`${theme.panel} p-6 rounded-xl space-y-4`}
              >
                {/* ================= Key Header ================= */}
                <div className="flex flex-wrap gap-4 justify-between items-center">
                  <div>
                    <div className="font-mono text-cyan-400 text-sm">
                      {keyId}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {timeline.scheme} · {timeline.parameter_set}
                    </div>
                  </div>

                  <StatusBadge status={timeline.final_status} />
                </div>

                {/* ================= Timeline ================= */}
                <div className="space-y-4">
                  {timeline.events.map((ev, idx) => (
                    <TimelineEvent key={`${keyId}-${idx}`} event={ev} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================
// Components
// =====================================================

function AuditStat({ label, value, highlight = false }) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        highlight
          ? "border-purple-500/40 text-purple-400"
          : "border-gray-800 text-cyan-400"
      }`}
    >
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    ACTIVE: "border-green-500/30 text-green-400",
    SUPERSEDED: "border-gray-600 text-gray-400",
    RESTRICTED: "border-yellow-500/30 text-yellow-400",
  };

  return (
    <span
      className={`text-xs px-3 py-1 rounded-md border ${
        styles[status] || styles.SUPERSEDED
      }`}
    >
      {status}
    </span>
  );
}