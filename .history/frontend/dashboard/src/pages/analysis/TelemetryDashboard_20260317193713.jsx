// src/pages/TelemetryDashboard.jsx

import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

import MetricCards from "../../components/common/MetricCards";
import KeyTelemetryPanel from "../../components/telemetry/KeyTelemetryPanel";

import {
  fetchSystemTelemetry,
  fetchTelemetryMetrics,
} from "../../services/telemetryApi";
import { apiGet } from "../../services/apiClient";

export default function TelemetryDashboard() {
  const { theme } = useTheme();

  const [activeKey, setActiveKey] = useState(null);
  const [system, setSystem] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Load Active Key (SAME AS CryptoPage)
  // =====================================================
  async function loadActiveKey() {
    try {
      const res = await apiGet("/api/keys/active");
      setActiveKey(res?.active ? res.key : null);
    } catch {
      setActiveKey(null);
    }
  }

  // =====================================================
  // Load telemetry + metrics
  // =====================================================
  useEffect(() => {
    async function loadTelemetry() {
      try {
        setLoading(true);
        setError(null);

        const [systemData, metricsData] = await Promise.all([
          fetchSystemTelemetry(),
          fetchTelemetryMetrics(),
        ]);

        setSystem(systemData);
        setMetrics(metricsData);
        await loadActiveKey();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTelemetry();
  }, []);

  /* ================= STATES ================= */

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

  const policyRisk =
    metrics.policy_deny > 0 ? "ELEVATED" : "NORMAL";

  /* ================= UI ================= */

  return (
    <div className="space-y-8">
      {/* ================= HEADER ================= */}
      <div>
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
          Telemetry Dashboard
        </h2>
        <p className={theme.mutedText}>
          Real-time cryptographic activity, lifecycle events, and policy
          enforcement signals derived from immutable audit logs.
        </p>
      </div>

      {/* ================= ACTIVE KEY BANNER ================= */}
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
            ⚠ No active key selected — telemetry is system-only
          </div>
        )}
      </div>

      {/* ================= KPIs ================= */}
      <MetricCards
        metrics={[
          {
            label: "Encryptions",
            value: system.total_encryptions,
            status: "neutral",
          },
          {
            label: "Decryptions",
            value: system.total_decryptions,
            status: "neutral",
          },
          {
            label: "Rotations",
            value: system.total_rotations,
            status: "ok",
          },
          {
            label: "Migrations",
            value: system.total_migrations,
            status: "warn",
          },
        ]}
      />

      {/* ================= EVENT BREAKDOWN ================= */}
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
                  className="flex justify-between text-sm"
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

      {/* ================= POLICY SIGNALS ================= */}
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <h3 className={`font-semibold mb-4 ${theme.panelTitle}`}>
          Policy Enforcement Signals
        </h3>

        <MetricCards
          metrics={[
            { label: "Checks", value: metrics.policy_checks },
            { label: "Allowed", value: metrics.policy_allow, status: "ok" },
            { label: "Denied", value: metrics.policy_deny, status: "danger" },
          ]}
        />

        <div className="mt-4">
          <PolicyPostureBanner posture={policyRisk} />
        </div>
      </div>

      {/* ================= KEY-LEVEL TELEMETRY ================= */}
      <KeyTelemetryPanel keyId={activeKey?.key_id} />
    </div>
  );
}

/* ================= POLICY POSTURE ================= */

function PolicyPostureBanner({ posture }) {
  const styles = {
    NORMAL: "bg-green-500/10 border-green-500/30 text-green-400",
    ELEVATED: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  };

  return (
    <div
      className={`p-3 rounded-xl border text-sm font-medium ${
        styles[posture]
      }`}
    >
      {posture === "NORMAL"
        ? "Policy enforcement is operating within expected bounds."
        : "Policy denials detected. Review key usage and access controls."}
    </div>
  );
}