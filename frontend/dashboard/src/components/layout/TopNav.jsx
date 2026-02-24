import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import ThemeSwitcher from "../ThemeSwitcher";

export default function TopNav() {
  const { theme } = useTheme();
  const location = useLocation();

  const [backendStatus, setBackendStatus] = useState("checking");

  // ------------------------------------
  // Health check (non-blocking)
  // ------------------------------------
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("http://localhost:8000/health");
        setBackendStatus(res.ok ? "online" : "degraded");
      } catch {
        setBackendStatus("offline");
      }
    }
    checkHealth();
  }, []);

  // ------------------------------------
  // Status indicator
  // ------------------------------------
  function StatusDot() {
    const map = {
      online: "bg-green-400",
      degraded: "bg-yellow-400",
      offline: "bg-red-500",
      checking: "bg-gray-400",
    };

    return (
      <span
        className={`w-2.5 h-2.5 rounded-full ${map[backendStatus]} animate-pulse`}
      />
    );
  }

  // ------------------------------------
  // Page title resolver (governance-aware)
  // ------------------------------------
  const pageTitle = resolveTitle(location.pathname);

  // ------------------------------------
  // UI
  // ------------------------------------
  return (
    <header
      className={`${theme.panel} border-b border-gray-800 px-6 py-4 flex items-center justify-between`}
    >
      {/* ================= LEFT ================= */}
      <div className="flex flex-col">
        <div className="flex items-center gap-4">
          <h1 className={`font-semibold tracking-wide ${theme.panelTitle}`}>
            {pageTitle}
          </h1>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <StatusDot />
            <span className="uppercase tracking-wide">
              Backend: {backendStatus}
            </span>
          </div>
        </div>

        <span className={`text-xs ${theme.mutedText}`}>
          QuantumShield Governance Console
        </span>
      </div>

      {/* ================= RIGHT ================= */}
      <div className="flex items-center gap-6">
        {/* Placeholder: AI Copilot Toggle */}
        <button
          className="text-xs px-3 py-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-50"
          title="AI Copilot (Coming Soon)"
          disabled
        >
          AI Copilot
        </button>

        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Placeholder: User / Role */}
        <div className="text-xs text-gray-400">
          <span className="font-medium text-gray-300">Role:</span> Admin
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function resolveTitle(pathname) {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/governance")) return "Governance Overview";
  if (pathname.startsWith("/keys")) return "Key Explorer";
  if (pathname.startsWith("/telemetry")) return "Telemetry & Metrics";
  if (pathname.startsWith("/replay")) return "Audit Replay";
  if (pathname.startsWith("/explain")) return "Key Explanation";
  if (pathname.startsWith("/anomalies")) return "Anomaly Detection";
  if (pathname.startsWith("/risk")) return "Risk Summary";

  return "QuantumShield";
}