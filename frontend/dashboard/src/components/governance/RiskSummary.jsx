import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { FaExclamationTriangle, FaCheckCircle, FaShieldAlt, FaKey, FaBolt, FaClock, FaBan, FaEye, FaSpinner } from "react-icons/fa";
import Card from "../common/Card";
import { KeysAPI } from "../../services/apiClient";

export default function RiskSummary() {
  const { theme } = useTheme();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
            const [policy, migration] = await Promise.all([
              KeysAPI.status(k.key_id),
              KeysAPI.migration(k.key_id),
            ]);
            return { ...k, policy: policy?.policy || null, migration: migration || null };
          })
        );
        if (!mounted) return;
        setKeys(enriched);
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadRiskData();
    return () => { mounted = false; };
  }, []);

  const riskStats = useMemo(() => {
    let emergency = 0, migrateSoon = 0, monitor = 0, policyDenied = 0;
    keys.forEach((k) => {
      const severity = k.migration?.severity;
      if (k.policy?.allowed === false) policyDenied++;
      if (severity === "EMERGENCY") emergency++;
      else if (severity === "MIGRATE_SOON") migrateSoon++;
      else if (severity === "MONITOR") monitor++;
    });
    let posture = "STABLE";
    if (emergency > 0) posture = "CRITICAL";
    else if (migrateSoon > 0 || policyDenied > 0) posture = "ELEVATED";
    return { emergency, migrateSoon, monitor, policyDenied, posture, totalKeys: keys.length };
  }, [keys]);

  if (loading) return (
    <Card>
      <div className="flex items-center gap-3">
        <FaSpinner className="animate-spin text-cyan-400" />
        <p className={theme.mutedText}>Computing global cryptographic risk posture…</p>
      </div>
    </Card>
  );

  if (error) return (
    <Card>
      <p className="text-red-400 font-semibold flex items-center gap-2"><FaExclamationTriangle /> Risk Engine Error</p>
      <p className={theme.mutedText}>{error}</p>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className={`text-xl font-bold flex items-center gap-2 ${theme.panelTitle}`}>
          <FaShieldAlt className="text-red-400" /> Risk Summary
        </h2>
        <p className={theme.mutedText}>Executive-level assessment of cryptographic, policy, and quantum-migration risk across the environment.</p>
      </div>

      <RiskPostureBanner posture={riskStats.posture} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <RiskCard title="Total Keys"     value={riskStats.totalKeys}   description="Keys under governance"    type="neutral" icon={<FaKey />}               theme={theme} />
        <RiskCard title="Emergency"      value={riskStats.emergency}   description="Immediate migration"      type="danger"  icon={<FaBolt />}              theme={theme} />
        <RiskCard title="Migrate Soon"   value={riskStats.migrateSoon} description="Within safety margin"    type="warn"    icon={<FaClock />}             theme={theme} />
        <RiskCard title="Policy Denials" value={riskStats.policyDenied} description="Non-compliant usage"   type="danger"  icon={<FaBan />}               theme={theme} />
        <RiskCard title="Monitoring"     value={riskStats.monitor}     description="Long-horizon quantum risk" type="ok"   icon={<FaEye />}               theme={theme} />
      </div>
    </div>
  );
}

function RiskPostureBanner({ posture }) {
  const styles = {
    STABLE:   "bg-green-500/10 border-green-500/30 text-green-400",
    ELEVATED: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    CRITICAL: "bg-red-500/10 border-red-500/30 text-red-400",
  };
  const icons = {
    STABLE:   <FaCheckCircle />,
    ELEVATED: <FaExclamationTriangle />,
    CRITICAL: <FaBolt />,
  };
  const messages = {
    STABLE:   "System risk posture is stable. No immediate cryptographic action required.",
    ELEVATED: "Elevated risk detected. Review migration timelines and policy compliance.",
    CRITICAL: "Critical risk detected. Immediate cryptographic remediation required.",
  };
  return (
    <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center gap-3 ${styles[posture]}`}>
      {icons[posture]} {messages[posture]}
    </div>
  );
}

function RiskCard({ title, value, description, type, icon, theme }) {
  const colors = { neutral: "text-cyan-400", ok: "text-green-400", warn: "text-yellow-400", danger: "text-red-400" };
  return (
    <div className={`${theme.panel} p-4 rounded-xl`}>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
        <span className={colors[type]}>{icon}</span> {title}
      </div>
      <div className={`text-3xl font-bold ${colors[type]}`}>{value}</div>
      <div className={`text-xs mt-1 ${theme.mutedText}`}>{description}</div>
    </div>
  );
}
