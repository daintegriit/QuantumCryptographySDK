// src/components/governance/PolicyDriftDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import Spinner from "../common/Spinner";
import EmptyState from "../common/EmptyState";
import { apiGet } from "../../services/apiClient";

/**
 * PolicyDriftDashboard
 *
 * BUG FIX: original used hardcoded http://localhost:8008 with 7 fallback
 * endpoint candidates in a loop. This is fragile, breaks in Docker, and
 * masks the real route. The correct backend route is GET /api/policy-drift
 * (confirmed from api/policy_drift.py). Fixed to use apiGet() directly.
 *
 * Backend response shape (PolicyDriftResult dataclass):
 * {
 *   generated_at_utc, baseline_window_days, comparison_window_days,
 *   policy_checks_baseline, policy_checks_recent,
 *   deny_rate_baseline, deny_rate_recent, deny_rate_delta,
 *   scheme_usage_baseline, scheme_usage_recent,
 *   drift_detected, drift_severity, explanation: string[]
 * }
 */
export default function PolicyDriftDashboard() {
  const { theme } = useTheme();

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
      const data = await apiGet(
        `/api/policy-drift?baseline_days=${baselineDays}&recent_days=${recentDays}`
      );
      setData(data);
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

  if (loading) return (
    <div className={`${theme.panel} p-6 rounded-xl`}>
      <Spinner label="Computing policy drift intelligence…" />
    </div>
  );

  if (error) return (
    <div className={`${theme.panel} p-6 rounded-xl border border-red-500/30`}>
      <p className="text-red-400 font-semibold">Policy Drift Error</p>
      <p className={theme.mutedText}>{error}</p>
    </div>
  );

  if (!data) return (
    <EmptyState
      title="No Policy Drift Data"
      description="Generate keys and run policy checks to produce audit events."
    />
  );

  const severityColor =
    data.drift_severity === "HIGH" ? "border-red-500/30 bg-red-500/10 text-red-400" :
    data.drift_severity === "MEDIUM" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
    data.drift_severity === "LOW" ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" :
    "border-green-500/30 bg-green-500/10 text-green-400";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className={`text-xl font-bold ${theme.panelTitle}`}>📉 Policy Drift Dashboard</h2>
          <p className={theme.mutedText}>
            Detects silent governance decay — rising denials, new schemes, and compliance friction over time.
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Baseline (days)</span>
            <select
              className="bg-black/20 border border-gray-800 text-sm rounded-md px-3 py-2"
              value={baselineDays}
              onChange={(e) => setBaselineDays(parseInt(e.target.value))}
            >
              {[30, 60, 90, 180, 365].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Recent (days)</span>
            <select
              className="bg-black/20 border border-gray-800 text-sm rounded-md px-3 py-2"
              value={recentDays}
              onChange={(e) => setRecentDays(parseInt(e.target.value))}
            >
              {[7, 14, 30, 60].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="bg-cyan-500/10 text-cyan-400 text-sm px-4 py-2 rounded-md hover:bg-cyan-500/20 transition disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Posture banner */}
      <div className={`p-5 rounded-xl border ${severityColor}`}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <div className="font-semibold">
              {data.drift_detected ? "Drift Detected" : "No Significant Drift"}
              {" · "}Severity: {data.drift_severity}
            </div>
            <div className={`text-sm mt-1 ${theme.mutedText}`}>
              {(data.explanation || []).join(" · ") || "No explanation available."}
            </div>
          </div>
          <span className="font-mono text-sm">
            {new Date(data.generated_at_utc).toLocaleString()}
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Baseline Checks", data.policy_checks_baseline],
          ["Recent Checks", data.policy_checks_recent],
          ["Baseline Deny Rate", `${(data.deny_rate_baseline * 100).toFixed(1)}%`],
          ["Recent Deny Rate", `${(data.deny_rate_recent * 100).toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={label} className={`${theme.panel} p-4 rounded-xl`}>
            <div className="text-xs text-gray-400">{label}</div>
            <div className="text-2xl font-bold text-cyan-400">{value}</div>
          </div>
        ))}
      </div>

      {/* Delta */}
      <div className={`${theme.panel} p-5 rounded-xl`}>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Deny Rate Delta (recent vs baseline)</span>
          <span className={`font-mono font-bold ${
            data.deny_rate_delta > 0 ? "text-red-400" :
            data.deny_rate_delta < 0 ? "text-green-400" : "text-gray-400"}`}>
            {data.deny_rate_delta > 0 ? "+" : ""}{(data.deny_rate_delta * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Scheme usage */}
      {Object.keys(data.scheme_usage_recent || {}).length > 0 && (
        <div className={`${theme.panel} p-5 rounded-xl`}>
          <div className="text-sm font-semibold text-gray-300 mb-3">Recent Scheme Usage</div>
          <div className="space-y-2">
            {Object.entries(data.scheme_usage_recent).map(([scheme, count]) => (
              <div key={scheme} className="flex justify-between text-sm">
                <span className={theme.panelText}>{scheme}</span>
                <span className="font-mono text-cyan-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        Baseline window: {data.baseline_window_days}d · Comparison window: {data.comparison_window_days}d
      </div>
    </div>
  );
}