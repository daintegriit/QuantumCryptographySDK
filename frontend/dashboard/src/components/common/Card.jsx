export default function Card({ children, className = "", highlight = false }) {
  return (
    <div className={`p-6 rounded-xl ${className}`}
      style={{ background: "var(--panel)", border: highlight ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
      {children}
    </div>
  );
}
