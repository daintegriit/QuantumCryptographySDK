const STATUS = {
  neutral: { color: "var(--accent)",  border: "var(--border)" },
  ok:      { color: "#4ade80",        border: "rgba(74,222,128,0.3)" },
  warn:    { color: "#facc15",        border: "rgba(250,204,21,0.3)" },
  danger:  { color: "#f87171",        border: "rgba(239,68,68,0.3)" },
};

export default function MetricCards({ metrics }) {
  if (!metrics?.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {metrics.map((m, idx) => {
        const s = STATUS[m.status] || STATUS.neutral;
        return (
          <div key={idx} className="p-4 rounded-xl" style={{ background: "var(--panel)", border: `1px solid ${s.border}` }}>
            <div className="text-xs flex items-center gap-1.5 mb-1" style={{ color: "var(--text-muted)" }}>
              {m.icon && <span style={{ color: s.color }}>{m.icon}</span>}
              {m.label}
            </div>
            <div className="text-3xl font-bold" style={{ color: s.color }}>{m.value}</div>
            {m.subtitle && <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{m.subtitle}</div>}
          </div>
        );
      })}
    </div>
  );
}
