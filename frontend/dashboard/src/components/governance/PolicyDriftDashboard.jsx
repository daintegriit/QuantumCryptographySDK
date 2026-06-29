import { useEffect, useState } from "react";
import { FaChartLine, FaSync, FaExclamationTriangle, FaCheckCircle, FaArrowUp, FaArrowDown, FaMinus, FaShieldAlt } from "react-icons/fa";
import Spinner from "../common/Spinner";
import EmptyState from "../common/EmptyState";
import { apiGet } from "../../services/apiClient";

export default function PolicyDriftDashboard() {
  const [data, setData] = useState(null);
  const [baselineDays, setBaselineDays] = useState(90);
  const [recentDays, setRecentDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function loadDrift({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await apiGet(`/api/policy-drift?baseline_days=${baselineDays}&recent_days=${recentDays}`);
      setData(res);
    } catch (err) {
      setData(null);
      setError(err?.message || "Failed to load policy drift.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { loadDrift(); }, [baselineDays, recentDays]);

  async function onRefresh() {
    setRefreshing(true);
    await loadDrift({ silent: true });
    setRefreshing(false);
  }

  const selectStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "0.875rem",
  };

  if (loading) return (
    <div className="p-6 rounded-xl flex items-center gap-3" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <Spinner label="Computing policy drift intelligence…" />
    </div>
  );

  if (error) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid rgba(239,68,68,0.3)" }}>
      <p className="font-semibold flex items-center gap-2 text-red-400"><FaExclamationTriangle /> Policy Drift Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </div>
  );

  if (!data) return <EmptyState title="No Policy Drift Data" description="Generate keys and run policy checks to produce audit events." />;

  const severityStyles = {
    HIGH:   { border: "rgba(239,68,68,0.3)",   bg: "rgba(239,68,68,0.08)",   color: "#f87171" },
    MEDIUM: { border: "rgba(250,204,21,0.3)",  bg: "rgba(250,204,21,0.08)",  color: "#facc15" },
    LOW:    { border: "rgba(6,182,212,0.3)",   bg: "rgba(6,182,212,0.08)",   color: "var(--accent)" },
    NONE:   { border: "rgba(74,222,128,0.3)",  bg: "rgba(74,222,128,0.08)",  color: "#4ade80" },
  };
  const sev = severityStyles[data.drift_severity] || severityStyles.NONE;
  const DeltaIcon = data.deny_rate_delta > 0 ? FaArrowUp : data.deny_rate_delta < 0 ? FaArrowDown : FaMinus;
  const deltaColor = data.deny_rate_delta > 0 ? "#f87171" : data.deny_rate_delta < 0 ? "#4ade80" : "var(--text-muted)";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FaChartLine style={{ color: "var(--accent)" }} /> Policy Drift Dashboard
          </h2>
          <p style={{ color: "var(--text-muted)" }}>Detects silent governance decay — rising denials, new schemes, and compliance friction over time.</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Baseline (days)</span>
            <select style={selectStyle} value={baselineDays} onChange={e => setBaselineDays(parseInt(e.target.value))}>
              {[30,60,90,180,365].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Recent (days)</span>
            <select style={selectStyle} value={recentDays} onChange={e => setRecentDays(parseInt(e.target.value))}>
              {[7,14,30,60].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={onRefresh} disabled={refreshing}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-md transition disabled:opacity-50"
            style={{ background: "var(--accent-subtle, rgba(6,182,212,0.1))", color: "var(--accent)", border: "1px solid var(--border)" }}>
            <FaSync className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="p-5 rounded-xl border" style={{ borderColor: sev.border, background: sev.bg, color: sev.color }}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <div className="font-semibold flex items-center gap-2">
              {data.drift_detected ? <FaExclamationTriangle /> : <FaCheckCircle />}
              {data.drift_detected ? "Drift Detected" : "No Significant Drift"} · Severity: {data.drift_severity}
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {(data.explanation || []).join(" · ") || "No explanation available."}
            </div>
          </div>
          <span className="font-mono text-sm">{new Date(data.generated_at_utc).toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Baseline Checks",     data.policy_checks_baseline],
          ["Recent Checks",       data.policy_checks_recent],
          ["Baseline Deny Rate",  `${(data.deny_rate_baseline * 100).toFixed(1)}%`],
          ["Recent Deny Rate",    `${(data.deny_rate_recent * 100).toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={label} className="p-4 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <div className="flex justify-between text-sm items-center">
          <span className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <FaShieldAlt /> Deny Rate Delta (recent vs baseline)
          </span>
          <span className="font-mono font-bold flex items-center gap-1" style={{ color: deltaColor }}>
            <DeltaIcon className="text-xs" />
            {data.deny_rate_delta > 0 ? "+" : ""}{(data.deny_rate_delta * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {Object.keys(data.scheme_usage_recent || {}).length > 0 && (
        <div className="p-5 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FaChartLine style={{ color: "#a78bfa" }} /> Recent Scheme Usage
          </div>
          <div className="space-y-2">
            {Object.entries(data.scheme_usage_recent).map(([scheme, count]) => (
              <div key={scheme} className="flex justify-between text-sm">
                <span style={{ color: "var(--text-primary)" }}>{scheme}</span>
                <span className="font-mono" style={{ color: "var(--accent)" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        Baseline window: {data.baseline_window_days}d · Comparison window: {data.comparison_window_days}d
      </div>
    </div>
  );
}
