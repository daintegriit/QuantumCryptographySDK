import { useEffect, useState } from "react";
import { FaChartBar, FaShieldAlt, FaCheckCircle, FaExclamationTriangle, FaSpinner } from "react-icons/fa";
import MetricCards from "../common/MetricCards";
import { apiGet } from "../../services/apiClient";

export default function TelemetryDashboard() {
  const [system, setSystem] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadTelemetry() {
      try {
        setLoading(true); setError(null);
        const [systemRes, metricsRes] = await Promise.all([
          apiGet("/api/telemetry/system"),
          apiGet("/api/telemetry/metrics"),
        ]);
        setSystem(systemRes); setMetrics(metricsRes);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadTelemetry();
  }, []);

  if (loading) return (
    <div className="p-6 rounded-xl flex items-center gap-3" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <FaSpinner className="animate-spin" style={{ color: "var(--accent)" }} />
      <p style={{ color: "var(--text-muted)" }}>Streaming cryptographic telemetry from audit logs…</p>
    </div>
  );

  if (error) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid rgba(239,68,68,0.3)" }}>
      <p className="font-semibold text-red-400">Telemetry Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </div>
  );

  if (!system || !metrics) return null;

  const policyRisk = metrics.policy_deny > 0 ? "ELEVATED" : "NORMAL";

  const telemetryMetrics = [
    { label: "Encryptions", value: system.total_encryptions, subtitle: "Total operations",    status: "neutral" },
    { label: "Decryptions", value: system.total_decryptions, subtitle: "Total operations",    status: "neutral" },
    { label: "Rotations",   value: system.total_rotations,   subtitle: "Key lifecycle events", status: "neutral" },
    { label: "Migrations",  value: system.total_migrations,  subtitle: "Quantum-driven",       status: system.total_migrations > 0 ? "warn" : "ok" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaChartBar style={{ color: "var(--accent)" }} /> Telemetry Dashboard
        </h2>
        <p style={{ color: "var(--text-muted)" }}>
          Real-time cryptographic activity, lifecycle events, and policy enforcement signals derived from immutable audit logs.
        </p>
      </div>

      <MetricCards metrics={telemetryMetrics} />

      <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaChartBar style={{ color: "#a78bfa" }} /> Event Activity Breakdown
        </h3>
        {Object.keys(metrics.events_by_type || {}).length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No audit events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(metrics.events_by_type).map(([event, count]) => (
              <div key={event} className="flex justify-between items-center text-sm">
                <span style={{ color: "var(--text-primary)" }}>{event.replaceAll("_", " ")}</span>
                <span className="font-mono" style={{ color: "var(--accent)" }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaShieldAlt style={{ color: "var(--accent)" }} /> Policy Enforcement Signals
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ["Checks",  metrics.policy_checks, "var(--accent)"],
            ["Allowed", metrics.policy_allow,  "#4ade80"],
            ["Denied",  metrics.policy_deny,   "#f87171"],
          ].map(([label, value, color]) => (
            <div key={label} className="p-4 rounded-xl" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</div>
              <div className="text-3xl font-bold" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-xl border text-sm font-medium flex items-center gap-2"
          style={{
            background: policyRisk === "NORMAL" ? "rgba(74,222,128,0.08)" : "rgba(250,204,21,0.08)",
            borderColor: policyRisk === "NORMAL" ? "rgba(74,222,128,0.3)" : "rgba(250,204,21,0.3)",
            color: policyRisk === "NORMAL" ? "#4ade80" : "#facc15",
          }}>
          {policyRisk === "NORMAL" ? <FaCheckCircle /> : <FaExclamationTriangle />}
          {policyRisk === "NORMAL"
            ? "Policy enforcement is operating within expected bounds."
            : "Policy denials detected. Review key usage and access controls."}
        </div>
      </div>
    </div>
  );
}
