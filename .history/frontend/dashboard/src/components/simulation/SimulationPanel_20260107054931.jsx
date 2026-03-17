import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";

import Card from "../common/Card";
import EmptyState from "../common/EmptyState";

import MigrationProjectionChart from "./MigrationProjectionChart";

/**
 * SimulationPanel
 *
 * Analysis + interpretation surface for completed simulations.
 *
 * RESPONSIBILITIES:
 * - Summarize portfolio-level simulation results
 * - Allow inspection of individual keys
 * - Render per-key migration projections
 *
 * DOES NOT:
 * - Run simulations
 * - Select scenarios
 * - Mutate state or keys
 *
 * GUARANTEES:
 * - Read-only
 * - Deterministic
 * - Audit-safe
 */
export default function SimulationPanel({ result }) {
  const { theme } = useTheme();
  const [selectedKey, setSelectedKey] = useState(null);

  // =====================================================
  // Empty state
  // =====================================================
  if (!result) {
    return (
      <Card>
        <EmptyState
          title="No Simulation Executed"
          description="Run a scenario-based simulation to evaluate cryptographic durability over time."
          hint="Simulations are read-only and safe for production environments."
        />
      </Card>
    );
  }

  const rollup = result.rollup || {};
  const counts = rollup.severity_counts_worst_case || {};

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="space-y-6">
      {/* ============================= */}
      {/* Portfolio Summary */}
      {/* ============================= */}
      <Card className="space-y-4">
        <h3 className={`font-semibold ${theme.panelTitle}`}>
          📊 Portfolio Risk Summary
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {Object.entries(counts).map(([level, count]) => (
            <div
              key={level}
              className="p-3 rounded bg-black/30 border border-gray-800"
            >
              <div className="text-gray-400">{level}</div>
              <div className="text-2xl font-bold text-cyan-400">
                {count}
              </div>
            </div>
          ))}
        </div>

        <div className={`text-xs ${theme.mutedText}`}>
          Keys simulated:{" "}
          <span className="font-mono text-cyan-400">
            {result.keys_simulated}
          </span>
          <br />
          Safety margin:{" "}
          <span className="font-mono text-cyan-400">
            {result.safety_margin_years} years
          </span>
        </div>
      </Card>

      {/* ============================= */}
      {/* Key Selector */}
      {/* ============================= */}
      <Card>
        <h3 className={`font-semibold mb-3 ${theme.panelTitle}`}>
          🔑 Inspect Individual Key
        </h3>

        <select
          className="w-full px-3 py-2 rounded bg-black/40 border border-gray-700 text-sm"
          value={selectedKey || ""}
          onChange={(e) => setSelectedKey(e.target.value)}
        >
          <option value="">Select a key…</option>
          {result.results.map((r) => (
            <option key={r.key_id} value={r.key_id}>
              {r.key_id} ({r.scheme})
            </option>
          ))}
        </select>
      </Card>

      {/* ============================= */}
      {/* Per-Key Projection */}
      {/* ============================= */}
      <MigrationProjectionChart
        keyId={selectedKey}
        safetyMarginYears={result.safety_margin_years}
      />
    </div>
  );
}