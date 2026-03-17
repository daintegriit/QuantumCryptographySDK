import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import TimelineEvent from "./TimelineEvent";

/**
 * KeyTimeline
 *
 * Displays the immutable audit / replay timeline
 * for a single cryptographic key.
 *
 * - Deterministic
 * - Read-only
 * - Compliance-grade
 */
export default function KeyTimeline({ keyId }) {
  const { theme } = useTheme();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Fetch replay timeline
  // =====================================================
  useEffect(() => {
    if (!keyId) return;

    async function loadTimeline() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `http://localhost:8000/api/replay/keys/${keyId}`
        );

        if (!res.ok) {
          throw new Error("Failed to load audit timeline");
        }

        const data = await res.json();
        setEvents(data.events || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTimeline();
  }, [keyId]);

  // =====================================================
  // Phase classification (pure + deterministic)
  // =====================================================
  const phases = useMemo(() => {
    const buckets = {
      CREATION: [],
      USAGE: [],
      ENFORCEMENT: [],
      MIGRATION: [],
      OTHER: [],
    };

    events.forEach((ev) => {
      switch (ev.event_type) {
        case "key_generated":
        case "active_key_bootstrap":
          buckets.CREATION.push(ev);
          break;

        case "encrypt":
        case "decrypt":
          buckets.USAGE.push(ev);
          break;

        case "policy_check":
          buckets.ENFORCEMENT.push(ev);
          break;

        case "migration_evaluation":
        case "key_rotated":
        case "key_migrated":
          buckets.MIGRATION.push(ev);
          break;

        default:
          buckets.OTHER.push(ev);
      }
    });

    return buckets;
  }, [events]);

  // =====================================================
  // States
  // =====================================================
  if (!keyId) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <p className={theme.mutedText}>
          Select a key to view its audit timeline.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <p className={theme.mutedText}>
          Loading cryptographic audit timeline…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${theme.panel} p-6 rounded-xl border border-red-500`}
      >
        <p className="text-red-400 font-semibold">
          Audit Timeline Error
        </p>
        <p className={theme.mutedText}>{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <p className={theme.mutedText}>
          No audit events recorded for this key yet.
        </p>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="space-y-8">
      {/* ================= HEADER ================= */}
      <div>
        <h3 className={`text-lg font-bold ${theme.panelTitle}`}>
          🧾 Key Audit Timeline
        </h3>
        <p className={theme.mutedText}>
          Immutable, phase-structured sequence of cryptographic,
          policy, and lifecycle events.
        </p>
      </div>

      {/* ================= PHASED TIMELINE ================= */}
      {Object.entries(phases).map(([phase, items]) => {
        if (items.length === 0) return null;

        return (
          <div key={phase} className="space-y-4">
            <PhaseHeader phase={phase} theme={theme} />

            <div className="space-y-4">
              {items.map((event, idx) => (
                <TimelineEvent
                  key={`${event.timestamp_utc}-${idx}`}
                  event={event}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// Phase Header (pure UI)
// =====================================================

function PhaseHeader({ phase, theme }) {
  const labels = {
    CREATION: "Key Creation & Activation",
    USAGE: "Cryptographic Usage",
    ENFORCEMENT: "Policy Enforcement",
    MIGRATION: "Rotation & Migration",
    OTHER: "Other Events",
  };

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-800" />
      <span
        className={`text-xs uppercase tracking-wide ${theme.mutedText}`}
      >
        {labels[phase] || phase}
      </span>
      <div className="h-px flex-1 bg-gray-800" />
    </div>
  );
}