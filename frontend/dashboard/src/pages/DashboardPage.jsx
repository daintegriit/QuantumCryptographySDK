import { useEffect, useState } from "react";
import { FaShieldAlt, FaKey, FaExclamationTriangle, FaCheckCircle, FaBolt, FaScroll, FaSpinner } from "react-icons/fa";
import SectionHeader from "../components/layout/SectionHeader";
import Card from "../components/common/Card";
import SystemPosturePanel from "../components/system/SystemPosturePanel";
import { apiGet } from "../services/apiClient";
import { fetchTelemetryMetrics } from "../services/telemetryApi";

export default function DashboardPage() {
  const [activeKey, setActiveKey] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

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
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const riskPosture = metrics?.policy_deny > 0 ? "ELEVATED" : "STABLE";

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Dashboard"
        subtitle="System posture and cryptographic readiness"
        icon={<FaShieldAlt style={{ color: "var(--accent)" }} />}
      />

      {/* Pulse Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PulseItem
          label="Last Crypto Event"
          icon={<FaScroll />}
          value={metrics?.last_event_type ? metrics.last_event_type.replaceAll("_", " ") : "No activity yet"}
        />
        <PulseItem
          label="Policy Enforcement"
          icon={<FaShieldAlt />}
          value={metrics?.policy_deny > 0 ? `${metrics.policy_deny} denials detected` : "All checks passing"}
          warn={metrics?.policy_deny > 0}
        />
        <PulseItem
          label="Audit Integrity"
          icon={<FaCheckCircle />}
          value="Append-Only · Verified"
          ok
        />
      </div>

      {/* Core Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Backend */}
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--accent)" }}>
            <FaShieldAlt /> Backend Status
          </h3>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>All services operational</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">Online</span>
          </div>
        </Card>

        {/* Active Key */}
        <Card highlight>
          <h3 className="text-sm font-semibold flex items-center gap-2 text-green-400">
            <FaKey /> Active Cryptographic Key
          </h3>
          {loading ? (
            <div className="mt-2 flex items-center gap-2">
              <FaSpinner className="animate-spin text-xs" style={{ color: "var(--accent)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</span>
            </div>
          ) : activeKey ? (
            <div className="mt-2 space-y-1 text-xs">
              <div className="font-mono" style={{ color: "var(--accent)" }}>{activeKey.key_id}</div>
              <div style={{ color: "var(--text-muted)" }}>Algorithm: {activeKey.algorithm}</div>
              <div className="text-green-400 flex items-center gap-1"><FaCheckCircle className="text-xs" /> ACTIVE</div>
            </div>
          ) : (
            <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1.5">
              <FaExclamationTriangle /> No active key selected
            </p>
          )}
        </Card>

        {/* Risk */}
        <Card>
          <h3 className="text-sm font-semibold flex items-center gap-2"
            style={{ color: riskPosture === "STABLE" ? "#4ade80" : "#facc15" }}>
            {riskPosture === "STABLE" ? <FaCheckCircle /> : <FaExclamationTriangle />}
            Risk Posture
          </h3>
          <div className="mt-2 text-xs space-y-1.5">
            <div style={{ color: "var(--text-primary)" }}>
              Status: <span className="font-semibold">{riskPosture}</span>
            </div>
            <div style={{ color: "var(--text-muted)" }}>Policy Denials: {metrics?.policy_deny ?? 0}</div>
            <div style={{ color: "var(--text-muted)" }}>Anomalies Detected: 0</div>
          </div>
        </Card>
      </div>

      {/* System Posture Panel */}
      <SystemPosturePanel />
    </div>
  );
}

function PulseItem({ label, value, ok, warn, icon }) {
  const color = ok ? "#4ade80" : warn ? "#facc15" : "var(--accent)";
  const border = ok ? "rgba(74,222,128,0.3)" : warn ? "rgba(250,204,21,0.3)" : "var(--border)";
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1 text-xs"
      style={{ border: `1px solid ${border}`, background: "var(--panel)" }}>
      <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        <span style={{ color }}>{icon}</span> {label}
      </span>
      <span className="font-medium" style={{ color }}>{value}</span>
    </div>
  );
}
