import { useEffect, useMemo, useState } from "react";
import { FaBrain, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaSync, FaSpinner } from "react-icons/fa";
import { apiGet } from "../services/apiClient";

export default function AnomalyDashboard() {
  const [report, setReport]     = useState(null);
  const [aiScan, setAiScan]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const [ruleData, aiData] = await Promise.all([
        apiGet("/api/anomalies/scan?window_hours=24"),
        apiGet("/api/anomalies/scan?window_hours=24"),
      ]);
      setReport(ruleData);
      setAiScan(aiData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const posture = useMemo(() => {
    const findings = report?.findings || [];
    if (findings.some(f => f.severity === "CRITICAL")) return "CRITICAL";
    if (findings.length > 0) return "ELEVATED";
    return "STABLE";
  }, [report]);

  const counts = useMemo(() => {
    const findings = report?.findings || [];
    return {
      total:        findings.length,
      critical:     findings.filter(f => f.severity === "CRITICAL").length,
      high:         findings.filter(f => f.severity === "HIGH").length,
      keysAffected: new Set(findings.filter(f => f.key_id).map(f => f.key_id)).size,
    };
  }, [report]);

  const postureStyle = {
    STABLE:   { bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.3)",  color: "#4ade80" },
    ELEVATED: { bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.3)",  color: "#facc15" },
    CRITICAL: { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   color: "#f87171" },
  }[posture];

  if (loading) return (
    <div className="p-6 rounded-xl flex items-center gap-3" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <FaSpinner className="animate-spin" style={{ color: "var(--accent)" }} />
      <p style={{ color: "var(--text-muted)" }}>Scanning for anomalous cryptographic behavior…</p>
    </div>
  );

  if (error) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid rgba(239,68,68,0.3)" }}>
      <p className="font-semibold text-red-400">Anomaly Detection Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </div>
  );

  const findings = report?.findings || [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FaBrain style={{ color: "var(--accent)" }} /> AI Anomaly Detection
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            ML-powered detection of abnormal cryptographic usage, policy violations, and lifecycle deviations.
            Model retrains automatically as new telemetry accumulates.
          </p>
        </div>
        <button onClick={() => { setRefreshing(true); load(true); }}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md transition disabled:opacity-50"
          style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border)" }}>
          <FaSync className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Scanning…" : "Rescan"}
        </button>
      </div>

      {/* AI Model Status */}
      <div className="p-4 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          <FaBrain style={{ color: "#a78bfa" }} /> Isolation Forest Model
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            ["Algorithm",    "Isolation Forest"],
            ["Features",     "event_type · scheme · policy_result · duration"],
            ["Status",       aiScan ? "Active" : "Initializing"],
            ["Last Scan",    aiScan?.generated_at_utc ? new Date(aiScan.generated_at_utc).toLocaleString() : "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ color: "var(--text-muted)" }}>{label}</div>
              <div className="font-mono mt-0.5" style={{ color: "var(--accent)" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Posture banner */}
      <div className="p-4 rounded-xl border text-sm font-medium flex items-center gap-2"
        style={{ background: postureStyle.bg, borderColor: postureStyle.border, color: postureStyle.color }}>
        {posture === "STABLE"   && <><FaCheckCircle /> No anomalous cryptographic behavior detected. System posture is stable.</>}
        {posture === "ELEVATED" && <><FaExclamationTriangle /> Anomalous activity detected. Review recommended for affected keys.</>}
        {posture === "CRITICAL" && <><FaExclamationTriangle /> Critical anomalies detected. Immediate investigation required.</>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Total Findings",  counts.total,        "var(--accent)"],
          ["Critical",        counts.critical,      "#f87171"],
          ["High",            counts.high,          "#facc15"],
          ["Keys Affected",   counts.keysAffected,  "var(--accent)"],
        ].map(([label, value, color]) => (
          <div key={label} className="p-4 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="text-3xl font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Findings */}
      {findings.length === 0 ? (
        <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <FaCheckCircle /> <span className="font-semibold">No Anomalies Detected</span>
          </div>
          <p style={{ color: "var(--text-muted)" }}>
            System behavior is within expected bounds. The AI model is monitoring live telemetry
            and will flag deviations as audit events accumulate.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {findings.map((f, idx) => {
            const sevColor = {
              CRITICAL: "#f87171", HIGH: "#fb923c", MEDIUM: "#facc15",
            }[f.severity] || "var(--text-muted)";
            const sevBorder = {
              CRITICAL: "rgba(239,68,68,0.4)", HIGH: "rgba(251,146,60,0.4)",
              MEDIUM: "rgba(250,204,21,0.4)",
            }[f.severity] || "var(--border)";
            return (
              <div key={idx} className="p-5 rounded-xl"
                style={{ background: "var(--panel)", border: `1px solid ${sevBorder}` }}>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <div className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    <FaShieldAlt style={{ color: sevColor }} />
                    {(f.anomaly_type || "UNKNOWN").replaceAll("_", " ")}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded font-mono"
                      style={{ background: `${sevColor}20`, color: sevColor }}>
                      {f.severity}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {f.detected_at_utc ? new Date(f.detected_at_utc).toLocaleString() : ""}
                    </span>
                  </div>
                </div>
                <div className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>{f.reason}</div>
                {f.key_id && (
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Key: <span className="font-mono" style={{ color: "var(--accent)" }}>{f.key_id}</span>
                  </div>
                )}
                {f.evidence && Object.keys(f.evidence).length > 0 && (
                  <div className="mt-2 text-xs font-mono p-2 rounded"
                    style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}>
                    {JSON.stringify(f.evidence)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
