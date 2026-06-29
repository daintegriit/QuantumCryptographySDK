// src/components/explain/ExplainPanel.jsx
import { useEffect, useState } from "react";

import { apiGet } from "../../services/apiClient";

export default function ExplainPanel({ keyId }) {

  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!keyId) return;

    async function loadExplanation() {
      try {
        setLoading(true);
        setError(null);
        // BUG FIX: original hardcoded http://localhost:8008/api/explain/keys/:id
        // 1. Should use apiGet (respects VITE_API_BASE env var, works in Docker)
        // 2. Route is /api/keys/:id/explain not /api/explain/keys/:id
        const data = await apiGet(`/api/keys/${keyId}/explain`);
        setExplanation(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadExplanation();
  }, [keyId]);

  if (!keyId) {
    return (
      <div className={`bg-gray-900 p-6 rounded-xl`}>
        <p className={theme.mutedText}>Select a key to view governance explanations.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-gray-900 p-6 rounded-xl`}>
        <p className={theme.mutedText}>Constructing deterministic explanation…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-900 p-6 rounded-xl border border-red-500/30`}>
        <p className="text-red-400 font-semibold">Explanation Error</p>
        <p className={`text-gray-400 mt-1`}>{error}</p>
      </div>
    );
  }

  if (!explanation) return null;

  // Backend returns KeyExplanation dataclass:
  // { key_id, overall_risk_level, headline, lifecycle_severity,
  //   quantum_margin_years, migration_required, policy_allowed,
  //   required_actions, recommended_actions, warnings, explanation: [...] }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-bold text-white`}>Governance Explanation</h2>
        <p className={theme.mutedText}>
          Deterministic explanation derived from policy evaluation, lifecycle analysis, and telemetry.
        </p>
      </div>

      {/* Headline */}
      <div className={`bg-gray-900 p-5 rounded-xl border border-purple-500/30`}>
        <div className="text-xs uppercase tracking-wide text-purple-400 mb-2">Headline</div>
        <p className="text-sm text-gray-200">{explanation.headline}</p>
        <div className="mt-2 flex gap-3 text-xs">
          <span className="text-gray-400">Risk:</span>
          <span className={explanation.overall_risk_level === "CRITICAL" ? "text-red-400" :
            explanation.overall_risk_level === "HIGH" ? "text-orange-400" :
            explanation.overall_risk_level === "MEDIUM" ? "text-yellow-400" : "text-green-400"}>
            {explanation.overall_risk_level}
          </span>
          <span className="text-gray-400 ml-2">Policy:</span>
          <span className={explanation.policy_allowed ? "text-green-400" : "text-red-400"}>
            {explanation.policy_allowed ? "ALLOWED" : "DENIED"}
          </span>
        </div>
      </div>

      {/* Explanation lines */}
      <div className={`bg-gray-900 p-5 rounded-xl space-y-3`}>
        <div className="text-sm font-semibold text-gray-300">Analysis</div>
        {(explanation.explanation || []).map((line, idx) => (
          <div key={idx} className="flex gap-3 text-sm">
            <span className={`shrink-0 font-mono text-xs px-1.5 py-0.5 rounded ${
              line.level === "CRITICAL" ? "bg-red-500/20 text-red-400" :
              line.level === "WARN" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-gray-500/20 text-gray-400"}`}>
              {line.level}
            </span>
            <span className="text-gray-300">{line.message}</span>
          </div>
        ))}
      </div>

      {/* Required actions */}
      {explanation.required_actions?.length > 0 && (
        <div className={`bg-gray-900 p-5 rounded-xl`}>
          <div className="text-sm font-semibold text-red-400 mb-2">Required Actions</div>
          <ul className="space-y-1">
            {explanation.required_actions.map((a, i) => (
              <li key={i} className="text-xs text-red-300 font-mono">• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended actions */}
      {explanation.recommended_actions?.length > 0 && (
        <div className={`bg-gray-900 p-5 rounded-xl`}>
          <div className="text-sm font-semibold text-yellow-400 mb-2">Recommended Actions</div>
          <ul className="space-y-1">
            {explanation.recommended_actions.map((a, i) => (
              <li key={i} className="text-xs text-yellow-300 font-mono">• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Quantum margin */}
      <div className={`bg-gray-900 p-4 rounded-xl`}>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Quantum Safety Margin</span>
          <span className="font-mono text-cyan-400">
            {explanation.quantum_margin_years != null
              ? `${explanation.quantum_margin_years} years`
              : "Unknown"}
          </span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-gray-400">Migration Required</span>
          <span className={explanation.migration_required ? "text-red-400" : "text-green-400"}>
            {explanation.migration_required ? "YES" : "No"}
          </span>
        </div>
      </div>
    </div>
  );
}