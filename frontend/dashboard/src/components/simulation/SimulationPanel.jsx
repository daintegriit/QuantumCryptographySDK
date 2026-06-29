import { useState } from "react";
import { FaChartBar } from "react-icons/fa";
import Card from "../common/Card";
import EmptyState from "../common/EmptyState";
import MigrationProjectionChart from "./MigrationProjectionChart";

export default function SimulationPanel({ result }) {
  const [selectedKey, setSelectedKey] = useState(null);

  if (!result) return (
    <Card>
      <EmptyState
        title="No Simulation Executed"
        description="Run a scenario-based simulation to evaluate cryptographic durability over time."
        hint="Simulations are read-only and safe for production environments."
      />
    </Card>
  );

  const counts = result.rollup?.severity_counts_worst_case || {};

  const riskColor = (level) => ({
    SAFE: "#4ade80", MONITOR: "#facc15", MIGRATE_SOON: "#fb923c", BROKEN: "#f87171",
  })[level] || "var(--accent)";

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaChartBar style={{ color: "var(--accent)" }} /> Portfolio Risk Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {Object.entries(counts).map(([level, count]) => (
            <div key={level} className="p-3 rounded" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{level}</div>
              <div className="text-2xl font-bold" style={{ color: riskColor(level) }}>{count}</div>
            </div>
          ))}
        </div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          Keys simulated: <span className="font-mono" style={{ color: "var(--accent)" }}>{result.keys_simulated}</span>
          {" · "}
          Safety margin: <span className="font-mono" style={{ color: "var(--accent)" }}>{result.safety_margin_years} years</span>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Inspect Individual Key</h3>
        <select
          value={selectedKey || ""}
          onChange={e => setSelectedKey(e.target.value)}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: "6px", fontSize: "0.875rem",
            background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none",
          }}>
          <option value="">Select a key…</option>
          {result.results.map(r => (
            <option key={r.key_id} value={r.key_id}>{r.key_id} ({r.scheme})</option>
          ))}
        </select>
      </Card>

      <MigrationProjectionChart keyId={selectedKey} safetyMarginYears={result.safety_margin_years} />
    </div>
  );
}
