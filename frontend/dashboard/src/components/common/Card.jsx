// src/components/common/Card.jsx
import { useTheme } from "../../context/ThemeContext";

/**
 * Card
 *
 * Core layout primitive for all dashboard panels.
 *
 * Design goals:
 * - Theme-aware
 * - Deterministic
 * - Audit-safe
 * - Zero business logic
 *
 * Used across:
 * - SystemPosturePanel
 * - RiskSummary
 * - GovernanceOverview
 * - TelemetryDashboard
 */
export default function Card({ children, className = "" }) {
  const { theme } = useTheme();

  return (
    <div className={`${theme.panel} p-6 rounded-xl ${className}`}>
      {children}
    </div>
  );
}