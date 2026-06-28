// src/components/simulation/MigrationProjectionChart.jsx
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import Card from "../common/Card";
import Spinner from "../common/Spinner";
import { SimulationAPI } from "../../services/simulationApi";

export default function MigrationProjectionChart({ keyId, horizonYears=50, safetyMarginYears=10 }) {
  const { theme } = useTheme();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!keyId) return;
    let mounted = true;

    async function loadSimulation() {
      try {
        setLoading(true);
        setError(null);

        // BUG FIX: original called SimulationAPI.simulateKey(keyId, { horizon_years, safety_margin_years })
        // but simulationApi.js defines: simulateKey({ keyId, horizonYears, safetyMarginYears })
        // — the function takes a single object, not (keyId, options)
        const data = await SimulationAPI.simulateKey({
          keyId,
          horizonYears,
          safetyMarginYears,
        });

        if (mounted) setResult(data);
      } catch (err) {
        if (mounted) setError(err.message || "Simulation failed");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSimulation();
    return () => { mounted = false; };
  }, [keyId, horizonYears, safetyMarginYears]);

  const timeline = useMemo(() => result?.timeline || [], [result]);

  if (!keyId) return <Card><p className={theme.mutedText}>Select a key to view cryptographic durability projection.</p></Card>;
  if (loading) return <Card><div className="flex items-center gap-3"><Spinner /><p className={theme.mutedText}>Simulating cryptographic durability…</p></div></Card>;
  if (error) return <Card><p className="text-red-400 font-semibold">Simulation Error</p><p className={theme.mutedText}>{error}</p></Card>;
  if (!result) return null;

  return (
    <Card className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold ${theme.panelTitle}`}>Migration Projection</h3>
        <p className={theme.mutedText}>Year-by-year cryptographic risk projection based on registry quantum break estimates.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {[["Scheme", result.scheme], ["Parameters", result.parameter_set],
          ["Worst Risk", result.worst_risk_level], ["First Migration Year", result.first_migration_year ?? "—"]
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-xs text-gray-400">{label}</div>
            <div className="font-semibold text-cyan-400">{value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-black/50">
            <tr className="border-b border-gray-700">
              <th className="text-left py-2">Year</th>
              <th className="text-left py-2">Years Left</th>
              <th className="text-left py-2">Risk Level</th>
            </tr>
          </thead>
          <tbody>
            {timeline.map((p) => (
              <tr key={p.year} className="border-b border-gray-800">
                <td className="py-1 font-mono">{p.year}</td>
                <td className="py-1 font-mono">{p.years_of_margin ?? "—"}</td>
                <td className="py-1">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    p.risk_level === "SAFE" ? "bg-green-500/10 text-green-400" :
                    p.risk_level === "MONITOR" ? "bg-yellow-500/10 text-yellow-400" :
                    p.risk_level === "MIGRATE_SOON" ? "bg-orange-500/10 text-orange-400" :
                    "bg-red-500/10 text-red-400"}`}>
                    {p.risk_level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.notes && <p className={`text-xs ${theme.mutedText}`}>{result.notes}</p>}
    </Card>
  );
}