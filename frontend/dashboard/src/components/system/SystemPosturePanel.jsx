import { useEffect, useMemo, useState } from "react";
import { FaShieldAlt, FaSpinner, FaExclamationTriangle, FaCheckCircle, FaBolt, FaClock, FaLock, FaChartBar } from "react-icons/fa";
import Card from "../common/Card";
import MetricCards from "../common/MetricCards";
import { GovernanceAPI, TelemetryAPI, AnomalyAPI } from "../../services/apiClient";

export default function SystemPosturePanel() {
  const [risk, setRisk] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadPosture() {
      try {
        setLoading(true);
        setError(null);
        const [riskData, anomalyData, telemetryData] = await Promise.all([
          GovernanceAPI.risk(),
          AnomalyAPI.scan(168),
          TelemetryAPI.system(),
        ]);
        if (!mounted) return;
        setRisk(riskData);
        setAnomalies(anomalyData);
        setTelemetry(telemetryData);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPosture();
    return () => { mounted = false; };
  }, []);

  const posture = useMemo(() => {
    if (!risk) return "UNKNOWN";
    if (risk.emergency_keys > 0) return "CRITICAL";
    if (risk.migrate_soon > 0 || risk.policy_denied > 0) return "ELEVATED";
    return "STABLE";
  }, [risk]);

  if (loading) return (
    <Card>
      <div className="flex items-center gap-3">
        <FaSpinner className="animate-spin" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--text-muted)" }}>Assessing system-wide cryptographic posture…</p>
      </div>
    </Card>
  );

  if (error) return (
    <Card>
      <p className="font-semibold flex items-center gap-2 text-red-400"><FaExclamationTriangle /> Posture Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </Card>
  );

  if (!risk || !telemetry) return null;

  const postureMetrics = [
    { label: "Keys Managed",       value: risk.total_keys,          status: "neutral", icon: <FaLock /> },
    { label: "Emergency Keys",     value: risk.emergency_keys,      status: risk.emergency_keys > 0 ? "danger" : "ok", icon: <FaBolt /> },
    { label: "Policy Denials",     value: risk.policy_denied,       status: risk.policy_denied > 0 ? "warn" : "ok", icon: <FaExclamationTriangle /> },
    { label: "Quantum Migrations", value: telemetry.total_migrations, status: telemetry.total_migrations > 0 ? "warn" : "ok", icon: <FaClock /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaShieldAlt style={{ color: "var(--accent)" }} /> System Posture
        </h2>
        <p style={{ color: "var(--text-muted)" }}>
          Consolidated, real-time assessment of cryptographic safety, compliance, and quantum readiness.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Overall Status</div>
            <div className="text-lg font-semibold mt-1" style={{ color: "var(--text-primary)" }}>{posture}</div>
          </div>
          <PostureBadge posture={posture} />
        </div>
      </Card>

      <MetricCards metrics={postureMetrics} />

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Signal label="Cryptographic Usage" value={`${telemetry.total_encryptions + telemetry.total_decryptions} ops`} icon={<FaLock />} />
          <Signal label="Anomalies Detected"  value={anomalies?.findings?.length || 0} icon={<FaExclamationTriangle />} />
          <Signal label="System Integrity"    value="Immutable" icon={<FaCheckCircle />} />
        </div>
      </Card>
    </div>
  );
}

function Signal({ label, value, icon }) {
  return (
    <div>
      <div className="text-xs flex items-center gap-1.5 mb-1" style={{ color: "var(--text-muted)" }}>
        {icon} {label}
      </div>
      <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{value}</div>
    </div>
  );
}

function PostureBadge({ posture }) {
  const map = {
    STABLE:   { bg: "rgba(34,197,94,0.1)",  text: "#4ade80", border: "rgba(34,197,94,0.3)",  icon: <FaCheckCircle /> },
    ELEVATED: { bg: "rgba(234,179,8,0.1)",  text: "#facc15", border: "rgba(234,179,8,0.3)",  icon: <FaExclamationTriangle /> },
    CRITICAL: { bg: "rgba(239,68,68,0.1)",  text: "#f87171", border: "rgba(239,68,68,0.3)",  icon: <FaBolt /> },
    UNKNOWN:  { bg: "rgba(107,114,128,0.1)", text: "#9ca3af", border: "rgba(107,114,128,0.3)", icon: <FaChartBar /> },
  };
  const s = map[posture] || map.UNKNOWN;
  return (
    <span className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}>
      {s.icon} {posture}
    </span>
  );
}
