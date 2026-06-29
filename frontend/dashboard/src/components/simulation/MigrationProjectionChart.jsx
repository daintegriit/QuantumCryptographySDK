import { useEffect, useMemo, useState } from "react";
import { FaChartLine, FaSpinner, FaExclamationTriangle } from "react-icons/fa";
import Card from "../common/Card";
import Spinner from "../common/Spinner";
import { SimulationAPI } from "../../services/simulationApi";

export default function MigrationProjectionChart({ keyId, horizonYears=50, safetyMarginYears=10 }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!keyId) return;
    let mounted = true;
    async function loadSimulation() {
      try {
        setLoading(true); setError(null);
        const data = await SimulationAPI.simulateKey({ keyId, horizonYears, safetyMarginYears });
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

  if (!keyId) return (
    <Card>
      <p style={{ color: "var(--text-muted)" }}>Select a key to view cryptographic durability projection.</p>
    </Card>
  );

  if (loading) return (
    <Card>
      <div className="flex items-center gap-3">
        <FaSpinner className="animate-spin" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--text-muted)" }}>Simulating cryptographic durability…</p>
      </div>
    </Card>
  );

  if (error) return (
    <Card>
      <p className="font-semibold text-red-400 flex items-center gap-2"><FaExclamationTriangle /> Simulation Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </Card>
  );

  if (!result) return null;

  const riskStyle = (level) => ({
    SAFE:         { bg: "rgba(74,222,128,0.1)",  color: "#4ade80" },
    MONITOR:      { bg: "rgba(250,204,21,0.1)",  color: "#facc15" },
    MIGRATE_SOON: { bg: "rgba(251,146,60,0.1)",  color: "#fb923c" },
    BROKEN:       { bg: "rgba(239,68,68,0.1)",   color: "#f87171" },
  })[level] || { bg: "rgba(107,114,128,0.1)", color: "var(--text-muted)" };

  return (
    <Card className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaChartLine style={{ color: "var(--accent)" }} /> Migration Projection
        </h3>
        <p style={{ color: "var(--text-muted)" }}>Year-by-year cryptographic risk projection based on registry quantum break estimates.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {[["Scheme", result.scheme], ["Parameters", result.parameter_set],
          ["Worst Risk", result.worst_risk_level], ["First Migration Year", result.first_migration_year ?? "—"]
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
            <div className="font-semibold" style={{ color: "var(--accent)" }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0" style={{ background: "var(--panel)" }}>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Year","Years Left","Risk Level"].map(h => (
                <th key={h} className="text-left py-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.map((p) => {
              const rs = riskStyle(p.risk_level);
              return (
                <tr key={p.year} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-1 font-mono" style={{ color: "var(--text-primary)" }}>{p.year}</td>
                  <td className="py-1 font-mono" style={{ color: "var(--text-muted)" }}>{p.years_of_margin ?? "—"}</td>
                  <td className="py-1">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ background: rs.bg, color: rs.color }}>{p.risk_level}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result.notes && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{result.notes}</p>}
    </Card>
  );
}
