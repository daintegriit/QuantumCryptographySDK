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
  "/":            <FaHome />,
  "/crypto":      <FaLock />,
  "/algorithms":  <FaMicrochip />,
  "/cli":         <FaTerminal />,
  "/how-it-works":<FaQuestionCircle />,
  "/governance":  <FaShieldAlt />,
  "/keys":        <FaKey />,
  "/risk":        <FaExclamationTriangle />,
  "/simulation":  <FaFlask />,
  "/telemetry":   <FaChartBar />,
  "/audit":       <FaScroll />,
  "/metrics":     <FaChartLine />,
  "/anomalies":   <FaBug />,
  "/explain":     <FaLightbulb />,
  "/admin":       <FaBolt />,
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
    <aside className={`${theme.panel} w-64 h-full border-r border-gray-800 flex flex-col`}>
      <div className="px-6 py-5 border-b border-gray-800 space-y-3">
        <div>
          <div className={`text-lg font-bold flex items-center gap-2 ${theme.panelTitle}`}>
            <FaShieldAlt className="text-cyan-400" /> QuantumShield
          </div>
          <div className="text-xs text-gray-400 mt-1">Cryptographic Governance Console</div>
        </div>
        <div className="text-xs rounded-md border border-cyan-500/20 p-3">
          {activeKey ? (
            <div className="space-y-1">
              <div className="text-green-400 font-semibold flex items-center gap-1.5">
                <FaCheckCircle className="text-xs" /> Active Key
              </div>
              <div className="font-mono text-cyan-300 truncate">{activeKey.key_id}</div>
              <div className="text-gray-400">{activeKey.algorithm}</div>
            </div>
          ) : (
            <div className="text-yellow-400 flex items-center gap-1.5">
              <FaExclamationTriangle className="text-xs" /> No Active Key
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="text-xs uppercase tracking-wide text-gray-500 px-2 mb-2">{section.title}</div>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-md text-sm transition ${
                        isActive    ? "bg-cyan-500/15 text-cyan-400 font-medium" :
                        item.admin  ? "text-purple-400 hover:bg-purple-500/10" :
                        item.critical ? "text-red-400 hover:bg-red-500/10" :
                        "text-gray-300 hover:bg-gray-800/60 hover:text-white"
                      }`
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs opacity-70">{NAV_ICONS[item.path]}</span>
                      {item.label}
                    </span>
                    {item.badge > 0 && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-mono">
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

      <div className="px-6 py-4 border-t border-gray-800 text-xs text-gray-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FaCog className="text-xs" />
          {import.meta.env.MODE === "production" ? "Production" : "Local"}
        </div>
        <div>v2.0.0</div>
      </div>
    </aside>
  );
}
