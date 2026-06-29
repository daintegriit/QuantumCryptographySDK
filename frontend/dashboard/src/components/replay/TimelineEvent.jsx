import { FaKey, FaLock, FaLockOpen, FaShieldAlt, FaBrain, FaSync, FaExclamationCircle, FaStar, FaRocket, FaMapPin } from "react-icons/fa";

const EVENT_META = {
  key_generated:        { label: "Key Generated",          icon: <FaKey />,               border: "rgba(74,222,128,0.3)",  bg: "rgba(74,222,128,0.05)",  color: "#4ade80" },
  encrypt:              { label: "Encryption",              icon: <FaLock />,              border: "rgba(6,182,212,0.3)",   bg: "rgba(6,182,212,0.05)",   color: "var(--accent)" },
  decrypt:              { label: "Decryption",              icon: <FaLockOpen />,          border: "rgba(6,182,212,0.3)",   bg: "rgba(6,182,212,0.05)",   color: "var(--accent)" },
  policy_check:         { label: "Policy Enforcement",      icon: <FaShieldAlt />,         border: "rgba(250,204,21,0.3)",  bg: "rgba(250,204,21,0.05)",  color: "#facc15" },
  migration_evaluation: { label: "Quantum Risk Evaluation", icon: <FaBrain />,             border: "rgba(167,139,250,0.3)", bg: "rgba(167,139,250,0.05)", color: "#a78bfa" },
  key_rotated:          { label: "Key Rotation",            icon: <FaSync />,              border: "rgba(96,165,250,0.3)",  bg: "rgba(96,165,250,0.05)",  color: "#60a5fa" },
  key_migrated:         { label: "Key Migration",           icon: <FaExclamationCircle />, border: "rgba(239,68,68,0.3)",   bg: "rgba(239,68,68,0.05)",   color: "#f87171" },
  active_key_set:       { label: "Active Key Set",          icon: <FaStar />,              border: "rgba(74,222,128,0.3)",  bg: "rgba(74,222,128,0.05)",  color: "#4ade80" },
  active_key_bootstrap: { label: "Initial Activation",      icon: <FaRocket />,            border: "rgba(74,222,128,0.3)",  bg: "rgba(74,222,128,0.05)",  color: "#4ade80" },
  default:              { label: "Event",                   icon: <FaMapPin />,            border: "var(--border)",         bg: "var(--input-bg)",        color: "var(--text-muted)" },
};

export default function TimelineEvent({ event }) {
  if (!event) return null;
  const { timestamp_utc, event_type, summary, scheme, parameter_set } = event;
  const meta = EVENT_META[event_type] || EVENT_META.default;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="w-9 h-9 flex items-center justify-center rounded-full text-sm"
          style={{ border: `1px solid ${meta.border}`, background: meta.bg, color: meta.color }}>
          {meta.icon}
        </span>
        <div className="flex-1 w-px mt-1" style={{ background: "var(--border)" }} />
      </div>

      <div className="flex-1 p-4 rounded-xl space-y-2 mb-2"
        style={{ border: `1px solid ${meta.border}`, background: meta.bg }}>
        <div className="flex justify-between items-center">
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{meta.label}</div>
          <time className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{formatTs(timestamp_utc)}</time>
        </div>
        <div className="text-sm" style={{ color: "var(--text-secondary, var(--text-primary))" }}>{summary || "No summary available"}</div>
        {(scheme || parameter_set) && (
          <div className="text-xs flex gap-4" style={{ color: "var(--text-muted)" }}>
            {scheme && <span><span style={{ color: "var(--text-muted)" }}>Scheme:</span> <span className="font-mono" style={{ color: meta.color }}>{scheme}</span></span>}
            {parameter_set && <span><span style={{ color: "var(--text-muted)" }}>Params:</span> <span className="font-mono" style={{ color: meta.color }}>{parameter_set}</span></span>}
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
