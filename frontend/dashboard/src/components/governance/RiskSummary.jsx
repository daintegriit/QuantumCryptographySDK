import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import Card from "../common/Card";

import {
  KeysAPI,
} from "../../services/apiClient";

/**
 * RiskSummary
 *
 * Executive-level aggregation of cryptographic risk.
 *
 * - Deterministic
 * - Read-only
 * - Audit-safe
 * - No ML / no hallucinations
 *
 * Answers:
 * 👉 Where is our cryptographic risk right now?
 */
export default function RiskSummary() {
  const { theme } = useTheme();

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // Load keys + risk metadata
  // =====================================================
  useEffect(() => {
    let mounted = true;

    async function loadRiskData() {
      try {
        setLoading(true);
        setError(null);

        const keyList = await KeysAPI.list();
        const rawKeys = keyList.keys || [];

        const enriched = await Promise.all(
          rawKeys.map(async (k) => {
            const keyId = k.key_id;

            const [policy, migration] = await Promise.all([
              KeysAPI.status(keyId),
              KeysAPI.migration(keyId),
            ]);

            return {
              ...k,
              policy: policy?.policy || null,
              migration: migration || null,
            };
          })
        );

        if (!mounted) return;
        setKeys(enriched);
      } catch (err) {
        console.error("RiskSummary error:", err);
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadRiskData();
    return () => {
      mounted = false;
    };
  }, []);

  // =====================================================
  // Aggregate Risk Intelligence (pure + deterministic)
  // =====================================================
  const riskStats = useMemo(() => {
    let emergency = 0;
    let migrateSoon = 0;
    let monitor = 0;
    let policyDenied = 0;

    keys.forEach((k) => {
      const severity = k.migration?.severity;
      const policyAllowed = k.policy?.allowed;

      if (policyAllowed === false) policyDenied++;

      if (severity === "EMERGENCY") emergency++;
      else if (severity === "MIGRATE_SOON") migrateSoon++;
      else if (severity === "MONITOR") monitor++;
    });

    let posture = "STABLE";
    if (emergency > 0) posture = "CRITICAL";
    else if (migrateSoon > 0 || policyDenied > 0)
      posture = "ELEVATED";

    return {
      emergency,
      migrateSoon,
      monitor,
      policyDenied,
      posture,
      totalKeys: keys.length,
    };
  }, [keys]);

  // =====================================================
  // States
  // =====================================================
  if (loading) {
    return (
      <Card>
        <p className={theme.mutedText}>
          Computing global cryptographic risk posture…
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-red-400 font-semibold">
          Risk Engine Error
        </p>
        <p className={theme.mutedText}>{error}</p>
      </Card>
    );
  }

  // =====================================================
  // UI
  // =====================================================
  return (
    <div className="space-y-8">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <div>
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
          ⚠️ Risk Summary
        </h2>
        <p className={theme.mutedText}>
          Executive-level assessment of cryptographic, policy,
          and quantum-migration risk across the environment.
        </p>
      </div>

      {/* ============================= */}
      {/* Global Posture Banner */}
      {/* ============================= */}
      <RiskPostureBanner posture={riskStats.posture} />

      {/* ============================= */}
      {/* KPI Cards */}
      {/* ============================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <RiskCard
          title="Total Keys"
          value={riskStats.totalKeys}
          description="Keys under governance"
          type="neutral"
          theme={theme}
        />

        <RiskCard
          title="Emergency"
          value={riskStats.emergency}
          description="Immediate migration required"
          type="danger"
          theme={theme}
        />

        <RiskCard
          title="Migrate Soon"
          value={riskStats.migrateSoon}
          description="Within safety margin"
          type="warn"
          theme={theme}
        />

        <RiskCard
          title="Policy Denials"
          value={riskStats.policyDenied}
          description="Non-compliant usage"
          type="danger"
          theme={theme}
        />

        <RiskCard
          title="Monitoring"
          value={riskStats.monitor}
          description="Long-horizon quantum risk"
          type="ok"
          theme={theme}
        />
      </div>
    </div>
  );
}

// =====================================================
// Components
// =====================================================

function RiskPostureBanner({ posture }) {
  const styles = {
    STABLE:
      "bg-green-500/10 border-green-500/30 text-green-400",
    ELEVATED:
      "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    CRITICAL:
      "bg-red-500/10 border-red-500/30 text-red-400",
  };

  const messages = {
    STABLE:
      "System risk posture is stable. No immediate cryptographic action required.",
    ELEVATED:
      "Elevated risk detected. Review migration timelines and policy compliance.",
    CRITICAL:
      "Critical risk detected. Immediate cryptographic remediation required.",
  };

  return (
    <div
      className={`p-4 rounded-xl border text-sm font-semibold ${
        styles[posture]
      }`}
    >
      {messages[posture]}
    </div>
  );
}

function RiskCard({ title, value, description, type, theme }) {
  const colors = {
    neutral: "text-cyan-400",
    ok: "text-green-400",
    warn: "text-yellow-400",
    danger: "text-red-400",
  };

  return (
    <div className={`${theme.panel} p-4 rounded-xl`}>
      <div className="text-sm text-gray-400">{title}</div>
      <div className={`text-3xl font-bold ${colors[type]}`}>
        {value}
      </div>
      <div className={`text-xs ${theme.mutedText}`}>
        {description}
      </div>
    </div>
  );
}