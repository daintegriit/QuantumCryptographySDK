// src/components/layout/TopNav.jsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import ThemeSwitcher from "../ThemeSwitcher";
import { apiGet } from "../../services/apiClient";

export default function TopNav() {
  const { theme } = useTheme();
  const location = useLocation();
  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    async function checkHealth() {
      try {
        // BUG FIX: hardcoded http://localhost:8000/health → wrong port (8000 not 8008)
        // Also breaks in Docker where frontend runs in nginx container.
        // Use apiGet which respects VITE_API_BASE and works via nginx proxy.
        await apiGet("/health");
        setBackendStatus("online");
      } catch {
        setBackendStatus("offline");
      }
    }
    checkHealth();
  }, []);

  function StatusDot() {
    const map = {
      online: "bg-green-400",
      degraded: "bg-yellow-400",
      offline: "bg-red-500",
      checking: "bg-gray-400",
    };
    return <span className={`w-2.5 h-2.5 rounded-full ${map[backendStatus]} animate-pulse`} />;
  }

  const pageTitle = resolveTitle(location.pathname);

  return (
    <header className={`${theme.panel} border-b border-gray-800 px-6 py-4 flex items-center justify-between`}>
      <div className="flex flex-col">
        <div className="flex items-center gap-4">
          <h1 className={`font-semibold tracking-wide ${theme.panelTitle}`}>{pageTitle}</h1>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <StatusDot />
            <span className="uppercase tracking-wide">Backend: {backendStatus}</span>
          </div>
        </div>
        <span className={`text-xs ${theme.mutedText}`}>QuantumShield Governance Console</span>
      </div>

      <div className="flex items-center gap-6">
        <button
          className="text-xs px-3 py-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-50"
          title="AI Copilot (Coming Soon)"
          disabled
        >
          AI Copilot
        </button>
        <ThemeSwitcher />
        <div className="text-xs text-gray-400">
          <span className="font-medium text-gray-300">Role:</span> Admin
        </div>
      </div>
    </header>
  );
}

function resolveTitle(pathname) {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/governance")) return "Governance Overview";
  if (pathname.startsWith("/keys")) return "Key Explorer";
  if (pathname.startsWith("/telemetry")) return "Telemetry & Metrics";
  if (pathname.startsWith("/replay")) return "Audit Replay";
  if (pathname.startsWith("/explain")) return "Key Explanation";
  if (pathname.startsWith("/anomalies")) return "Anomaly Detection";
  if (pathname.startsWith("/risk")) return "Risk Summary";
  if (pathname.startsWith("/simulation")) return "Simulation";
  if (pathname.startsWith("/crypto")) return "Crypto Operations";
  if (pathname.startsWith("/audit")) return "Audit Trail";
  if (pathname.startsWith("/metrics")) return "Metrics";
  if (pathname.startsWith("/how-it-works")) return "How It Works";
  return "QuantumShield";
}