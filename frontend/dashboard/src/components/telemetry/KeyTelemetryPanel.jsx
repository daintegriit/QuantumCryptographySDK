import { useEffect, useState } from "react";
import { FaChartBar, FaLock, FaLockOpen, FaClock } from "react-icons/fa";
import Card from "../common/Card";
import Spinner from "../common/Spinner";
import EmptyState from "../common/EmptyState";
import { fetchKeyTelemetry } from "../../services/telemetryApi";

export default function KeyTelemetryPanel({ keyId }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadTelemetry() {
      if (!keyId) { setTelemetry(null); setLoading(false); return; }
      try {
        setLoading(true); setError(null);
        const data = await fetchKeyTelemetry(keyId);
        if (mounted) setTelemetry(data);
      } catch (err) {
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
    return () => { mounted = false; };
  }, [keyId]);

  if (!keyId) return <Card><EmptyState message="Select a key to view telemetry." /></Card>;
  if (loading) return <Card><Spinner label="Loading key telemetry…" /></Card>;
  if (error) return (
    <Card>
      <p className="font-semibold text-red-400">Telemetry Error</p>
      <p style={{ color: "var(--text-muted)" }}>{error}</p>
    </Card>
  );
  if (!telemetry) return <Card><EmptyState message="No telemetry available yet. Perform cryptographic operations to generate audit data." /></Card>;

  return (
    <Card>
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaChartBar style={{ color: "var(--accent)" }} /> Key Telemetry
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <TelemetryItem label="Encryptions" value={telemetry.encrypt_count} icon={<FaLock />} />
          <TelemetryItem label="Decryptions" value={telemetry.decrypt_count} icon={<FaLockOpen />} />
          <TelemetryItem label="Last Used"   value={telemetry.last_used || "—"} icon={<FaClock />} />
        </div>
      </div>
    </Card>
  );
}

function TelemetryItem({ label, value, icon }) {
  return (
    <div>
      <div className="text-xs flex items-center gap-1.5 mb-1" style={{ color: "var(--text-muted)" }}>
        <span style={{ color: "var(--accent)" }}>{icon}</span> {label}
      </div>
      <div className="text-sm font-mono" style={{ color: "var(--accent)" }}>{value ?? "—"}</div>
    </div>
  );
}
