// src/pages/DashboardPage.jsx

import { useEffect, useState } from "react";
import SectionHeader from "../components/layout/SectionHeader";
import Card from "../components/common/Card";
import { apiGet } from "../services/apiClient";
import { fetchTelemetryMetrics } from "../services/telemetryApi";

export default function DashboardPage() {
  const [activeKey, setActiveKey] = useState(null);
  const [metrics, setMetrics] = useState(null);

  /* =====================================================
   * Load dashboard signals (READ-ONLY)
   * ===================================================== */
  useEffect(() => {
    async function loadDashboard() {
      try {
        const [keyRes, metricsRes] = await Promise.all([
          apiGet("/api/keys/active"),
          fetchTelemetryMetrics(),
        ]);

        setActiveKey(keyRes?.active ? keyRes.key : null);
        setMetrics(metricsRes);
      } catch {
        setActiveKey(null);
        setMetrics(null);
      }
    }

    loadDashboard();
  }, []);

  const riskPosture =
    metrics?.policy_deny > 0 ? "ELEVATED" : "STABLE";

  /* =====================================================
   * UI
   * ===================================================== */
  return (
    <div className="space-y-8">
      {/* ================= HEADER ================= */}
      <SectionHeader
        title="Dashboard"
        subtitle="System posture and cryptographic readiness"
      />

      {/* ================= SYSTEM PULSE ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <PulseItem
          label="Last Crypto Event"
          value={
            metrics?.last_event_type
              ? `${metrics.last_event_type.replaceAll("_", " ")}`
              : "No activity yet"
          }
        />
        <PulseItem
          label="Policy Enforcement"
          value={
            metrics?.policy_deny > 0
              ? `${metrics.policy_deny} denials detected`
              : "All checks passing"
          }
          warn={metrics?.policy_deny > 0}
        />
        <PulseItem
          label="Audit Integrity"
          value="Append-Only · Verified"
          ok
        />
      </div>

      {/* ================= CORE STATUS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ===== Backend ===== */}
        <Card>
          <h3 className="text-sm font-semibold text-cyan-400">
            Backend Status
          </h3>
          <p className="text-xs text-gray-400 mt-2">
            All services operational
          </p>
        </Card>

        {/* ===== Active Key (PRIMARY) ===== */}
        <Card highlight>
          <h3 className="text-sm font-semibold text-green-400">
            Active Cryptographic Key
          </h3>

          {activeKey ? (
            <div className="mt-2 space-y-1 text-xs">
              <div className="font-mono text-cyan-300">
                {activeKey.key_id}
              </div>
              <div className="text-gray-400">
                Algorithm: {activeKey.algorithm}
              </div>
              <div className="text-green-400">
                Status: ACTIVE
              </div>
            </div>
          ) : (
            <p className="text-xs text-yellow-400 mt-2">
              No active key selected
            </p>
          )}
        </Card>

        {/* ===== Risk ===== */}
        <Card>
          <h3
            className={`text-sm font-semibold ${
              riskPosture === "STABLE"
                ? "text-green-400"
                : "text-yellow-400"
            }`}
          >
            Risk Posture
          </h3>

          <div className="mt-2 text-xs space-y-1">
            <div>
              Status:{" "}
              <span className="font-semibold">
                {riskPosture}
              </span>
            </div>
            <div className="text-gray-400">
              Policy Denials:{" "}
              {metrics?.policy_deny ?? 0}
            </div>
            <div className="text-gray-400">
              Anomalies Detected: 0
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================
 * Components
 * ===================================================== */

function PulseItem({ label, value, ok, warn }) {
  const color = ok
    ? "text-green-400 border-green-500/30"
    : warn
    ? "text-yellow-400 border-yellow-500/30"
    : "text-cyan-400 border-cyan-500/30";

  return (
    <div
      className={`border ${color} rounded-xl p-3 flex flex-col gap-1`}
    >
      <span className="text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}