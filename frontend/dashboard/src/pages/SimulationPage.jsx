// src/pages/SimulationPage.jsx
import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import SectionHeader from "../components/layout/SectionHeader";
import Card from "../components/common/Card";

import ScenarioSelector from "../components/simulation/ScenarioSelector";
import SimulationPanel from "../components/simulation/SimulationPanel";

export default function SimulationPage() {
  const { theme } = useTheme();

  // BUG FIX: original rendered <ScenarioSelector /> with no onResult prop
  // and <SimulationPanel /> with no result prop — they were completely
  // disconnected. ScenarioSelector runs the simulation and calls onResult
  // with the portfolio result; SimulationPanel displays it.
  // Added shared state to wire them together.
  const [simulationResult, setSimulationResult] = useState(null);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Simulation"
        subtitle="Explore cryptographic futures, migration timelines, and policy outcomes without enforcement."
        icon="🧪"
      />

      <Card>
        <p className={theme.mutedText}>
          This simulation environment provides deterministic, audit-safe
          projections based on current cryptographic posture, telemetry, and
          migration intelligence. No keys are modified and no enforcement
          actions are taken.
        </p>
      </Card>

      {/* Scenario selector — runs the simulation and passes result up */}
      <ScenarioSelector onResult={setSimulationResult} />

      {/* Simulation panel — displays result once available */}
      <SimulationPanel result={simulationResult} />
    </div>
  );
}