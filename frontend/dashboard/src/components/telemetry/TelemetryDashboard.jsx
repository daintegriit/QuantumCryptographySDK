// src/components/telemetry/TelemetryDashboard.jsx
import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import MetricCards from "../common/MetricCards";
import { apiGet } from "../../services/apiClient";

export default function TelemetryDashboard() {
  const { theme } = useTheme();
  const [system, setSystem] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadTelemetry() {
      try {
        setLoading(true);
        setError(null);

        // BUG FIX: hardcoded http://localhost:8008 → use apiGet
        // Works in Docker (nginx proxy) and local dev
        const [systemRes, metricsRes] = await Promise.all([
          apiGet("/api/telemetry/system"),
          apiGet("/api/telemetry/metrics"),
        ]);

        setSystem(systemRes);
        setMetrics(metricsRes);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTelemetry();
  }, []);

  if (loading) return (
    <div className={`${theme.panel} p-6 rounded-xl`}>
      <p className={theme.mutedText}>Streaming cryptographic telemetry from audit logs…</p>
    </div>
  );

  if (error) return (
    <div className={`${theme.panel} p-6 rounded-xl border border-red-500/30`}>
      <p className="text-red-400 font-semibold">Telemetry Error</p>
      <p className={theme.mutedText}>{error}</p>
    </div>
  );

  if (!system || !metrics) return null;

  const policyRisk = metrics.policy_deny > 0 ? "ELEVATED" : "NORMAL";

  const telemetryMetrics = [
    { label: "Encryptions",  value: system.total_encryptions,  subtitle: "Total operations",    status: "neutral" },
    { label: "Decryptions",  value: system.total_decryptions,  subtitle: "Total operations",    status: "neutral" },
    { label: "Rotations",    value: system.total_rotations,    subtitle: "Key lifecycle events", status: "neutral" },
    { label: "Migrations",   value: system.total_migrations,   subtitle: "Quantum-driven",       status: system.total_migrations > 0 ? "warn" : "ok" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>Telemetry Dashboard</h2>
        <p className={theme.mutedText}>
          Real-time cryptographic activity, lifecycle events, and policy enforcement signals derived from immutable audit logs.
        </p>
      </div>

      <MetricCards metrics={telemetryMetrics} />

      <div className={`${theme.panel} p-6 rounded-xl`}>
        <h3 className={`font-semibold mb-4 ${theme.panelTitle}`}>Event Activity Breakdown</h3>
        {Object.keys(metrics.events_by_type || {}).length === 0 ? (
          <p className={theme.mutedText}>No audit events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(metrics.events_by_type).map(([event, count]) => (
              <div key={event} className="flex justify-between items-center text-sm">
                <span className={theme.panelText}>{event.replaceAll("_", " ")}</span>
                <span className="font-mono text-cyan-400">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${theme.panel} p-6 rounded-xl`}>
        <h3 className={`font-semibold mb-4 ${theme.panelTitle}`}>Policy Enforcement Signals</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[["Checks", metrics.policy_checks, "neutral"], ["Allowed", metrics.policy_allow, "ok"], ["Denied", metrics.policy_deny, "danger"]].map(([label, value, type]) => (
            <div key={label} className="p-4 rounded-xl bg-black/20 border border-gray-800">
              <div className="text-sm text-gray-400">{label}</div>
              <div className={`text-3xl font-bold ${type === "ok" ? "text-green-400" : type === "danger" ? "text-red-400" : "text-cyan-400"}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className={`mt-4 p-3 rounded-xl border text-sm font-medium ${policyRisk === "NORMAL" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"}`}>
          {policyRisk === "NORMAL" ? "Policy enforcement is operating within expected bounds." : "Policy denials detected. Review key usage and access controls."}
        </div>
      </div>
    </div>
  );
}