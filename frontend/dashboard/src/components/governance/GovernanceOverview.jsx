import { useEffect, useState } from "react";
import { FaShieldAlt, FaChartBar, FaSpinner, FaExclamationTriangle, FaKey, FaLock, FaSync, FaRocket, FaCheckCircle } from "react-icons/fa";
import MetricCards from "../common/MetricCards";
import { TelemetryAPI } from "../../services/apiClient";

export default function GovernanceOverview() {
  const [telemetry, setTelemetry] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadGovernance() {
      try {
        setLoading(true); setError(null);
        const [systemTelemetry, systemMetrics] = await Promise.all([
          TelemetryAPI.system(), TelemetryAPI.metrics(),
        ]);
        if (!mounted) return;
        setTelemetry(systemTelemetry);
        setMetrics(systemMetrics);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadGovernance();
    return () => { mounted = false; };
  }, []);

  if (loading) return (
    <div className="p-6 rounded-xl flex items-center gap-3" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <FaSpinner className="animate-spin" style={{ color: "var(--accent)" }} />
      <p style={{ color: "var(--text-muted)" }}>Loading governance telemetry…</p>
    </div>
  );

  if (error) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid rgba(239,68,68,0.5)" }}>
      <p className="font-semibold flex items-center gap-2 text-red-400"><FaExclamationTriangle /> Governance Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </div>
  );

  if (!telemetry || !metrics) return null;

  const governanceMetrics = [
    { label: "Total Keys",  value: telemetry.total_keys,          subtitle: "Managed keys",      status: "neutral", icon: <FaKey /> },
    { label: "Encryptions", value: telemetry.total_encryptions,   subtitle: "Lifetime usage",    status: "neutral", icon: <FaLock /> },
    { label: "Rotations",   value: telemetry.total_rotations,     subtitle: "Lifecycle actions", status: "ok",      icon: <FaSync /> },
    { label: "Migrations",  value: telemetry.total_migrations,    subtitle: "Quantum-driven",    status: telemetry.total_migrations > 0 ? "warn" : "ok", icon: <FaRocket /> },
    { label: "Policy Risk", value: telemetry.total_policy_denials > 0 ? "ELEVATED" : "NORMAL", subtitle: `${telemetry.total_policy_denials} denials`, status: telemetry.total_policy_denials > 0 ? "danger" : "ok", icon: <FaShieldAlt /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaShieldAlt style={{ color: "var(--accent)" }} /> Governance Overview
        </h2>
        <p style={{ color: "var(--text-muted)" }}>System-wide cryptographic posture, policy compliance, and lifecycle activity.</p>
      </div>

      <MetricCards metrics={governanceMetrics} />

      <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaChartBar style={{ color: "#a78bfa" }} /> Cryptographic Scheme Usage
        </h3>
        {Object.keys(telemetry.per_scheme_usage || {}).length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No scheme usage recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(telemetry.per_scheme_usage).map(([scheme, count]) => (
              <div key={scheme} className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <FaCheckCircle className="text-xs text-green-400" /> {scheme}
                </span>
                <span className="font-mono" style={{ color: "var(--accent)" }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
