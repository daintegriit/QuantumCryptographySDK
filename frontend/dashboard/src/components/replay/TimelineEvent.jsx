import { FaKey, FaLock, FaLockOpen, FaShieldAlt, FaBrain, FaSync, FaExclamationCircle, FaStar, FaRocket, FaMapPin } from "react-icons/fa";

const EVENT_META = {
  key_generated:        { label: "Key Generated",          icon: <FaKey />,               color: "border-green-500/30 text-green-400 bg-green-500/5" },
  encrypt:              { label: "Encryption",              icon: <FaLock />,              color: "border-cyan-500/30 text-cyan-400 bg-cyan-500/5" },
  decrypt:              { label: "Decryption",              icon: <FaLockOpen />,          color: "border-cyan-500/30 text-cyan-400 bg-cyan-500/5" },
  policy_check:         { label: "Policy Enforcement",      icon: <FaShieldAlt />,         color: "border-yellow-500/30 text-yellow-400 bg-yellow-500/5" },
  migration_evaluation: { label: "Quantum Risk Evaluation", icon: <FaBrain />,             color: "border-purple-500/30 text-purple-400 bg-purple-500/5" },
  key_rotated:          { label: "Key Rotation",            icon: <FaSync />,              color: "border-blue-500/30 text-blue-400 bg-blue-500/5" },
  key_migrated:         { label: "Key Migration",           icon: <FaExclamationCircle />, color: "border-red-500/30 text-red-400 bg-red-500/5" },
  active_key_set:       { label: "Active Key Set",          icon: <FaStar />,              color: "border-green-500/30 text-green-400 bg-green-500/5" },
  active_key_bootstrap: { label: "Initial Activation",      icon: <FaRocket />,            color: "border-green-500/30 text-green-400 bg-green-500/5" },
  default:              { label: "Event",                   icon: <FaMapPin />,            color: "border-gray-600 text-gray-400 bg-gray-500/5" },
};

export default function TimelineEvent({ event }) {
  if (!event) return null;
  const { timestamp_utc, event_type, summary, scheme, parameter_set } = event;
  const meta = EVENT_META[event_type] || EVENT_META.default;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className={`w-9 h-9 flex items-center justify-center rounded-full text-sm border ${meta.color}`}>
          {meta.icon}
        </span>
        <div className="flex-1 w-px bg-gray-800 mt-1" />
      </div>

      <div className={`flex-1 p-4 rounded-xl border ${meta.color} space-y-2 mb-2`}>
        <div className="flex justify-between items-center">
          <div className="text-sm font-semibold text-white">{meta.label}</div>
          <time className="text-xs text-gray-400 font-mono">{formatTs(timestamp_utc)}</time>
        </div>
        <div className="text-sm text-gray-300">{summary || "No summary available"}</div>
        {(scheme || parameter_set) && (
          <div className="text-xs text-gray-500 flex gap-4">
            {scheme && <span><span className="text-gray-400">Scheme:</span> <span className="font-mono text-cyan-400">{scheme}</span></span>}
            {parameter_set && <span><span className="text-gray-400">Params:</span> <span className="font-mono text-cyan-400">{parameter_set}</span></span>}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTs(ts) {
  if (!ts) return "unknown";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}
