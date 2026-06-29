import { useEffect, useMemo, useState } from "react";

import TimelineEvent from "./TimelineEvent";
import { apiGet } from "../../services/apiClient";

export default function KeyTimeline({ keyId }) {

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!keyId) return;

    async function loadTimeline() {
      try {
        setLoading(true);
        setError(null);
        // BUG FIX 1: hardcoded http://localhost:8008 → use apiGet
        // BUG FIX 2: /api/replay/keys/:id → /api/keys/:id/replay
        const data = await apiGet(`/api/keys/${keyId}/replay`);
        // BUG FIX 3: response shape is { key_id, timeline: { events: [...] } }
        // not { events: [...] } directly
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
    <div className={`bg-gray-900 p-6 rounded-xl`}>
      <p className={theme.mutedText}>Select a key to view its audit timeline.</p>
    </div>
  );

  if (loading) return (
    <div className={`bg-gray-900 p-6 rounded-xl`}>
      <p className={theme.mutedText}>Loading cryptographic audit timeline…</p>
    </div>
  );

  if (error) return (
    <div className={`bg-gray-900 p-6 rounded-xl border border-red-500/30`}>
      <p className="text-red-400 font-semibold">Audit Timeline Error</p>
      <p className={theme.mutedText}>{error}</p>
    </div>
  );

  if (events.length === 0) return (
    <div className={`bg-gray-900 p-6 rounded-xl`}>
      <p className={theme.mutedText}>No audit events recorded for this key yet.</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className={`text-lg font-bold text-white`}>Key Audit Timeline</h3>
        <p className={theme.mutedText}>Immutable, phase-structured sequence of cryptographic, policy, and lifecycle events.</p>
      </div>
      {Object.entries(phases).map(([phase, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={phase} className="space-y-4">
            <PhaseHeader phase={phase} theme={theme} />
            <div className="space-y-4">
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

function PhaseHeader({ phase, theme }) {
  const labels = {
    CREATION: "Key Creation & Activation", USAGE: "Cryptographic Usage",
    ENFORCEMENT: "Policy Enforcement", MIGRATION: "Rotation & Migration", OTHER: "Other Events",
  };
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-800" />
      <span className={`text-xs uppercase tracking-wide text-gray-400`}>{labels[phase] || phase}</span>
      <div className="h-px flex-1 bg-gray-800" />
    </div>
  );
}