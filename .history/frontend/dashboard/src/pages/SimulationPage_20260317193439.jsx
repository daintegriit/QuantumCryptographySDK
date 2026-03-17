// src/pages/SimulationPage.jsx

import { useTheme } from "../context/ThemeContext";
import SectionHeader from "../components/layout/SectionHeader";
import Card from "../components/common/Card";

import ScenarioSelector from "../components/simulation/ScenarioSelector";
import MigrationProjectionChart from "../components/simulation/MigrationProjectionChart";
import SimulationPanel from "../components/simulation/SimulationPanel";

/**
 * SimulationPage
 *
 * Cryptographic what-if & forward-looking analysis surface.
 *
 * DESIGN PRINCIPLES:
 * - Read-only (no mutation)
 * - Deterministic
 * - Audit-safe
 * - Uses existing telemetry + migration intelligence
 *
 * PURPOSE:
 * - Explore migration timelines
 * - Visualize quantum risk horizons
 * - Preview policy & lifecycle outcomes
 */
export default function SimulationPage() {
  const { theme } = useTheme();

  return (
    <div className="space-y-8">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <SectionHeader
        title="Simulation"
        subtitle="Explore cryptographic futures, migration timelines, and policy outcomes without enforcement."
        icon="🧪"
      />

      {/* ============================= */}
      {/* Executive Context */}
      {/* ============================= */}
      <Card>
        <p className={theme.mutedText}>
          This simulation environment provides deterministic, audit-safe
          projections based on current cryptographic posture, telemetry, and
          migration intelligence. No keys are modified and no enforcement
          actions are taken.
        </p>
      </Card>

      {/* ============================= */}
      {/* Scenario Selection */}
      {/* ============================= */}
      <Card>
        <h3 className={`font-semibold mb-2 ${theme.panelTitle}`}>
          Scenario Configuration
        </h3>
        <p className={`${theme.mutedText} mb-4`}>
          Select a projection scenario to explore how cryptographic posture
          evolves under different assumptions.
        </p>

        <ScenarioSelector />
      </Card>

      {/* ============================= */}
      {/* Migration Projection */}
      {/* ============================= */}
      <Card>
        <h3 className={`font-semibold mb-2 ${theme.panelTitle}`}>
          Migration Projection
        </h3>
        <p className={`${theme.mutedText} mb-4`}>
          Forward-looking view of key migration pressure and quantum risk
          horizon based on current lifecycle and telemetry signals.
        </p>

        <MigrationProjectionChart />
      </Card>

      {/* ============================= */}
      {/* Simulation Controls (Read-Only) */}
      {/* ============================= */}
      <Card>
        <h3 className={`font-semibold mb-2 ${theme.panelTitle}`}>
          Simulation Analysis
        </h3>
        <p className={`${theme.mutedText} mb-4`}>
          Interpret projected outcomes and understand how policy, lifecycle,
          and quantum timelines interact under the selected scenario.
        </p>

        <SimulationPanel />
      </Card>

      {/* ============================= */}
      {/* Compliance Footer */}
      {/* ============================= */}
      <div className="text-xs text-gray-500">
        Simulations are projections only. Results are derived from current
        system state and do not represent enforced cryptographic actions.
      </div>
    </div>
  );
}