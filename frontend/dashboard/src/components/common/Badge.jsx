// src/components/common/Badge.jsx

/**
 * Badge
 *
 * Small, semantic status indicator.
 *
 * Design goals:
 * - Deterministic
 * - Theme-agnostic (uses Tailwind tokens)
 * - No logic / no side effects
 * - Reusable across governance, risk, and telemetry views
 *
 * Types:
 * - ok
 * - warn
 * - danger
 * - neutral
 */

export default function Badge({ label, type = "neutral", className = "" }) {
  const styles = {
    ok: "bg-green-500/10 text-green-400 border-green-500/30",
    warn: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    danger: "bg-red-500/10 text-red-400 border-red-500/30",
    neutral: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
        styles[type] || styles.neutral
      } ${className}`}
    >
      {label}
    </span>
  );
}