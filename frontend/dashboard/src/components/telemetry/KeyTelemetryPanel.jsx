import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import Card from "../common/Card";
import Spinner from "../common/Spinner";
import EmptyState from "../common/EmptyState";

import { fetchKeyTelemetry } from "../../services/telemetryApi";

/**
 * KeyTelemetryPanel
 *
 * Displays per-key cryptographic usage telemetry.
 *
 * - Deterministic
 * - Read-only
 * - Audit-safe
 * - 404 == no data (NOT an error)
 */
export default function KeyTelemetryPanel({ keyId }) {
  const { theme } = useTheme();

  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadTelemetry() {
      // 🚫 No key → no fetch
      if (!keyId) {
        setTelemetry(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const data = await fetchKeyTelemetry(keyId);
        if (mounted) setTelemetry(data);
      } catch (err) {
        // ✅ 404 = key exists but no audit history yet
        if (err.message.includes("404")) {
          if (mounted) setTelemetry(null);
        } else {
          if (mounted) setError(err.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTelemetry();
    return () => {
      mounted = false;
    };
  }, [keyId]);

  /* ================= STATES ================= */

  if (!keyId) {
    return (
      <Card>
        <EmptyState message="Select a key to view telemetry." />
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading key telemetry…" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-red-400 font-semibold">Telemetry Error</p>
        <p className={theme.mutedText}>{error}</p>
      </Card>
    );
  }

  if (!telemetry) {
    return (
      <Card>
        <EmptyState message="No telemetry available yet. Perform cryptographic operations to generate audit data." />
      </Card>
    );
  }

  /* ================= UI ================= */

  return (
    <Card>
      <div className="space-y-4">
        <h4 className={`font-semibold ${theme.panelTitle}`}>
          📈 Key Telemetry
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <TelemetryItem label="Encryptions" value={telemetry.encrypt_count} />
          <TelemetryItem label="Decryptions" value={telemetry.decrypt_count} />
          <TelemetryItem label="Last Used" value={telemetry.last_used || "—"} />
        </div>
      </div>
    </Card>
  );
}

function TelemetryItem({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-mono text-cyan-400">
        {value ?? "—"}
      </div>
    </div>
  );
}