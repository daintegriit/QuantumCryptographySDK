// src/pages/GovernancePage.jsx

import GovernanceOverview from "../components/governance/GovernanceOverview";
import RiskSummary from "../components/governance/RiskSummary";
import PolicyDriftDashboard from "../components/governance/PolicyDriftDashboard";
import KeyExplorer from "../components/governance/KeyExplorer";
import SectionHeader from "../components/layout/SectionHeader";

export default function GovernancePage() {
  return (
    <div className="space-y-12">
      {/* =============================== */}
      {/* Page Header */}
      {/* =============================== */}
      <SectionHeader
        title="Governance & Risk"
        subtitle="System-wide cryptographic posture, risk exposure, policy enforcement, and long-horizon drift detection."
      />

      {/* =============================== */}
      {/* System Overview */}
      {/* =============================== */}
      <GovernanceOverview />

      {/* =============================== */}
      {/* Risk Snapshot */}
      {/* =============================== */}
      <RiskSummary />

      {/* =============================== */}
      {/* Policy Drift (Temporal Risk) */}
      {/* =============================== */}
      <PolicyDriftDashboard />

      {/* =============================== */}
      {/* Key-Level Exploration */}
      {/* =============================== */}
      <KeyExplorer />
    </div>
  );
}