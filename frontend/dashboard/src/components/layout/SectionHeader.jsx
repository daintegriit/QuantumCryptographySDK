export default function SectionHeader({ title, subtitle, icon, right }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          {icon && <span>{icon}</span>}
          {title}
        </h2>
        {subtitle && <p style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
