import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { ActiveKeyProvider } from "./context/ActiveKeyContext";
import DashboardLayout from "./components/layout/DashboardLayout";

// Pages
import DashboardPage from "./pages/DashboardPage";
import CryptoPage from "./pages/CryptoPage";
import KeysPage from "./pages/KeysPage";
import GovernancePage from "./pages/GovernancePage";
import SimulationPage from "./pages/SimulationPage";
import AuditPage from "./pages/AuditPage";
import TelemetryDashboard from "./pages/analysis/TelemetryDashboard";
import MetricsPage from "./pages/MetricsPage";
import RiskSummaryPage from "./pages/RiskSummaryPage";
import AnomalyDashboard from "./pages/AnomalyDashboard";
import ExplainPage from "./pages/ExplainPage";
import CliPage from "./pages/CliPage";
import AlgorithmsPage from "./pages/AlgorithmsPage";
import HowItWorksPage from "./pages/HowItWorksPage";

export default function App() {
  return (
    <ThemeProvider>
      <ActiveKeyProvider>
        <Router>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="crypto" element={<CryptoPage />} />
              <Route path="keys" element={<KeysPage />} />
              <Route path="governance" element={<GovernancePage />} />
              <Route path="simulation" element={<SimulationPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="telemetry" element={<TelemetryDashboard />} />
              <Route path="metrics" element={<MetricsPage />} />
              <Route path="risk" element={<RiskSummaryPage />} />
              <Route path="anomalies" element={<AnomalyDashboard />} />
              <Route path="explain" element={<ExplainPage />} />
              <Route path="cli" element={<CliPage />} />
              <Route path="algorithms" element={<AlgorithmsPage />} />
              <Route path="how-it-works" element={<HowItWorksPage />} />
            </Route>
          </Routes>
        </Router>
      </ActiveKeyProvider>
    </ThemeProvider>
  );
}