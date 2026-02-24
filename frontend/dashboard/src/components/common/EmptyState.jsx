// src/components/common/EmptyState.jsx

/**
 * EmptyState
 *
 * Deterministic empty / no-data state.
 *
 * Design goals:
 * - Zero logic
 * - No side effects
 * - Fully reusable
 * - Executive + auditor friendly
 * - Production-safe
 *
 * Usage:
 * <EmptyState />
 * <EmptyState title="No Keys" description="No cryptographic keys found." />
 */

export default function EmptyState({
  title = "No Data Available",
  description = "There is currently no data to display.",
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-10">
      <div className="text-sm font-semibold text-gray-300">
        {title}
      </div>

      <div className="text-sm text-gray-400 max-w-sm">
        {description}
      </div>

      {action && (
        <div className="mt-3">
          {action}
        </div>
      )}
    </div>
  );
}