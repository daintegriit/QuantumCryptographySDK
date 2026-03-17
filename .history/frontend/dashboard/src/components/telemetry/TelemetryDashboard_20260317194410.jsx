import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import MetricCards from "../common/MetricCards";

/**
 * TelemetryDashboard
 *
 * High-level observability view derived strictly from
 * immutable audit logs.
 *
 * - Read-only
 * - Deterministic
 * - Regulator-safe
 */
export default function TelemetryDashboard() {
  const { theme } = useTheme();

  const [system, setSystem] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Fetch telemetry + metrics
  // =====================================================
  useEffect(() => {
    async function loadTelemetry() {
      try {
        setLoading(true);
        setError(null);

        const [systemRes, metricsRes] = await Promise.all([
          fetch("http://localhost:8008/api/telemetry/system"),
          fetch("http://localhost:8008/api/telemetry/metrics"),
        ]);

        if (!systemRes.ok || !metricsRes.ok) {
          throw new Error("Failed to load telemetry data");
        }

        setSystem(await systemRes.json());
        setMetrics(await metricsRes.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTelemetry();
  }, []);

  // =====================================================
  // States
  // =====================================================
  if (loading) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <p className={theme.mutedText}>
          Streaming cryptographic telemetry from audit logs…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl border border-red-500`}>
        <p className="text-red-400 font-semibold">Telemetry Error</p>
        <p className={theme.mutedText}>{error}</p>
      </div>
    );
  }

  if (!system || !metrics) return null;

  // =====================================================
  // Derived posture signals
  // =====================================================
  const policyRisk =
    metrics.policy_deny > 0 ? "ELEVATED" : "NORMAL";

  // =====================================================
  // MetricCards payload
  // =====================================================
  const telemetryMetrics = [
    {
      label: "Encryptions",
      value: system.total_encryptions,
      subtitle: "Total operations",
      status: "neutral",
    },
    {
      label: "Decryptions",
      value: system.total_decryptions,
      subtitle: "Total operations",
      status: "neutral",
    },
    {
      label: "Rotations",
      value: system.total_rotations,
      subtitle: "Key lifecycle events",
      status: "neutral",
    },
    {
      label: "Migrations",
      value: system.total_migrations,
      subtitle: "Quantum-driven",
      status: system.total_migrations > 0 ? "warn" : "ok",
    },
  ];

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
          Telemetry Dashboard
        </h2>
        <p className={theme.mutedText}>
          Real-time cryptographic activity, lifecycle events, and policy
          enforcement signals derived from immutable audit logs.
        </p>
      </div>

      {/* ============================= */}
      {/* Core KPIs */}
      {/* ============================= */}
      <MetricCards metrics={telemetryMetrics} />

      {/* ============================= */}
      {/* Event Breakdown */}
      {/* ============================= */}
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <h3 className={`font-semibold mb-4 ${theme.panelTitle}`}>
          Event Activity Breakdown
        </h3>

        {Object.keys(metrics.events_by_type || {}).length === 0 ? (
          <p className={theme.mutedText}>
            No audit events recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(metrics.events_by_type).map(
              ([event, count]) => (
                <div
                  key={event}
                  className="flex justify-between items-center text-sm"
                >
                  <span className={theme.panelText}>
                    {event.replaceAll("_", " ")}
                  </span>
                  <span className="font-mono text-cyan-400">
                    {count}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ============================= */}
      {/* Policy Signals */}
      {/* ============================= */}
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <h3 className={`font-semibold mb-4 ${theme.panelTitle}`}>
          Policy Enforcement Signals
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PolicyCard
            label="Checks"
            value={metrics.policy_checks}
            type="neutral"
          />
          <PolicyCard
            label="Allowed"
            value={metrics.policy_allow}
            type="ok"
          />
          <PolicyCard
            label="Denied"
            value={metrics.policy_deny}
            type="danger"
          />
        </div>

        <div className="mt-4">
          <PolicyPostureBanner posture={policyRisk} />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Components
// =====================================================

function PolicyCard({ label, value, type }) {
  const colors = {
    neutral: "text-cyan-400",
    ok: "text-green-400",
    danger: "text-red-400",
  };

  return (
    <div className="p-4 rounded-xl bg-black/20 border border-gray-800">
      <div className="text-sm text-gray-400">{label}</div>
      <div className={`text-3xl font-bold ${colors[type]}`}>
        {value}
      </div>
    </div>
  );
}

function PolicyPostureBanner({ posture }) {
  const styles = {
    NORMAL: "bg-green-500/10 border-green-500/30 text-green-400",
    ELEVATED: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  };

  const messages = {
    NORMAL:
      "Policy enforcement is operating within expected bounds.",
    ELEVATED:
      "Policy denials detected. Review key usage and access controls.",
  };

  return (
    <div
      className={`p-3 rounded-xl border text-sm font-medium ${
        styles[posture]
      }`}
    >
      {messages[posture]}
    </div>
  );
}