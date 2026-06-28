// src/pages/AnomalyDashboard.jsx  (also used as AnomalyPage)
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { apiGet } from "../services/apiClient";

export default function AnomalyDashboard() {
  const { theme } = useTheme();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadAnomalies() {
      try {
        setLoading(true);
        setError(null);
        // BUG FIX 1: hardcoded http://localhost:8008 → apiGet
        // BUG FIX 2: backend returns AnomalyReport { findings, total_findings, ... }
        //            not { anomalies, summary }
        const data = await apiGet("/api/anomalies/scan?window_hours=24");
        setReport(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAnomalies();
  }, []);

  // Derive posture from findings (no summary object in backend response)
  const posture = useMemo(() => {
    const findings = report?.findings || [];
    if (findings.some(f => f.severity === "CRITICAL")) return "CRITICAL";
    if (findings.length > 0) return "ELEVATED";
    return "STABLE";
  }, [report]);

  // Severity counts derived client-side
  const counts = useMemo(() => {
    const findings = report?.findings || [];
    return {
      total: findings.length,
      critical: findings.filter(f => f.severity === "CRITICAL").length,
      high: findings.filter(f => f.severity === "HIGH").length,
      medium: findings.filter(f => f.severity === "MEDIUM").length,
      keysAffected: new Set(findings.filter(f => f.key_id).map(f => f.key_id)).size,
    };
  }, [report]);

  if (loading) return (
    <div className={`${theme.panel} p-6 rounded-xl`}>
      <p className={theme.mutedText}>Scanning for anomalous cryptographic behavior…</p>
    </div>
  );

  if (error) return (
    <div className={`${theme.panel} p-6 rounded-xl border border-red-500/30`}>
      <p className="text-red-400 font-semibold">Anomaly Detection Error</p>
      <p className={theme.mutedText}>{error}</p>
    </div>
  );

  const findings = report?.findings || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>Anomaly Detection</h2>
        <p className={theme.mutedText}>
          Deterministic detection of abnormal cryptographic usage, policy violations, and lifecycle deviations.
        </p>
      </div>

      {/* Posture banner */}
      <div className={`p-4 rounded-xl border text-sm font-medium ${
        posture === "STABLE" ? "bg-green-500/10 border-green-500/30 text-green-400" :
        posture === "ELEVATED" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
        "bg-red-500/10 border-red-500/30 text-red-400"}`}>
        {posture === "STABLE" && "No anomalous cryptographic behavior detected. System posture is stable."}
        {posture === "ELEVATED" && "Anomalous activity detected. Review recommended for affected keys."}
        {posture === "CRITICAL" && "Critical anomalies detected. Immediate investigation required."}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Total Findings", counts.total, "neutral"],
          ["Critical", counts.critical, "danger"],
          ["High", counts.high, "warn"],
          ["Keys Affected", counts.keysAffected, "neutral"],
        ].map(([label, value, type]) => (
          <div key={label} className={`${theme.panel} p-4 rounded-xl`}>
            <div className="text-xs text-gray-400">{label}</div>
            <div className={`text-3xl font-bold ${
              type === "danger" ? "text-red-400" :
              type === "warn" ? "text-yellow-400" : "text-cyan-400"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Findings list */}
      {findings.length === 0 ? (
        <div className={`${theme.panel} p-6 rounded-xl`}>
          <p className={theme.mutedText}>No anomalies detected. System behavior is within expected bounds.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {findings.map((f, idx) => (
            <div key={idx} className={`${theme.panel} p-5 rounded-xl border ${
              f.severity === "CRITICAL" ? "border-red-500/40" :
              f.severity === "HIGH" ? "border-orange-500/40" :
              f.severity === "MEDIUM" ? "border-yellow-500/40" : "border-gray-700"}`}>
              <div className="flex justify-between items-center mb-2">
                {/* BUG FIX: anomaly_type not type, reason not description */}
                <div className="font-semibold">
                  {(f.anomaly_type || "UNKNOWN").replaceAll("_", " ")}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                    f.severity === "CRITICAL" ? "bg-red-500/20 text-red-400" :
                    f.severity === "HIGH" ? "bg-orange-500/20 text-orange-400" :
                    f.severity === "MEDIUM" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-500/20 text-gray-400"}`}>
                    {f.severity}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {f.detected_at_utc ? new Date(f.detected_at_utc).toLocaleString() : ""}
                  </span>
                </div>
              </div>

              <div className={`text-sm mb-2 ${theme.panelText}`}>
                {f.reason}
              </div>

              {f.key_id && (
                <div className="text-xs text-gray-400">
                  Key: <span className="font-mono text-cyan-400">{f.key_id}</span>
                </div>
              )}

              {f.evidence && Object.keys(f.evidence).length > 0 && (
                <div className="mt-2 text-xs text-gray-500 font-mono">
                  {JSON.stringify(f.evidence)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}