import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import Card from "../common/Card";
import MetricCards from "../common/MetricCards";

import {
  GovernanceAPI,
  TelemetryAPI,
  AnomalyAPI,
} from "../../services/apiClient";

/**
 * SystemPosturePanel
 *
 * Executive-grade system-wide posture aggregation.
 *
 * - Deterministic
 * - Read-only
 * - Audit-safe
 * - No ML / no hallucinations
 *
 * FIRST panel leadership looks at.
 */
export default function SystemPosturePanel() {
  const { theme } = useTheme();

  const [risk, setRisk] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Load posture inputs (centralized API)
  // =====================================================
  useEffect(() => {
    let mounted = true;

    async function loadPosture() {
      try {
        setLoading(true);
        setError(null);

        const [riskData, anomalyData, telemetryData] =
          await Promise.all([
            GovernanceAPI.risk(),
            AnomalyAPI.summary(),
            TelemetryAPI.system(),
          ]);

        if (!mounted) return;

        setRisk(riskData);
        setAnomalies(anomalyData);
        setTelemetry(telemetryData);
      } catch (err) {
        console.error("SystemPosturePanel error:", err);
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPosture();
    return () => {
      mounted = false;
    };
  }, []);

  // =====================================================
  // Posture classification (deterministic)
  // =====================================================
  const posture = useMemo(() => {
    if (!risk) return "UNKNOWN";

    if (risk.emergency_keys > 0) return "CRITICAL";
    if (risk.migrate_soon > 0 || risk.policy_denied > 0)
      return "ELEVATED";

    return "STABLE";
  }, [risk]);

  // =====================================================
  // States
  // =====================================================
  if (loading) {
    return (
      <Card>
        <p className={theme.mutedText}>
          Assessing system-wide cryptographic posture…
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-red-400 font-semibold">
          Posture Error
        </p>
        <p className={theme.mutedText}>{error}</p>
      </Card>
    );
  }

  if (!risk || !telemetry) return null;

  // =====================================================
  // MetricCards payload
  // =====================================================
  const postureMetrics = [
    {
      label: "Keys Managed",
      value: risk.total_keys,
      status: "neutral",
    },
    {
      label: "Emergency Keys",
      value: risk.emergency_keys,
      status: risk.emergency_keys > 0 ? "danger" : "ok",
    },
    {
      label: "Policy Denials",
      value: risk.policy_denied,
      status: risk.policy_denied > 0 ? "warn" : "ok",
    },
    {
      label: "Quantum Migrations",
      value: telemetry.total_migrations,
      status:
        telemetry.total_migrations > 0 ? "warn" : "ok",
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
          🧭 System Posture
        </h2>
        <p className={theme.mutedText}>
          Consolidated, real-time assessment of cryptographic
          safety, compliance, and quantum readiness.
        </p>
      </div>

      {/* ============================= */}
      {/* Overall Posture */}
      {/* ============================= */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">
              Overall Status
            </div>
            <div className="text-lg font-semibold mt-1">
              {posture}
            </div>
          </div>

          <PostureBadge posture={posture} />
        </div>
      </Card>

      {/* ============================= */}
      {/* KPI Grid */}
      {/* ============================= */}
      <MetricCards metrics={postureMetrics} />

      {/* ============================= */}
      {/* Signals */}
      {/* ============================= */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Signal
            label="Cryptographic Usage"
            value={`${telemetry.total_encryptions + telemetry.total_decryptions} ops`}
          />
          <Signal
            label="Anomalies Detected"
            value={anomalies?.total || 0}
          />
          <Signal
            label="System Integrity"
            value="Immutable"
          />
        </div>
      </Card>
    </div>
  );
}

// =====================================================
// Components
// =====================================================

function Signal({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-cyan-400">
        {value}
      </div>
    </div>
  );
}

function PostureBadge({ posture }) {
  const map = {
    STABLE:
      "bg-green-500/10 text-green-400 border-green-500/30",
    ELEVATED:
      "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    CRITICAL:
      "bg-red-500/10 text-red-400 border-red-500/30",
    UNKNOWN:
      "bg-gray-500/10 text-gray-400 border-gray-500/30",
  };

  return (
    <span
      className={`px-3 py-1 rounded-md text-xs border ${
        map[posture] || map.UNKNOWN
      }`}
    >
      {posture}
    </span>
  );
}