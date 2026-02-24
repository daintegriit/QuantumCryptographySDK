import { useTheme } from "../../context/ThemeContext";

/**
 * SectionHeader
 *
 * Reusable section header for dashboard pages.
 *
 * - Deterministic
 * - Presentational only
 * - No side effects
 * - Executive / audit friendly
 *
 * Usage:
 * <SectionHeader
 *   title="Governance Overview"
 *   subtitle="System-wide cryptographic posture and compliance"
 *   icon="🏛️"
 * />
 */
export default function SectionHeader({
  title,
  subtitle,
  icon,
  right,
}) {
  const { theme } = useTheme();

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h2>

        {subtitle && (
          <p className={theme.mutedText}>{subtitle}</p>
        )}
      </div>

      {/* Optional right-side content (buttons, filters, etc.) */}
      {right && <div>{right}</div>}
    </div>
  );
}