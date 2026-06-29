

/**
 * DecisionReasoning
 *
 * Deterministic explanation of governance decisions.
 *
 * GUARANTEES:
 * - No LLMs
 * - No inference
 * - No hallucinations
 * - Fully traceable
 * - Executive + auditor readable
 *
 * Answers exactly one question:
 * Why did the system make this decision?
 */
export default function DecisionReasoning({ decision }) {


  // =====================================================
  // Empty / Missing State
  // =====================================================
  if (!decision) {
    return (
      <div className={`bg-gray-900 p-6 rounded-xl`}>
        <p className="text-gray-400">
          No governance decision data available for this key.
        </p>
      </div>
    );
  }

  const {
    outcome = "UNKNOWN",
    classification = "UNCLASSIFIED",
    reasons = [],
    recommended_action,
    confidence,
    evaluated_at,
  } = decision;

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="space-y-6">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <div>
        <h3 className={`text-lg font-bold text-white`}>
          Decision Reasoning
        </h3>
        <p className="text-gray-400">
          Deterministic justification for governance outcomes derived from
          policy evaluation, lifecycle analysis, and cryptographic telemetry.
        </p>
      </div>

      {/* ============================= */}
      {/* Outcome */}
      {/* ============================= */}
      <DecisionOutcome
        outcome={outcome}
        classification={classification}
        evaluatedAt={evaluated_at}
      />

      {/* ============================= */}
      {/* Contributing Factors */}
      {/* ============================= */}
      <div className={`bg-gray-900 p-5 rounded-xl`}>
        <div className="text-sm font-semibold text-gray-300 mb-3">
          Contributing Factors
        </div>

        {reasons.length === 0 ? (
          <p className="text-gray-400">
            No explicit factors were required to reach this decision.
          </p>
        ) : (
          <ul className="space-y-2 list-disc list-inside text-sm">
            {reasons.map((reason, idx) => (
              <li key={idx} className="text-gray-300">
                {reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ============================= */}
      {/* Recommended Action */}
      {/* ============================= */}
      {recommended_action && (
        <div className={`bg-gray-900 p-5 rounded-xl`}>
          <div className="text-sm font-semibold text-gray-300 mb-2">
            Recommended Action
          </div>
          <p className="text-sm text-cyan-400">
            {recommended_action}
          </p>
        </div>
      )}

      {/* ============================= */}
      {/* Confidence */}
      {/* ============================= */}
      {typeof confidence === "number" && (
        <div className={`bg-gray-900 p-4 rounded-xl`}>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Decision Confidence</span>
            <span className="font-mono text-cyan-400">
              {(confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================
 * Subcomponents
 * ===================================================== */

function DecisionOutcome({ outcome, classification, evaluatedAt }) {
  const outcomeStyles = {
    ALLOW: "bg-green-500/10 text-green-400 border-green-500/30",
    DENY: "bg-red-500/10 text-red-400 border-red-500/30",
    MIGRATE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    MONITOR: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  };

  const classStyles = {
    STABLE: "text-green-400",
    ELEVATED: "text-yellow-400",
    CRITICAL: "text-red-400",
    UNCLASSIFIED: "text-gray-400",
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-800 bg-black/20">
      <div>
        <div className="text-xs text-gray-400 mb-1">
          Governance Decision
        </div>

        <div className="text-lg font-semibold">
          {outcome}
        </div>

        {evaluatedAt && (
          <div className="text-xs text-gray-500 mt-1">
            Evaluated at {evaluatedAt}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={`px-3 py-1 rounded-md text-xs border ${
            outcomeStyles[outcome] ||
            "border-gray-700 text-gray-400"
          }`}
        >
          {outcome}
        </span>

        <span
          className={`text-xs font-mono ${
            classStyles[classification] ||
            classStyles.UNCLASSIFIED
          }`}
        >
          {classification}
        </span>
      </div>
    </div>
  );
}