import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTheme } from "../../context/ThemeContext";

import ExplainPanel from "../explain/ExplainPanel";
import DecisionReasoning from "../explain/DecisionReasoning";
import KeyTimeline from "../replay/KeyTimeline";
import KeyTelemetryPanel from "../telemetry/KeyTelemetryPanel";
import AnomalyBadge from "../anomaly/AnomalyBadge";

import Card from "../common/Card";
import Spinner from "../common/Spinner";
import Badge from "../common/Badge";

import { fetchKeyExplain } from "../../services/explainApi";
import { fetchKeyReplay } from "../../services/replayApi";
import { fetchKeyTelemetry } from "../../services/telemetryApi";
import { fetchKeyAnomaly } from "../../services/anomalyApi";

export default function KeyExplainDrawer({ keyId, onClose }) {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [explain, setExplain] = useState(null);
  const [replay, setReplay] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [anomaly, setAnomaly] = useState(null);

  // =====================================================
  // Load deterministic governance data
  // =====================================================
  useEffect(() => {
    if (!keyId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchKeyExplain(keyId),
      fetchKeyReplay(keyId),
      fetchKeyTelemetry(keyId),
      fetchKeyAnomaly(keyId),
    ])
      .then(([explainRes, replayRes, telemetryRes, anomalyRes]) => {
        if (!mounted) return;
        setExplain(explainRes);
        setReplay(replayRes);
        setTelemetry(telemetryRes);
        setAnomaly(anomalyRes);
      })
      .catch((err) => {
        console.error("KeyExplainDrawer error:", err);
        if (mounted) setError("Failed to load key governance explanation");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [keyId]);

  if (!keyId) return null;

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <div
        className={`w-full max-w-4xl h-full ${theme.panel} shadow-2xl overflow-y-auto`}
      >
        {/* ============================= */}
        {/* Header */}
        {/* ============================= */}
        <div
          className={`sticky top-0 z-10 px-6 py-4 border-b border-gray-800 flex items-center justify-between ${theme.panel}`}
        >
          <div>
            <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
              🔍 Key Governance Explanation
            </h2>
            <p className={`text-xs font-mono ${theme.mutedText}`}>
              {keyId}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
          >
            Close
          </button>
        </div>

        {/* ============================= */}
        {/* Content */}
        {/* ============================= */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex justify-center py-24">
              <Spinner label="Assembling governance explanation…" />
            </div>
          )}

          {error && (
            <Card>
              <p className="text-red-400 font-semibold">
                Explanation Error
              </p>
              <p className={theme.mutedText}>{error}</p>
            </Card>
          )}

          {!loading && !error && (
            <>
              {/* ============================= */}
              {/* Risk / Anomaly Summary */}
              {/* ============================= */}
              <Card>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${theme.panelTitle}`}>
                    ⚠️ Risk Status
                  </h3>

                  {anomaly?.severity ? (
                    <AnomalyBadge severity={anomaly.severity} />
                  ) : (
                    <Badge label="No anomalies detected" />
                  )}
                </div>
              </Card>

              {/* ============================= */}
              {/* Deterministic Explanation */}
              {/* ============================= */}
              <Card>
                <ExplainPanel explanation={explain} />
              </Card>

              {/* ============================= */}
              {/* Decision Reasoning */}
              {/* ============================= */}
              {explain?.decision && (
                <Card>
                  <DecisionReasoning decision={explain.decision} />
                </Card>
              )}

              {/* ============================= */}
              {/* Telemetry */}
              {/* ============================= */}
              <Card>
                <KeyTelemetryPanel telemetry={telemetry} />
              </Card>

              {/* ============================= */}
              {/* Timeline Replay */}
              {/* ============================= */}
              <Card>
                <KeyTimeline timeline={replay?.timeline} />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

KeyExplainDrawer.propTypes = {
  keyId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};