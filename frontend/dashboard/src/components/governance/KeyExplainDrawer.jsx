import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTheme } from "../../context/ThemeContext";

import ExplainPanel from "../explain/ExplainPanel";
import KeyTimeline from "../replay/KeyTimeline";
import AnomalyBadge from "../anomaly/AnomalyBadge";
import Card from "../common/Card";
import Spinner from "../common/Spinner";

import { apiGet } from "../../services/apiClient";

export default function KeyExplainDrawer({ keyId, onClose }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [anomalySeverity, setAnomalySeverity] = useState(null);

  useEffect(() => {
    if (!keyId) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      apiGet(`/api/telemetry/keys/${keyId}`).catch(() => null),
      // BUG FIX: fetchKeyAnomaly (GET /api/anomalies/keys/:id) doesn't exist.
      // Anomalies are system-wide. Fetch the scan and filter by key_id client-side.
      apiGet("/api/anomalies/scan?window_hours=168").catch(() => null),
    ])
      .then(([telemetryRes, anomalyRes]) => {
        if (!mounted) return;
        setTelemetry(telemetryRes);
        // Find worst severity finding for this key
        const findings = anomalyRes?.findings || [];
        const keyFindings = findings.filter(f => f.key_id === keyId);
        if (keyFindings.length > 0) {
          const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
          const worst = keyFindings.reduce((a, b) =>
            (rank[b.severity] || 0) > (rank[a.severity] || 0) ? b : a
          );
          setAnomalySeverity(worst.severity);
        }
      })
      .catch((err) => {
        if (mounted) setError("Failed to load key governance data");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [keyId]);

  if (!keyId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <div className={`w-full max-w-4xl h-full ${theme.panel} shadow-2xl overflow-y-auto`}>
        <div className={`sticky top-0 z-10 px-6 py-4 border-b border-gray-800 flex items-center justify-between ${theme.panel}`}>
          <div>
            <h2 className={`text-xl font-bold ${theme.panelTitle}`}>Key Governance Explanation</h2>
            <p className={`text-xs font-mono ${theme.mutedText}`}>{keyId}</p>
          </div>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
            Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex justify-center py-24">
              <Spinner label="Assembling governance explanation…" />
            </div>
          )}

          {error && (
            <Card>
              <p className="text-red-400 font-semibold">Explanation Error</p>
              <p className={theme.mutedText}>{error}</p>
            </Card>
          )}

          {!loading && !error && (
            <>
              {anomalySeverity && (
                <Card>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-semibold ${theme.panelTitle}`}>Risk Status</h3>
                    <AnomalyBadge severity={anomalySeverity} />
                  </div>
                </Card>
              )}

              {/* BUG FIX: ExplainPanel takes keyId prop, fetches internally */}
              <Card>
                <ExplainPanel keyId={keyId} />
              </Card>

              {telemetry && (
                <Card>
                  <div className="text-sm font-semibold text-gray-300 mb-3">Key Telemetry</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      ["Encryptions", telemetry.encrypt_count],
                      ["Decryptions", telemetry.decrypt_count],
                      ["Rotations", telemetry.rotation_count],
                      ["Policy Denials", telemetry.policy_denials],
                      ["Age (days)", telemetry.age_days],
                      ["Last Used", telemetry.last_used_utc ? new Date(telemetry.last_used_utc).toLocaleDateString() : "Never"],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-gray-400">{label}</span>
                        <span className="text-cyan-400 font-mono">{val ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card>
                <KeyTimeline keyId={keyId} />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

KeyExplainDrawer.propTypes = { keyId: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired };