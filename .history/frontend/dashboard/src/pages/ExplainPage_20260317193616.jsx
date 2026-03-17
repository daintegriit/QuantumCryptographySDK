import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import ExplainPanel from "../components/explain/ExplainPanel";
import KeyExplorer from "../components/governance/KeyExplorer";

/**
 * ExplainPage
 *
 * Governance-grade explainability surface.
 *
 * PURPOSE:
 * - Allows operators, executives, and auditors to
 *   deterministically inspect *why* governance decisions
 *   were made for a specific cryptographic key.
 *
 * GUARANTEES:
 * - No ML
 * - No inference
 * - No hallucinations
 * - Fully audit-derived
 */
export default function ExplainPage() {
  const { theme } = useTheme();
  const [selectedKeyId, setSelectedKeyId] = useState(null);

  return (
    <div className="space-y-8">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <div>
        <h1 className={`text-xl font-bold ${theme.panelTitle}`}>
          Explainability
        </h1>
        <p className={theme.mutedText}>
          Deterministic explanations for cryptographic governance decisions,
          derived exclusively from policy evaluation, telemetry, and audit
          evidence.
        </p>
      </div>

      {/* ============================= */}
      {/* Key Selection */}
      {/* ============================= */}
      <Card>
        <KeyExplorer
          selectable
          selectedKeyId={selectedKeyId}
          onSelectKey={setSelectedKeyId}
        />
      </Card>

      {/* ============================= */}
      {/* Explain Panel */}
      {/* ============================= */}
      {!selectedKeyId ? (
        <EmptyState
          title="No Key Selected"
          description="Select a cryptographic key to view its governance explanation."
        />
      ) : (
        <ExplainPanel keyId={selectedKeyId} />
      )}
    </div>
  );
}