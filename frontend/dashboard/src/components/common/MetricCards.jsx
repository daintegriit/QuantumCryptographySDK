import { useTheme } from "../../context/ThemeContext";

/**
 * MetricCards
 *
 * Reusable KPI / metric card grid for dashboards.
 *
 * Design goals:
 * - Deterministic
 * - Theme-aware
 * - Executive-readable
 * - No business logic
 *
 * Used by:
 * - TelemetryDashboard
 * - SystemPosturePanel
 * - GovernanceOverview (next)
 */
export default function MetricCards({ metrics }) {
  const { theme } = useTheme();

  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {metrics.map((m, idx) => (
        <MetricCard
          key={idx}
          label={m.label}
          value={m.value}
          subtitle={m.subtitle}
          status={m.status}
          theme={theme}
        />
      ))}
    </div>
  );
}

/* =====================================================
 * MetricCard (atomic)
 * ===================================================== */

function MetricCard({ label, value, subtitle, status = "neutral", theme }) {
  const statusStyles = {
    neutral: "text-cyan-400",
    ok: "text-green-400",
    warn: "text-yellow-400",
    danger: "text-red-400",
  };

  const borderStyles = {
    neutral: "border-gray-800",
    ok: "border-green-500/30",
    warn: "border-yellow-500/30",
    danger: "border-red-500/30",
  };

  return (
    <div
      className={`${theme.panel} p-4 rounded-xl border ${
        borderStyles[status]
      }`}
    >
      <div className="text-xs text-gray-400">{label}</div>

      <div
        className={`text-3xl font-bold ${
          statusStyles[status]
        }`}
      >
        {value}
      </div>

      {subtitle && (
        <div className={`text-xs mt-1 ${theme.mutedText}`}>
          {subtitle}
        </div>
      )}
    </div>
  );
}