// src/components/layout/TopNav.jsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import ThemeSwitcher from "../ThemeSwitcher";
import UserMenu from "./UserMenu";
import { useAuth } from "../../context/AuthContext";
import { apiGet } from "../../services/apiClient";

export default function TopNav() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    async function checkHealth() {
      try {
        await apiGet("/health");
        setBackendStatus("online");
      } catch {
        setBackendStatus("offline");
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  function StatusDot() {
    const map = {
      online: "bg-green-400", degraded: "bg-yellow-400",
      offline: "bg-red-500", checking: "bg-gray-400",
    };
    return <span className={`w-2 h-2 rounded-full ${map[backendStatus]} ${backendStatus === "online" ? "animate-pulse" : ""}`} />;
  }

  const pageTitle = resolveTitle(location.pathname);

  return (
    <header className={`${theme.panel} border-b border-gray-800 px-6 py-3 flex items-center justify-between gap-4`}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className={`font-semibold tracking-wide text-sm ${theme.panelTitle} truncate`}>{pageTitle}</h1>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
            <StatusDot />
            <span className="uppercase tracking-wide font-medium">Backend: {backendStatus}</span>
          </div>
        </div>
        <span className={`text-xs ${theme.mutedText}`}>QuantumShield Governance Console</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button className="text-xs px-3 py-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-40 whitespace-nowrap" disabled>
          AI Copilot
        </button>
        <ThemeSwitcher />
        <div className="w-px h-5 bg-gray-700" />
        {user ? <UserMenu /> : <div className="text-xs text-gray-400"><span className="font-medium text-gray-300">Role:</span> Admin</div>}
      </div>
    </header>
  );
}

function resolveTitle(pathname) {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/governance"))   return "Governance Overview";
  if (pathname.startsWith("/keys"))         return "Key Explorer";
  if (pathname.startsWith("/telemetry"))    return "Telemetry & Metrics";
  if (pathname.startsWith("/replay"))       return "Audit Replay";
  if (pathname.startsWith("/explain"))      return "Key Explanation";
  if (pathname.startsWith("/anomalies"))    return "Anomaly Detection";
  if (pathname.startsWith("/risk"))         return "Risk Summary";
  if (pathname.startsWith("/simulation"))   return "Simulation";
  if (pathname.startsWith("/crypto"))       return "Crypto Operations";
  if (pathname.startsWith("/audit"))        return "Audit Trail";
  if (pathname.startsWith("/metrics"))      return "Metrics";
  if (pathname.startsWith("/how-it-works")) return "How It Works";
  if (pathname.startsWith("/algorithms"))   return "Algorithms";
  if (pathname.startsWith("/cli"))          return "CLI Setup";
  return "QuantumShield";
}
