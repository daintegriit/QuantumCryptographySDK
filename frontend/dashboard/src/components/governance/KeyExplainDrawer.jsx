import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTheme } from "../../context/ThemeContext";
import ExplainPanel from "../explain/ExplainPanel";
import KeyTimeline from "../replay/KeyTimeline";
import { apiGet } from "../../services/apiClient";

export default function KeyExplainDrawer({ keyId, onClose }) {
  const { theme } = useTheme();
  const [anomalySeverity, setAnomalySeverity] = useState(null);

  useEffect(() => {
    if (!keyId) return;
    apiGet("/api/anomalies/scan?window_hours=168")
      .then(res => {
        const findings = res?.findings || [];
        const keyFindings = findings.filter(f => f.key_id === keyId);
        if (keyFindings.length > 0) {
          const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
          const worst = keyFindings.reduce((a, b) =>
            (rank[b.severity] || 0) > (rank[a.severity] || 0) ? b : a
          );
          setAnomalySeverity(worst.severity);
        }
      })
      .catch(() => null);
  }, [keyId]);

  if (!keyId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
         style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className={`${theme.panel} w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-gray-700 shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className={`text-lg font-semibold ${theme.panelTitle}`}>Key Governance Explanation</h2>
            <div className="text-xs text-gray-500 font-mono mt-0.5">{keyId}</div>
          </div>
          <button onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
            Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          {anomalySeverity && (
            <div className="text-xs px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              ⚠ Anomaly detected: {anomalySeverity}
            </div>
          )}
          <ExplainPanel keyId={keyId} />
          <KeyTimeline keyId={keyId} />
        </div>
      </div>
    </div>
  );
}

KeyExplainDrawer.propTypes = {
  keyId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
