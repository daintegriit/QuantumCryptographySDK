import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

/**
 * ExplainPanel
 *
 * Deterministic, audit-safe governance explanation engine.
 *
 * ❌ No generative reasoning
 * ❌ No probabilistic inference
 * ✅ Fully derived from immutable audit signals
 */
export default function ExplainPanel({ keyId }) {
  const { theme } = useTheme();

  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Fetch explanation from backend
  // =====================================================
  useEffect(() => {
    if (!keyId) return;

    async function loadExplanation() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `http://localhost:8008/api/explain/keys/${keyId}`
        );

        if (!res.ok) {
          throw new Error("Failed to load explanation");
        }

        setExplanation(await res.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadExplanation();
  }, [keyId]);

  // =====================================================
  // States
  // =====================================================
  if (!keyId) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <p className={theme.mutedText}>
          Select a key to view governance explanations.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <p className={theme.mutedText}>
          Constructing deterministic explanation…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl border border-red-500`}>
        <p className="text-red-400 font-semibold">
          Explanation Error
        </p>
        <p className={theme.mutedText}>{error}</p>
      </div>
    );
  }

  if (!explanation) return null;

  const {
    summary,
    decision,
    factors = [],
    evidence = [],
    classification,
  } = explanation;

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div>
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
          🧠 Governance Explanation
        </h2>
        <p className={theme.mutedText}>
          Deterministic explanation derived from cryptographic
          telemetry, policy evaluation, and lifecycle analysis.
        </p>
      </div>

      {/* ================= DECISION ================= */}
      {decision && (
        <DecisionBlock decision={decision} theme={theme} />
      )}

      {/* ================= SUMMARY ================= */}
      <div className={`${theme.panel} p-5 rounded-xl`}>
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
          Executive Summary
        </div>
        <div className={`text-sm leading-relaxed ${theme.panelText}`}>
          {summary}
        </div>
      </div>

      {/* ================= FACTORS ================= */}
      <div className={`${theme.panel} p-5 rounded-xl space-y-3`}>
        <div className="text-sm font-semibold text-gray-300">
          Contributing Factors
        </div>

        {factors.length === 0 && (
          <p className={theme.mutedText}>
            No contributing factors reported.
          </p>
        )}

        {factors.map((factor, idx) => (
          <FactorRow key={idx} factor={factor} />
        ))}
      </div>

      {/* ================= EVIDENCE ================= */}
      <div className={`${theme.panel} p-5 rounded-xl space-y-3`}>
        <div className="text-sm font-semibold text-gray-300">
          Audit Evidence
        </div>

        {evidence.length === 0 && (
          <p className={theme.mutedText}>
            No supporting audit evidence available.
          </p>
        )}

        {evidence.map((ev, idx) => (
          <EvidenceRow key={idx} event={ev} />
        ))}
      </div>

      {/* ================= CLASSIFICATION ================= */}
      <ExplainClassification classification={classification} />
    </div>
  );
}

// =====================================================
// Components
// =====================================================

function DecisionBlock({ decision, theme }) {
  return (
    <div
      className={`${theme.panel} p-5 rounded-xl border border-purple-500/30`}
    >
      <div className="text-xs uppercase tracking-wide text-purple-400 mb-2">
        Governance Decision
      </div>

      <div className="text-sm">
        <span className="text-gray-400">Outcome:</span>{" "}
        <span className="font-semibold text-purple-300">
          {decision.outcome}
        </span>
      </div>

      {decision.reason && (
        <div className={`text-sm mt-2 ${theme.panelText}`}>
          {decision.reason}
        </div>
      )}
    </div>
  );
}

function FactorRow({ factor }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-300">
        {factor.label}
      </span>
      <span className="font-mono text-cyan-400">
        {factor.value}
      </span>
    </div>
  );
}

function EvidenceRow({ event }) {
  return (
    <div className="text-xs text-gray-400 flex justify-between">
      <span>
        {event.event_type.replaceAll("_", " ")}
      </span>
      <span className="font-mono">
        {new Date(event.timestamp_utc).toLocaleString()}
      </span>
    </div>
  );
}

function ExplainClassification({ classification }) {
  const styles = {
    NORMAL: "border-green-500/30 text-green-400",
    ELEVATED: "border-yellow-500/30 text-yellow-400",
    CRITICAL: "border-red-500/30 text-red-400",
  };

  return (
    <div
      className={`p-4 rounded-xl border text-sm font-medium ${
        styles[classification] || styles.NORMAL
      }`}
    >
      Classification: {classification}
    </div>
  );
}