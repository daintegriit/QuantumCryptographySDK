import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useActiveKey } from "../../context/ActiveKeyContext";
import { fetchTelemetryMetrics } from "../../services/telemetryApi";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const { theme } = useTheme();
  const { activeKey } = useActiveKey(); // ✅ CONTEXT
  const [policyMetrics, setPolicyMetrics] = useState(null);

  /* =====================================================
   * Load policy metrics ONLY (key is reactive)
   * ===================================================== */
  useEffect(() => {
    fetchTelemetryMetrics()
      .then(setPolicyMetrics)
      .catch(() => setPolicyMetrics(null));
  }, []);

  const navSections = [
    {
      title: "Core",
      items: [
        { label: "Dashboard", path: "/"},
        { label: "Crypto Operations", path: "/crypto"},
      ],
    },
    {
      title: "Governance",
      items: [
        { label: "Governance Overview", path: "/governance" },
        { label: "Key Explorer", path: "/keys"},
        {
          label: "Risk Summary",
          path: "/risk",
          critical: true,
          badge: policyMetrics?.policy_deny || 0,
        },
        { label: "Simulations", path: "/simulation"},
      ],
    },
    {
      title: "Observability",
      items: [
        { label: "Telemetry", path: "/telemetry"},
        { label: "Audit Replay", path: "/audit"},
        { label: "Metrics", path: "/metrics"},
      ],
    },
    {
      title: "Intelligence",
      items: [
        {
          label: "Anomalies",
          path: "/anomalies",
          critical: true,
          badge: policyMetrics?.policy_deny || 0,
        },
        { label: "Explainability", path: "/explain" },
      ],
    },
  ];

  return (
    <aside className={`${theme.panel} w-64 h-full border-r border-gray-800 flex flex-col`}>
      {/* ================= HEADER ================= */}
      <div className="px-6 py-5 border-b border-gray-800 space-y-3">
        <div>
          <div className={`text-lg font-bold ${theme.panelTitle}`}>
            QuantumShield
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Cryptographic Governance Console
          </div>
        </div>

        {/* ===== Active Key Indicator (REACTIVE) ===== */}
        <div className="text-xs rounded-md border border-cyan-500/20 p-3">
          {activeKey ? (
            <div className="space-y-1">
              <div className="text-green-400 font-semibold">
                🔐 Active Key
              </div>
              <div className="font-mono text-cyan-300 truncate">
                {activeKey.key_id}
              </div>
              <div className="text-gray-400">
                {activeKey.algorithm}
              </div>
            </div>
          ) : (
            <div className="text-yellow-400">
              ⚠ No Active Key
            </div>
          )}
        </div>
      </div>

      {/* ================= NAV ================= */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="text-xs uppercase tracking-wide text-gray-500 px-2 mb-2">
              {section.title}
            </div>

            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end
                    className={({ isActive }) =>
                      `
                      flex items-center justify-between px-3 py-2 rounded-md text-sm transition
                      ${
                        isActive
                          ? "bg-cyan-500/15 text-cyan-400 font-medium"
                          : item.critical
                          ? "text-red-400 hover:bg-red-500/10"
                          : "text-gray-300 hover:bg-gray-800/60 hover:text-white"
                      }
                      `
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>

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

      {/* ================= FOOTER ================= */}
      <div className="px-6 py-4 border-t border-gray-800 text-xs text-gray-500">
        <div>Environment: Local</div>
        <div className="mt-1">Version: v0.1.0</div>
      </div>
    </aside>
  );
}