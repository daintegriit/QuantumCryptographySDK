// src/components/simulation/MigrationProjectionChart.jsx
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import Card from "../common/Card";
import Spinner from "../common/Spinner";

import { SimulationAPI } from "../../services/simulationApi";

/**
 * MigrationProjectionChart
 *
 * Visualizes long-horizon cryptographic durability for a single key.
 *
 * BACKED BY:
 * - /keys/{key_id}/simulation
 * - Deterministic policy + registry model
 *
 * SAFE:
 * - Read-only
 * - Audit logged by backend
 * - No mutation
 */
export default function MigrationProjectionChart({
  keyId,
  horizonYears = 50,
  safetyMarginYears = 10,
}) {
  const { theme } = useTheme();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Load simulation
  // =====================================================
  useEffect(() => {
    if (!keyId) return;

    let mounted = true;

    async function loadSimulation() {
      try {
        setLoading(true);
        setError(null);

        const data = await SimulationAPI.simulateKey(keyId, {
          horizon_years: horizonYears,
          safety_margin_years: safetyMarginYears,
        });

        if (!mounted) return;
        setResult(data);
      } catch (err) {
        console.error("Simulation error:", err);
        if (mounted) setError(err.message || "Simulation failed");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSimulation();
    return () => {
      mounted = false;
    };
  }, [keyId, horizonYears, safetyMarginYears]);

  // =====================================================
  // Derived timeline (pure)
  // =====================================================
  const timeline = useMemo(() => {
    return result?.timeline || [];
  }, [result]);

  // =====================================================
  // States
  // =====================================================
  if (!keyId) {
    return (
      <Card>
        <p className={theme.mutedText}>
          Select a key to view cryptographic durability projection.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Spinner />
          <p className={theme.mutedText}>
            Simulating cryptographic durability…
          </p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-red-400 font-semibold">
          Simulation Error
        </p>
        <p className={theme.mutedText}>{error}</p>
      </Card>
    );
  }

  if (!result) return null;

  // =====================================================
  // UI
  // =====================================================
  return (
    <Card className="space-y-6">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <div>
        <h3 className={`text-lg font-semibold ${theme.panelTitle}`}>
          📈 Migration Projection
        </h3>
        <p className={theme.mutedText}>
          Year-by-year cryptographic risk projection based on
          registry quantum break estimates and policy safety margins.
        </p>
      </div>

      {/* ============================= */}
      {/* Summary */}
      {/* ============================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Metric label="Scheme" value={result.scheme} />
        <Metric label="Parameters" value={result.parameter_set} />
        <Metric
          label="Worst Risk"
          value={result.worst_risk_level}
          highlight
        />
        <Metric
          label="First Migration Year"
          value={result.first_migration_year ?? "—"}
        />
      </div>

      {/* ============================= */}
      {/* Timeline Table */}
      {/* ============================= */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2">Year</th>
              <th className="text-left py-2">Years Left</th>
              <th className="text-left py-2">Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((p) => (
              <tr
                key={p.year}
                className="border-b border-gray-800"
              >
                <td className="py-1 font-mono">
                  {p.year}
                </td>
                <td className="py-1 font-mono">
                  {p.years_of_margin ?? "—"}
                </td>
                <td className="py-1">
                  <RiskBadge level={p.risk_level} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================= */}
      {/* Notes */}
      {/* ============================= */}
      <p className={`text-xs ${theme.mutedText}`}>
        {result.notes}
      </p>
    </Card>
  );
}

// =====================================================
// Subcomponents
// =====================================================

function Metric({ label, value, highlight = false }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div
        className={`font-semibold ${
          highlight ? "text-cyan-400" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function RiskBadge({ level }) {
  const styles = {
    SAFE: "bg-green-500/10 text-green-400",
    MONITOR: "bg-yellow-500/10 text-yellow-400",
    MIGRATE_SOON: "bg-orange-500/10 text-orange-400",
    BROKEN: "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-semibold ${
        styles[level] || "bg-gray-500/10 text-gray-400"
      }`}
    >
      {level}
    </span>
  );
}