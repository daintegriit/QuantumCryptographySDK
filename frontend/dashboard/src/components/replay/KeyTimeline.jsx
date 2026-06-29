import { useEffect, useMemo, useState } from "react";
import { FaKey, FaLock, FaShieldAlt, FaExchangeAlt, FaScroll, FaSpinner, FaExclamationTriangle, FaHistory } from "react-icons/fa";
import TimelineEvent from "./TimelineEvent";
import { apiGet } from "../../services/apiClient";

const PHASE_META = {
  CREATION:    { icon: <FaKey />,          color: "var(--accent)",  label: "Key Creation & Activation" },
  USAGE:       { icon: <FaLock />,         color: "#a78bfa",        label: "Cryptographic Usage" },
  ENFORCEMENT: { icon: <FaShieldAlt />,    color: "#facc15",        label: "Policy Enforcement" },
  MIGRATION:   { icon: <FaExchangeAlt />,  color: "#fb923c",        label: "Rotation & Migration" },
  OTHER:       { icon: <FaScroll />,       color: "var(--text-muted)", label: "Other Events" },
};

export default function KeyTimeline({ keyId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!keyId) return;
    async function loadTimeline() {
      try {
        setLoading(true); setError(null);
        const data = await apiGet(`/api/keys/${keyId}/replay`);
        setEvents(data?.timeline?.events || data?.events || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadTimeline();
  }, [keyId]);

  const phases = useMemo(() => {
    const buckets = { CREATION: [], USAGE: [], ENFORCEMENT: [], MIGRATION: [], OTHER: [] };
    events.forEach((ev) => {
      switch (ev.event_type) {
        case "key_generated": case "active_key_bootstrap": buckets.CREATION.push(ev); break;
        case "encrypt": case "decrypt": buckets.USAGE.push(ev); break;
        case "policy_check": buckets.ENFORCEMENT.push(ev); break;
        case "migration_evaluation": case "key_rotated": case "key_migrated": buckets.MIGRATION.push(ev); break;
        default: buckets.OTHER.push(ev);
      }
    });
    return buckets;
  }, [events]);

  if (!keyId) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Select a key to view its audit timeline.</p>
    </div>
  );

  if (loading) return (
    <div className="p-6 rounded-xl flex items-center gap-3" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <FaSpinner className="animate-spin" style={{ color: "var(--accent)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading cryptographic audit timeline…</p>
    </div>
  );

  if (error) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid rgba(239,68,68,0.3)" }}>
      <p className="font-semibold flex items-center gap-2 text-red-400"><FaExclamationTriangle /> Audit Timeline Error</p>
      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{error}</p>
    </div>
  );

  if (events.length === 0) return (
    <div className="p-6 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>No audit events recorded for this key yet.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FaHistory style={{ color: "var(--accent)" }} />
        <div>
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Key Audit Timeline</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Immutable, phase-structured sequence of cryptographic, policy, and lifecycle events.</p>
        </div>
      </div>
      {Object.entries(phases).map(([phase, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={phase} className="space-y-3">
            <PhaseHeader phase={phase} />
            <div className="space-y-3 pl-2">
              {items.map((event, idx) => (
                <TimelineEvent key={`${event.timestamp_utc}-${idx}`} event={event} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PhaseHeader({ phase }) {
  const meta = PHASE_META[phase] || PHASE_META.OTHER;
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: "var(--border)" }} />
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide"
        style={{ color: meta.color }}>
        {meta.icon} {meta.label}
      </div>
      <div className="h-px flex-1" style={{ background: "var(--border)" }} />
    </div>
  );
}
