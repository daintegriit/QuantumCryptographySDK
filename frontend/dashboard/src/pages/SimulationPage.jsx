import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { FaFlask, FaInfoCircle } from "react-icons/fa";
import SectionHeader from "../components/layout/SectionHeader";
import Card from "../components/common/Card";
import ScenarioSelector from "../components/simulation/ScenarioSelector";
import SimulationPanel from "../components/simulation/SimulationPanel";

export default function SimulationPage() {
  const { theme } = useTheme();
  const [simulationResult, setSimulationResult] = useState(null);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Simulation"
        subtitle="Explore cryptographic futures, migration timelines, and policy outcomes without enforcement."
        icon={<FaFlask className="text-cyan-400" />}
      />

      <Card>
        <div className="flex gap-3 items-start">
          <FaInfoCircle className="text-cyan-400 shrink-0 mt-0.5" />
          <p className={theme.mutedText}>
            This simulation environment provides deterministic, audit-safe projections based on current
            cryptographic posture, telemetry, and migration intelligence. No keys are modified and no
            enforcement actions are taken.
          </p>
        </div>
      </Card>

      <ScenarioSelector onResult={setSimulationResult} />
      <SimulationPanel result={simulationResult} />
    </div>
  );
}
