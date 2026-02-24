import { useTheme } from "../../context/ThemeContext";

/**
 * TimelineEvent
 *
 * Renders a single immutable audit event in a human-readable,
 * compliance-grade format.
 *
 * This component is intentionally deterministic and side-effect free.
 */
export default function TimelineEvent({ event }) {
  const { theme } = useTheme();

  if (!event) return null;

  const {
    timestamp_utc,
    event_type,
    summary,
    scheme,
    parameter_set,
  } = event;

  const meta = EVENT_META[event_type] || EVENT_META.default;

  return (
    <div className="flex gap-4">
      {/* ================= LEFT: ICON + LINE ================= */}
      <div className="flex flex-col items-center">
        <span
          className={`w-9 h-9 flex items-center justify-center rounded-full text-sm border ${meta.color}`}
          title={event_type}
        >
          {meta.icon}
        </span>
        <div className="flex-1 w-px bg-gray-700 mt-1" />
      </div>

      {/* ================= RIGHT: CONTENT ================= */}
      <div
        className={`${theme.panel} flex-1 p-4 rounded-xl space-y-2`}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="text-sm font-semibold">
            {meta.label}
          </div>
          <time className="text-xs text-gray-400 font-mono">
            {formatTs(timestamp_utc)}
          </time>
        </div>

        {/* Summary */}
        <div className={`text-sm ${theme.panelText}`}>
          {summary || "No summary available"}
        </div>

        {/* Metadata */}
        {(scheme || parameter_set) && (
          <div className="text-xs text-gray-500 flex gap-4">
            {scheme && (
              <span>
                <span className="text-gray-400">Scheme:</span>{" "}
                <span className="font-mono text-cyan-400">
                  {scheme}
                </span>
              </span>
            )}
            {parameter_set && (
              <span>
                <span className="text-gray-400">Params:</span>{" "}
                <span className="font-mono text-cyan-400">
                  {parameter_set}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Event metadata registry
// =====================================================

const EVENT_META = {
  key_generated: {
    label: "Key Generated",
    icon: "🔑",
    color: "border-green-500/30 text-green-400",
  },
  encrypt: {
    label: "Encryption",
    icon: "🔐",
    color: "border-cyan-500/30 text-cyan-400",
  },
  decrypt: {
    label: "Decryption",
    icon: "🔓",
    color: "border-cyan-500/30 text-cyan-400",
  },
  policy_check: {
    label: "Policy Enforcement",
    icon: "🛡️",
    color: "border-yellow-500/30 text-yellow-400",
  },
  migration_evaluation: {
    label: "Quantum Risk Evaluation",
    icon: "🧠",
    color: "border-purple-500/30 text-purple-400",
  },
  key_rotated: {
    label: "Key Rotation",
    icon: "🔁",
    color: "border-blue-500/30 text-blue-400",
  },
  key_migrated: {
    label: "Key Migration",
    icon: "🚨",
    color: "border-red-500/30 text-red-400",
  },
  active_key_set: {
    label: "Active Key Set",
    icon: "⭐",
    color: "border-green-500/30 text-green-400",
  },
  active_key_bootstrap: {
    label: "Initial Activation",
    icon: "🚀",
    color: "border-green-500/30 text-green-400",
  },
  default: {
    label: "Event",
    icon: "📌",
    color: "border-gray-600 text-gray-400",
  },
};

// =====================================================
// Helpers
// =====================================================

function formatTs(ts) {
  if (!ts) return "unknown";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}