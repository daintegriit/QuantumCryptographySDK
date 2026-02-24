// src/components/common/Spinner.jsx

/**
 * Spinner
 *
 * Deterministic loading indicator.
 *
 * Design goals:
 * - Zero state
 * - No side effects
 * - No timers
 * - Accessible
 * - Production-safe
 *
 * Usage:
 * <Spinner />
 * <Spinner label="Loading telemetry…" />
 */

export default function Spinner({ label = "Loading…" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-6"
    >
      {/* Spinner */}
      <div className="h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />

      {/* Label */}
      <span className="text-sm text-gray-400">{label}</span>
    </div>
  );
}