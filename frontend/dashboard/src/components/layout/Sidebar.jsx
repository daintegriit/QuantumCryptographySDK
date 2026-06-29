import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useActiveKey } from "../../context/ActiveKeyContext";
import { useAuth } from "../../context/AuthContext";
import { fetchTelemetryMetrics } from "../../services/telemetryApi";
import { useEffect, useState } from "react";
import {
  FaHome, FaLock, FaMicrochip, FaTerminal, FaQuestionCircle,
  FaShieldAlt, FaKey, FaExclamationTriangle, FaFlask,
  FaChartBar, FaScroll, FaChartLine, FaBug, FaLightbulb,
  FaBolt, FaCheckCircle, FaCog
} from "react-icons/fa";

const NAV_ICONS = {
  "/":             <FaHome />,
  "/crypto":       <FaLock />,
  "/algorithms":   <FaMicrochip />,
  "/cli":          <FaTerminal />,
  "/how-it-works": <FaQuestionCircle />,
  "/governance":   <FaShieldAlt />,
  "/keys":         <FaKey />,
  "/risk":         <FaExclamationTriangle />,
  "/simulation":   <FaFlask />,
  "/telemetry":    <FaChartBar />,
  "/audit":        <FaScroll />,
  "/metrics":      <FaChartLine />,
  "/anomalies":    <FaBug />,
  "/explain":      <FaLightbulb />,
  "/admin":        <FaBolt />,
};

export default function Sidebar() {
  const { theme } = useTheme();
  const { activeKey } = useActiveKey();
  const { user } = useAuth();
  const [policyMetrics, setPolicyMetrics] = useState(null);

  useEffect(() => {
    fetchTelemetryMetrics()
      .then(setPolicyMetrics)
      .catch(() => setPolicyMetrics(null));
  }, []);

  const navSections = [
    {
      title: "Core",
      items: [
        { label: "Dashboard",         path: "/" },
        { label: "Crypto Operations", path: "/crypto" },
        { label: "Algorithms",        path: "/algorithms" },
        { label: "CLI Setup",         path: "/cli" },
        { label: "How It Works",      path: "/how-it-works" },
      ],
    },
    {
      title: "Governance",
      items: [
        { label: "Governance Overview", path: "/governance" },
        { label: "Key Explorer",        path: "/keys" },
        { label: "Risk Summary",        path: "/risk",       critical: true, badge: policyMetrics?.policy_deny || 0 },
        { label: "Simulations",         path: "/simulation" },
      ],
    },
    {
      title: "Observability",
      items: [
        { label: "Telemetry",    path: "/telemetry" },
        { label: "Audit Replay", path: "/audit" },
        { label: "Metrics",      path: "/metrics" },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { label: "Anomalies",      path: "/anomalies", critical: true, badge: policyMetrics?.policy_deny || 0 },
        { label: "Explainability", path: "/explain" },
      ],
    },
    ...(user?.is_admin ? [{
      title: "Admin",
      items: [{ label: "Admin Panel", path: "/admin", admin: true }],
    }] : []),
  ];

  return (
      className="w-64 h-full flex flex-col"
      style={{ background: "var(--sidebar-bg, var(--panel))", borderRight: "1px solid var(--border)" }}>

      {/* Logo */}
      <div className="px-6 py-5 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FaShieldAlt style={{ color: "var(--accent)" }} /> QuantumShield
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--nav-muted, var(--text-muted))" }}>
            Cryptographic Governance Console
          </div>
        </div>

        {/* Active key */}
        <div className="text-xs rounded-md p-3" style={{ border: "1px solid var(--border)", background: "var(--accent-subtle, transparent)" }}>
          {activeKey ? (
            <div className="space-y-1">
              <div className="font-semibold flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                <FaCheckCircle className="text-xs" /> Active Key
              </div>
              <div className="font-mono truncate" style={{ color: "var(--text-primary)" }}>{activeKey.key_id}</div>
              <div style={{ color: "var(--text-muted)" }}>{activeKey.algorithm}</div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5" style={{ color: "#facc15" }}>
              <FaExclamationTriangle className="text-xs" /> No Active Key
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="text-xs uppercase tracking-wide px-2 mb-2"
              style={{ color: "var(--nav-muted, var(--text-muted))" }}>
              {section.title}
            </div>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === "/"}
                    className="flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all"
                    style={({ isActive }) => ({
                      background: isActive ? "var(--nav-active-bg)" : "transparent",
                      borderLeft: isActive ? `2px solid var(--nav-active-border)` : "2px solid transparent",
                      color: isActive
                        ? "var(--accent)"
                        : item.admin
                        ? "#a78bfa"
                        : item.critical
                        ? "#f87171"
                        : "var(--nav-text, var(--text-primary))",
                      paddingLeft: "10px",
                    })}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs opacity-70">{NAV_ICONS[item.path]}</span>
                      {item.label}
                    </span>
                    {item.badge > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                        style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 flex items-center justify-between text-xs"
        style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <div className="flex items-center gap-1.5">
          <FaCog className="text-xs" />
          {import.meta.env.MODE === "production" ? "Production" : "Local"}
        </div>
        <div>v2.0.0</div>
      </div>
    </aside>
  );
}
