import { useState } from "react";
import { FaFlask, FaSpinner, FaExclamationTriangle, FaPlay } from "react-icons/fa";
import Card from "../common/Card";
import Spinner from "../common/Spinner";
import { SimulationAPI } from "../../services/simulationApi";

const SCENARIOS = ["conservative", "baseline", "aggressive", "breakthrough"];

export default function ScenarioSelector({ onResult }) {
  const [selected, setSelected] = useState(["baseline"]);
  const [safetyMargin, setSafetyMargin] = useState(10);
  const [seed, setSeed] = useState(1337);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function toggleScenario(name) {
    setSelected(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
  }

  async function runSimulation() {
    try {
      setLoading(true); setError(null);
      const result = await SimulationAPI.runPortfolio({ safety_margin_years: safetyMargin, scenarios: selected, seed });
      onResult?.(result);
    } catch (err) {
      setError(err.message || "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--input-bg)", border: "1px solid var(--border)",
    color: "var(--text-primary)", borderRadius: "6px", padding: "8px 12px",
    fontSize: "0.875rem", width: "100%", outline: "none",
  };

  return (
    <Card className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaFlask style={{ color: "var(--accent)" }} /> Scenario Simulation
        </h3>
        <p style={{ color: "var(--text-muted)" }}>
          Evaluate cryptographic durability under alternative quantum progress assumptions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SCENARIOS.map(s => (
          <button key={s} onClick={() => toggleScenario(s)}
            className="px-4 py-2 rounded text-sm font-medium transition capitalize"
            style={{
              border: selected.includes(s) ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: selected.includes(s) ? "var(--accent-subtle, rgba(6,182,212,0.1))" : "transparent",
              color: selected.includes(s) ? "var(--accent)" : "var(--text-muted)",
            }}>
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Safety Margin (years)</label>
          <input type="number" value={safetyMargin} onChange={e => setSafetyMargin(Number(e.target.value))} style={inputStyle} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Random Seed</label>
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))} style={inputStyle} />
        </div>
        <div className="flex items-end">
          <button onClick={runSimulation} disabled={loading || selected.length === 0}
            className="w-full px-4 py-2 rounded text-sm font-semibold transition flex items-center justify-center gap-2"
            style={{
              background: loading ? "var(--accent-subtle)" : "var(--accent-subtle, rgba(6,182,212,0.2))",
              color: "var(--accent)", border: "1px solid var(--border)",
              opacity: loading || selected.length === 0 ? 0.6 : 1,
              cursor: loading || selected.length === 0 ? "not-allowed" : "pointer",
            }}>
            {loading ? <><FaSpinner className="animate-spin text-xs" /> Simulating…</> : <><FaPlay className="text-xs" /> Run Simulation</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm rounded p-3 flex items-center gap-2 text-red-400"
          style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
          <FaExclamationTriangle /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3">
          <Spinner />
          <p style={{ color: "var(--text-muted)" }}>Evaluating migration risk across key portfolio…</p>
        </div>
      )}
    </Card>
  );
}
