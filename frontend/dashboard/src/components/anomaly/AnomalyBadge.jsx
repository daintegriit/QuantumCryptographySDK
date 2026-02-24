import { useTheme } from "../../context/ThemeContext";

/**
 * AnomalyBadge
 *
 * Deterministic visual indicator for anomaly severity.
 *
 * - No logic
 * - No side effects
 * - Pure presentation
 * - Auditor-friendly
 */
export default function AnomalyBadge({ severity }) {
  const { theme } = useTheme();

  const styles = {
    NONE: "bg-green-500/10 text-green-400 border-green-500/30",
    LOW: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    MEDIUM: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    HIGH: "bg-red-500/10 text-red-400 border-red-500/30",
    CRITICAL: "bg-red-600/20 text-red-500 border-red-600/40",
  };

  const label = severity || "NONE";

  return (
    <span
      className={`px-2 py-1 rounded-md text-xs font-semibold border ${
        styles[label] || styles.NONE
      }`}
    >
      {label}
    </span>
  );
}