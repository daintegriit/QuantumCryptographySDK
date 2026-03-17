import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import Card from "../common/Card";
import Spinner from "../common/Spinner";

import { SimulationAPI } from "../../services/simulationApi";

/**
 * ScenarioSelector
 *
 * Controls portfolio-level quantum migration simulation.
 *
 * BACKED BY:
 * - MigrationSimulator.simulate_portfolio
 *
 * SAFE:
 * - Deterministic
 * - Read-only
 * - Audit-logged
 */
export default function ScenarioSelector({ onResult }) {
  const { theme } = useTheme();

  const [scenarios, setScenarios] = useState([
    "conservative",
    "baseline",
    "aggressive",
    "breakthrough",
  ]);
  const [selected, setSelected] = useState(["baseline"]);
  const [safetyMargin, setSafetyMargin] = useState(10);
  const [seed, setSeed] = useState(1337);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // =====================================================
  // Toggle scenario
  // =====================================================
  function toggleScenario(name) {
    setSelected((prev) =>
      prev.includes(name)
        ? prev.filter((s) => s !== name)
        : [...prev, name]
    );
  }

  // =====================================================
  // Run simulation
  // =====================================================
  async function runSimulation() {
    try {
      setLoading(true);
      setError(null);

      const result = await SimulationAPI.runPortfolio({
        safety_margin_years: safetyMargin,
        scenarios: selected,
        seed,
      });

      onResult?.(result);
    } catch (err) {
      console.error("Simulation failed:", err);
      setError(err.message || "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

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
          Scenario Simulation
        </h3>
        <p className={theme.mutedText}>
          Evaluate cryptographic durability under alternative quantum
          progress assumptions.
        </p>
      </div>

      {/* ============================= */}
      {/* Scenario Toggles */}
      {/* ============================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {scenarios.map((s) => (
          <button
            key={s}
            onClick={() => toggleScenario(s)}
            className={`px-4 py-2 rounded text-sm font-medium border transition ${
              selected.includes(s)
                ? "border-cyan-400 bg-cyan-500/10 text-cyan-300"
                : "border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ============================= */}
      {/* Controls */}
      {/* ============================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Control
          label="Safety Margin (years)"
          value={safetyMargin}
          onChange={setSafetyMargin}
        />
        <Control
          label="Random Seed"
          value={seed}
          onChange={setSeed}
        />
        <div className="flex items-end">
          <button
            onClick={runSimulation}
            disabled={loading || selected.length === 0}
            className={`w-full px-4 py-2 rounded text-sm font-semibold transition ${
              loading
                ? "bg-cyan-500/30 text-cyan-200 cursor-not-allowed"
                : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
            }`}
          >
            {loading ? "Simulating…" : "Run Simulation"}
          </button>
        </div>
      </div>

      {/* ============================= */}
      {/* Error */}
      {/* ============================= */}
      {error && (
        <div className="text-sm text-red-400 border border-red-500/30 rounded p-3">
          {error}
        </div>
      )}

      {/* ============================= */}
      {/* Loading */}
      {/* ============================= */}
      {loading && (
        <div className="flex items-center gap-3">
          <Spinner />
          <p className={theme.mutedText}>
            Evaluating migration risk across key portfolio…
          </p>
        </div>
      )}
    </Card>
  );
}

// =====================================================
// Subcomponents
// =====================================================

function Control({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 rounded bg-black/40 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
      />
    </div>
  );
}