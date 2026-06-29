import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { ActiveKeyProvider } from "./context/ActiveKeyContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardLayout from "./components/layout/DashboardLayout";

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
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-cyan-400 text-sm animate-pulse">Loading Q-SENTRY...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
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
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ActiveKeyProvider>
          <Router>
            <AppRoutes />
          </Router>
        </ActiveKeyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
