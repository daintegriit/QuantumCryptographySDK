import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * AnomalyDashboard
 *
 * Deterministic anomaly detection surface.
 *
 * ❌ No ML hallucinations
 * ❌ No probabilistic inference
 * ✅ Fully derived from audit + telemetry rules
 * ✅ Governance-grade and regulator-ready
 */
export default function AnomalyDashboard() {
  const { theme } = useTheme();

  const [anomalies, setAnomalies] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Load anomalies
  // =====================================================
  useEffect(() => {
    async function loadAnomalies() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          "http://localhost:8008/api/anomalies/scan?window_hours=24"
        );

        if (!res.ok) {
          throw new Error("Failed to load anomalies");
        }

        const data = await res.json();

        setAnomalies(data.anomalies || []);
        setSummary(data.summary || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAnomalies();
  }, []);

  // =====================================================
  // Derived posture
  // =====================================================
  const posture = useMemo(() => {
    if (!summary) return "STABLE";
    if (summary.critical > 0) return "CRITICAL";
    if (summary.total > 0) return "ELEVATED";
    return "STABLE";
  }, [summary]);

  // =====================================================
  // States
  // =====================================================
  if (loading) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <p className={theme.mutedText}>
          Scanning for anomalous cryptographic behavior…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl border border-red-500`}>
        <p className="text-red-400 font-semibold">Anomaly Detection Error</p>
        <p className={theme.mutedText}>{error}</p>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="space-y-8">
      {/* ================= HEADER ================= */}
      <div>
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
          🚨 Anomaly Detection
        </h2>
        <p className={theme.mutedText}>
          Deterministic detection of abnormal cryptographic usage,
          policy violations, and lifecycle deviations.
        </p>
      </div>

      {/* ================= POSTURE ================= */}
      <PostureBanner posture={posture} />

      {/* ================= SUMMARY ================= */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            label="Total Anomalies"
            value={summary.total}
            theme={theme}
          />
          <SummaryCard
            label="Critical"
            value={summary.critical}
            type="danger"
            theme={theme}
          />
          <SummaryCard
            label="Keys Affected"
            value={summary.keys_affected}
            theme={theme}
          />
        </div>
      )}

      {/* ================= LIST ================= */}
      {anomalies.length === 0 ? (
        <div className={`${theme.panel} p-6 rounded-xl`}>
          <p className={theme.mutedText}>
            No anomalies detected. System behavior is within expected bounds.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {anomalies.map((a, idx) => (
            <AnomalyCard key={idx} anomaly={a} theme={theme} />
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Components
// =====================================================

function PostureBanner({ posture }) {
  const styles = {
    STABLE: "border-green-500/30 text-green-400 bg-green-500/10",
    ELEVATED: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
    CRITICAL: "border-red-500/30 text-red-400 bg-red-500/10",
  };

  const messages = {
    STABLE:
      "No anomalous cryptographic behavior detected. System posture is stable.",
    ELEVATED:
      "Anomalous activity detected. Review recommended for affected keys.",
    CRITICAL:
      "Critical anomalies detected. Immediate investigation required.",
  };

  return (
    <div
      className={`p-4 rounded-xl border text-sm font-medium ${
        styles[posture]
      }`}
    >
      {messages[posture]}
    </div>
  );
}

function SummaryCard({ label, value, type = "neutral", theme }) {
  const colors = {
    neutral: "text-cyan-400",
    danger: "text-red-400",
  };

  return (
    <div className={`${theme.panel} p-4 rounded-xl`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-3xl font-bold ${colors[type]}`}>
        {value}
      </div>
    </div>
  );
}

function AnomalyCard({ anomaly, theme }) {
  const severityStyles = {
    LOW: "border-gray-600 text-gray-300",
    MEDIUM: "border-yellow-500/40 text-yellow-400",
    HIGH: "border-red-500/40 text-red-400",
  };

  return (
    <div
      className={`${theme.panel} p-5 rounded-xl border ${
        severityStyles[anomaly.severity] || severityStyles.LOW
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold">
          {anomaly.type.replaceAll("_", " ")}
        </div>
        <span className="text-xs font-mono">
          {new Date(anomaly.detected_at_utc).toLocaleString()}
        </span>
      </div>

      <div className={`text-sm mb-2 ${theme.panelText}`}>
        {anomaly.description}
      </div>

      <div className="text-xs text-gray-400 flex gap-4">
        {anomaly.key_id && (
          <span>
            <span className="text-gray-500">Key:</span>{" "}
            <span className="font-mono text-cyan-400">
              {anomaly.key_id}
            </span>
          </span>
        )}

        <span>
          <span className="text-gray-500">Severity:</span>{" "}
          <span className="font-mono">{anomaly.severity}</span>
        </span>
      </div>
    </div>
  );
}