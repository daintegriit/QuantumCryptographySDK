import { useEffect, useMemo, useState } from "react";
import { FaBrain, FaShieldAlt, FaExclamationTriangle, FaCheckCircle, FaSync, FaSpinner, FaRobot } from "react-icons/fa";
import { apiGet } from "../services/apiClient";

export default function AnomalyDashboard() {
  const [report,    setReport]    = useState(null);
  const [aiReport,  setAiReport]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState(null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const [ruleData, aiData] = await Promise.all([
        apiGet("/api/anomalies/scan?window_hours=24"),
        apiGet("/api/anomalies/ai-scan?window_hours=24"),
      ]);
      setReport(ruleData);
      setAiReport(aiData);
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
    if (findings.length > 0 || (aiReport?.anomalies_found > 0)) return "ELEVATED";
    return "STABLE";
  }, [report, aiReport]);

  const counts = useMemo(() => {
    const findings = report?.findings || [];
    return {
      total:        findings.length,
      critical:     findings.filter(f => f.severity === "CRITICAL").length,
      high:         findings.filter(f => f.severity === "HIGH").length,
      keysAffected: new Set(findings.filter(f => f.key_id).map(f => f.key_id)).size,
      aiAnomalies:  aiReport?.anomalies_found || 0,
    };
  }, [report, aiReport]);

  const postureStyle = {
    STABLE:   { bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.3)",  color: "#4ade80" },
    ELEVATED: { bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.3)",  color: "#facc15" },
    CRITICAL: { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   color: "#f87171" },
  }[posture];

  if (loading) return (
    <div className="p-6 rounded-xl flex items-center gap-3"
      style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <FaSpinner className="animate-spin" style={{ color: "var(--accent)" }} />
      <p style={{ color: "var(--text-muted)" }}>Running AI + rule-based anomaly scan…</p>
    </div>
  );

  if (error) return (
    <div className="p-6 rounded-xl"
      style={{ background: "var(--panel)", border: "1px solid rgba(239,68,68,0.3)" }}>
      <p className="font-semibold text-red-400">Anomaly Detection Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </div>
  );

  const findings = report?.findings || [];
  const aiAnomalies = aiReport?.anomalies || [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FaBrain style={{ color: "var(--accent)" }} /> AI Anomaly Detection
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            Dual-layer detection: rule-based governance analysis plus Isolation Forest ML model
            trained on live cryptographic audit telemetry.
          </p>
        </div>
        <button onClick={() => { setRefreshing(true); load(true); }} disabled={refreshing}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-md transition disabled:opacity-50"
          style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border)" }}>
          <FaSync className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Scanning…" : "Rescan"}
        </button>
      </div>

      {/* Posture banner */}
      <div className="p-4 rounded-xl border text-sm font-medium flex items-center gap-2"
        style={{ background: postureStyle.bg, borderColor: postureStyle.border, color: postureStyle.color }}>
        {posture === "STABLE"   && <><FaCheckCircle /> No anomalies detected. System posture is stable.</>}
        {posture === "ELEVATED" && <><FaExclamationTriangle /> Anomalous activity detected. Review recommended.</>}
        {posture === "CRITICAL" && <><FaExclamationTriangle /> Critical anomalies detected. Immediate action required.</>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          ["Rule Findings",  counts.total,       "var(--accent)"],
          ["Critical",       counts.critical,    "#f87171"],
          ["High",           counts.high,        "#facc15"],
          ["Keys Affected",  counts.keysAffected,"var(--accent)"],
          ["AI Anomalies",   counts.aiAnomalies, "#a78bfa"],
        ].map(([label, value, color]) => (
          <div key={label} className="p-4 rounded-xl"
            style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="text-3xl font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* AI Model Panel */}
      <div className="p-5 rounded-xl" style={{ background: "var(--panel)", border: "1px solid rgba(167,139,250,0.3)" }}>
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaRobot style={{ color: "#a78bfa" }} /> Isolation Forest Model
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
          {[
            ["Algorithm",     "Isolation Forest"],
            ["Features",      "event · scheme · policy · duration"],
            ["Status",        aiReport?.status === "ok" ? "Trained · Active" : aiReport?.status === "no_data" ? "Awaiting Data" : "Initializing"],
            ["Events Scanned",aiReport?.total_scanned ?? "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ color: "var(--text-muted)" }}>{label}</div>
              <div className="font-mono mt-0.5" style={{ color: "#a78bfa" }}>{value}</div>
            </div>
          ))}
        </div>
        {aiReport?.status === "no_data" && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            The AI model activates after 50 audit events accumulate. Perform cryptographic
            operations on qsentry.io to generate telemetry — the model will train automatically.
          </p>
        )}
        {aiAnomalies.length > 0 && (
          <div className="space-y-2 mt-3">
            <div className="text-xs font-semibold" style={{ color: "#a78bfa" }}>AI-Detected Anomalies</div>
            {aiAnomalies.map((a, idx) => (
              <div key={idx} className="p-3 rounded text-xs font-mono"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                <span style={{ color: "#f87171" }}>{a.reason}</span>
                <span className="ml-2" style={{ color: "var(--text-muted)" }}>
                  score: {a.score} · {a.event_type} · {a.scheme}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rule-based findings */}
      {findings.length === 0 ? (
        <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <FaCheckCircle /> <span className="font-semibold">No Rule-Based Anomalies</span>
          </div>
          <p style={{ color: "var(--text-muted)" }}>
            All cryptographic operations are within governance policy bounds.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FaShieldAlt style={{ color: "var(--accent)" }} /> Rule-Based Findings
          </h3>
          {findings.map((f, idx) => {
            const sevColor  = { CRITICAL: "#f87171", HIGH: "#fb923c", MEDIUM: "#facc15" }[f.severity] || "var(--text-muted)";
            const sevBorder = { CRITICAL: "rgba(239,68,68,0.4)", HIGH: "rgba(251,146,60,0.4)", MEDIUM: "rgba(250,204,21,0.4)" }[f.severity] || "var(--border)";
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
                      style={{ background: `${sevColor}20`, color: sevColor }}>{f.severity}</span>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
