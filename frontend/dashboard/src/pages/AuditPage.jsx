import { useEffect, useState } from "react";
import { FaScroll, FaCheckCircle, FaExclamationTriangle, FaKey, FaSpinner } from "react-icons/fa";
import Spinner from "../components/common/Spinner";
import EmptyState from "../components/common/EmptyState";
import TimelineEvent from "../components/replay/TimelineEvent";
import { apiGet } from "../services/apiClient";

export default function AuditPage() {
  const [activeKey, setActiveKey] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadAudit() {
      try {
        setLoading(true); setError(null);
        const data = await apiGet("/api/telemetry/replay");
        setAudit(data);
        const res = await apiGet("/api/keys/active");
        setActiveKey(res?.active ? res.key : null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAudit();
  }, []);

  if (loading) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <Spinner label="Reconstructing immutable audit trail…" />
    </div>
  );

  if (error) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid rgba(239,68,68,0.5)" }}>
      <p className="font-semibold text-red-400">Audit Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </div>
  );

  const hasTimelines = audit?.timelines && Object.keys(audit.timelines).length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaScroll style={{ color: "var(--accent)" }} /> Audit Trail
        </h2>
        <p style={{ color: "var(--text-muted)" }}>
          Immutable, chronological record of cryptographic operations, key lifecycle transitions,
          policy enforcement, and quantum-risk decisions.
        </p>
      </div>

      <div className="rounded-xl p-4 text-sm" style={{ border: "1px solid var(--border)", background: "var(--panel)" }}>
        {activeKey ? (
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-2 text-green-400">
              <FaCheckCircle className="text-xs" /> Active Key Enabled
            </div>
            <div className="text-xs">
              <span style={{ color: "var(--text-muted)" }}>Key ID:</span>{" "}
              <span className="font-mono" style={{ color: "var(--accent)" }}>{activeKey.key_id}</span>
            </div>
            <div className="text-xs">
              <span style={{ color: "var(--text-muted)" }}>Algorithm:</span>{" "}
              <span style={{ color: "var(--text-primary)" }}>{activeKey.algorithm}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-400">
            <FaExclamationTriangle className="text-xs" /> No active key selected — audit is system-wide only
          </div>
        )}
      </div>

      {!hasTimelines ? (
        <EmptyState title="No Audit Data" description="No cryptographic events have been recorded yet." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AuditStat label="Keys Observed"      value={audit.total_keys} />
            <AuditStat label="Snapshot Generated" value={new Date(audit.generated_at_utc).toLocaleString()} />
            <AuditStat label="Audit Integrity"    value="Append-Only · Immutable" highlight />
          </div>

          <div className="space-y-6">
            {Object.entries(audit.timelines).map(([keyId, timeline]) => (
              <div key={keyId} className="p-6 rounded-xl space-y-4"
                style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
                <div className="flex flex-wrap gap-4 justify-between items-center">
                  <div>
                    <div className="font-mono text-sm flex items-center gap-2" style={{ color: "var(--accent)" }}>
                      <FaKey className="text-xs" /> {keyId}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {timeline.scheme} · {timeline.parameter_set}
                    </div>
                  </div>
                  <StatusBadge status={timeline.final_status} />
                </div>
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

function AuditStat({ label, value, highlight = false }) {
  return (
    <div className="p-4 rounded-xl" style={{
      border: highlight ? "1px solid rgba(167,139,250,0.4)" : "1px solid var(--border)",
      background: "var(--panel)",
    }}>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-sm font-semibold mt-1" style={{ color: highlight ? "#a78bfa" : "var(--accent)" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    ACTIVE:     { border: "rgba(74,222,128,0.3)",  color: "#4ade80" },
    SUPERSEDED: { border: "var(--border)",          color: "var(--text-muted)" },
    RESTRICTED: { border: "rgba(250,204,21,0.3)",  color: "#facc15" },
  };
  const s = styles[status] || styles.SUPERSEDED;
  return (
    <span className="text-xs px-3 py-1 rounded-md"
      style={{ border: `1px solid ${s.border}`, color: s.color }}>
      {status}
    </span>
  );
}
