import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import ThemeSwitcher from "../ThemeSwitcher";
import UserMenu from "./UserMenu";
import { useAuth } from "../../context/AuthContext";
import { apiGet } from "../../services/apiClient";

const PAGE_TITLES = {
  "/": "Dashboard", "/governance": "Governance Overview", "/keys": "Key Explorer",
  "/telemetry": "Telemetry & Metrics", "/replay": "Audit Replay", "/explain": "Key Explanation",
  "/anomalies": "Anomaly Detection", "/risk": "Risk Summary", "/simulation": "Simulation",
  "/crypto": "Crypto Operations", "/audit": "Audit Trail", "/metrics": "Metrics",
  "/how-it-works": "How It Works", "/algorithms": "Algorithms", "/cli": "CLI Setup", "/admin": "Admin Panel",
};

function resolveTitle(pathname) {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path === "/" ? pathname === "/" || pathname.startsWith("/dashboard") : pathname.startsWith(path)) return title;
  }
  return "QuantumShield";
}

export default function TopNav() {
  const { themeName } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    async function checkHealth() {
      try { await apiGet("/health"); setBackendStatus("online"); }
      catch { setBackendStatus("offline"); }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = { online: "#4ade80", degraded: "#facc15", offline: "#f87171", checking: "var(--text-muted)" };
  const pageTitle = resolveTitle(location.pathname);

  return (
    <header className="px-6 py-3 flex items-center justify-between gap-4 shrink-0"
      style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold tracking-wide text-sm truncate" style={{ color: "var(--text-primary)" }}>{pageTitle}</h1>
          <div className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: statusColor[backendStatus] }} />
            <span className="uppercase tracking-wide font-medium">BACKEND: {backendStatus}</span>
          </div>
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>QuantumShield Governance Console</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button className="text-xs px-3 py-1.5 rounded-md transition whitespace-nowrap disabled:opacity-40"
          style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }} disabled>
          AI Copilot
        </button>
        <ThemeSwitcher />
        <div className="w-px h-5" style={{ background: "var(--border)" }} />
        {user ? <UserMenu /> : <div className="text-xs" style={{ color: "var(--text-muted)" }}><span style={{ color: "var(--text-primary)" }}>Role:</span> Admin</div>}
      </div>
    </header>
  );
}
