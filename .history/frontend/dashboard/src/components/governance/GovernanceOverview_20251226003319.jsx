import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import MetricCards from "../common/MetricCards";

import { TelemetryAPI } from "../../services/apiClient";

/**
 * GovernanceOverview
 *
 * Executive-level overview of system-wide cryptographic governance.
 *
 * - Deterministic
 * - Read-only
 * - Audit-safe
 * - Uses centralized API client
 */
export default function GovernanceOverview() {
  const { theme } = useTheme();

  const [telemetry, setTelemetry] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Load governance telemetry
  // =====================================================
  useEffect(() => {
    let mounted = true;

    async function loadGovernance() {
      try {
        setLoading(true);
        setError(null);

        const [systemTelemetry, systemMetrics] = await Promise.all([
          TelemetryAPI.system(),
          TelemetryAPI.metrics(),
        ]);

        if (!mounted) return;

        setTelemetry(systemTelemetry);
        setMetrics(systemMetrics);
      } catch (err) {
        console.error("GovernanceOverview error:", err);
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadGovernance();
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
        <p className={theme.mutedText}>
          Loading governance telemetry…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${theme.panel} p-6 rounded-xl border border-red-500`}
      >
        <p className="text-red-400 font-semibold">
          Governance Error
        </p>
        <p className={theme.mutedText}>{error}</p>
      </div>
    );
  }

  if (!telemetry || !metrics) return null;

  // =====================================================
  // MetricCards payload (deterministic)
  // =====================================================
  const governanceMetrics = [
    {
      label: "Total Keys",
      value: telemetry.total_keys,
      subtitle: "Managed keys",
      status: "neutral",
    },
    {
      label: "Encryptions",
      value: telemetry.total_encryptions,
      subtitle: "Lifetime usage",
      status: "neutral",
    },
    {
      label: "Rotations",
      value: telemetry.total_rotations,
      subtitle: "Lifecycle actions",
      status: "ok",
    },
    {
      label: "Migrations",
      value: telemetry.total_migrations,
      subtitle: "Quantum-driven",
      status: telemetry.total_migrations > 0 ? "warn" : "ok",
    },
    {
      label: "Policy Risk",
      value:
        telemetry.total_policy_denials > 0 ? "ELEVATED" : "NORMAL",
      subtitle: `${telemetry.total_policy_denials} denials`,
      status:
        telemetry.total_policy_denials > 0 ? "danger" : "ok",
    },
  ];

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="space-y-6">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <div>
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
          🏛️ Governance Overview
        </h2>
        <p className={theme.mutedText}>
          System-wide cryptographic posture, policy compliance,
          and lifecycle activity.
        </p>
      </div>

      {/* ============================= */}
      {/* KPI Metrics */}
      {/* ============================= */}
      <MetricCards metrics={governanceMetrics} />

      {/* ============================= */}
      {/* Scheme Usage */}
      {/* ============================= */}
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <h3 className={`font-semibold mb-4 ${theme.panelTitle}`}>
          🔐 Cryptographic Scheme Usage
        </h3>

        {Object.keys(telemetry.per_scheme_usage || {}).length === 0 ? (
          <p className={theme.mutedText}>
            No scheme usage recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(telemetry.per_scheme_usage).map(
              ([scheme, count]) => (
                <div
                  key={scheme}
                  className="flex justify-between items-center text-sm"
                >
                  <span className={theme.panelText}>
                    {scheme}
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
    </div>
  );
}