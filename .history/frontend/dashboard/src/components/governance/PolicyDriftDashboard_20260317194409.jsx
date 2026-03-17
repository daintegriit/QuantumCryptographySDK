import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

import Spinner from "../common/Spinner";
import EmptyState from "../common/EmptyState";

/**
 * PolicyDriftDashboard
 *
 * Goal:
 *  - Detect “silent decay” in governance posture over time
 *  - Surface drift in policy outcomes (allow/deny), rule pressure, and key-level friction
 *
 * Backend note:
 *  This component is route-resilient: it tries multiple endpoints until one succeeds.
 */
export default function PolicyDriftDashboard() {
  const { theme } = useTheme();

  const [data, setData] = useState(null);
  const [endpointUsed, setEndpointUsed] = useState(null);

  const [windowDays, setWindowDays] = useState(30);
  const [limitScan, setLimitScan] = useState(undefined);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ------------------------------------------------------------
  // Endpoint candidates
  // ------------------------------------------------------------
  const endpointCandidates = useMemo(() => {
    const base = "http://localhost:8008/api";
    return [
      `${base}/policy-drift`,          
      `${base}/policy-drift/status`,   
      `${base}/policy/drift`,
      `${base}/policy_drift`,
      `${base}/telemetry/policy_drift`,
      `${base}/governance/policy_drift`,
      `${base}/drift/policy`,
    ];
  }, []);

  // ------------------------------------------------------------
  // Load policy drift
  // ------------------------------------------------------------
  async function loadPolicyDrift({ silent = false } = {}) {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const qs = new URLSearchParams();
      // Primary (backend-correct)
      qs.set("baseline_days", String(windowDays));
      qs.set("recent_days", String(Math.max(7, Math.floor(windowDays / 4))));

      // Backward compatibility
      qs.set("window_days", String(windowDays));
      if (typeof limitScan === "number") {
        qs.set("limit_scan", String(limitScan));
      }

      let lastErr = null;

      for (const url of endpointCandidates) {
        try {
          const res = await fetch(`${url}?${qs.toString()}`);
          if (!res.ok) {
            lastErr = new Error(`HTTP ${res.status} at ${url}`);
            continue;
          }
          const json = await res.json();
          setData(json);
          setEndpointUsed(url);
          return;
        } catch (e) {
          lastErr = e;
        }
      }

      throw lastErr || new Error("No policy drift endpoint reachable.");
    } catch (err) {
      setData(null);
      setEndpointUsed(null);
      setError(err?.message || "Failed to load policy drift.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Initial + whenever window changes
  useEffect(() => {
    loadPolicyDrift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays, limitScan]);

  // Manual refresh
  async function onRefresh() {
    setRefreshing(true);
    await loadPolicyDrift({ silent: true });
    setRefreshing(false);
  }

  // ------------------------------------------------------------
  // Derived normalization (support multiple backend shapes)
  // ------------------------------------------------------------
  const normalized = useMemo(() => {
    const d = data || {};

    // Common fields we try to map
    const generatedAt =
      d.generated_at_utc ||
      d.generatedAtUtc ||
      d.generated_at ||
      d.timestamp_utc ||
      null;

    const window =
      d.window_days ??
      d.windowDays ??
      d.window ??
      windowDays;

    // Drift score 0..1 (or 0..100)
    let driftScore = d.drift_score ?? d.score ?? d.policy_drift_score ?? null;
    if (typeof driftScore === "number" && driftScore > 1.0) {
      // treat as percentage
      driftScore = Math.min(1, driftScore / 100);
    }

    const driftLevel =
      d.drift_level ||
      d.level ||
      d.severity ||
      (typeof driftScore === "number"
        ? driftScore >= 0.75
          ? "CRITICAL"
          : driftScore >= 0.45
            ? "ELEVATED"
            : "STABLE"
        : "UNKNOWN");

    // Headline explanation / summary
    const summary =
      d.summary ||
      d.executive_summary ||
      d.message ||
      null;

    // Outcome deltas
    const allowNow = d.allow_now ?? d.policy_allow_now ?? d.allowed_now ?? d.allow ?? null;
    const denyNow = d.deny_now ?? d.policy_deny_now ?? d.denied_now ?? d.deny ?? null;
    const allowPrev = d.allow_prev ?? d.policy_allow_prev ?? d.allowed_prev ?? null;
    const denyPrev = d.deny_prev ?? d.policy_deny_prev ?? d.denied_prev ?? null;

    // Pressure / top drivers
    const topDrivers =
      d.top_drivers ||
      d.drivers ||
      d.rule_pressure ||
      d.top_rules ||
      [];

    // Key friction / hotspots
    const keyHotspots =
      d.key_hotspots ||
      d.hot_keys ||
      d.keys ||
      [];

    // Timeseries (optional)
    const series =
      d.series ||
      d.timeseries ||
      d.drift_series ||
      [];

    return {
      generatedAt,
      window,
      driftScore,
      driftLevel,
      summary,
      allowNow,
      denyNow,
      allowPrev,
      denyPrev,
      topDrivers,
      keyHotspots,
      series,
    };
  }, [data, windowDays]);

  // ------------------------------------------------------------
  // States
  // ------------------------------------------------------------
  if (loading) {
    return (
      <div className={`${theme.panel} p-6 rounded-xl`}>
        <Spinner label="Computing policy drift intelligence…" />
      </div>
    );
  }

  if (error && error.includes("404")) {
    return (
      <PostureBanner
        theme={theme}
        level="UNKNOWN"
        score={null}
        summary="Policy drift engine is deployed but not yet producing sufficient audit data."
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No Policy Drift Data"
        description="No audit-derived drift signals are available yet. Generate keys, run policy checks, or run simulations to produce events."
      />
    );
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.panelTitle}`}>
            📉 Policy Drift Dashboard
          </h2>
          <p className={theme.mutedText}>
            Detects silent governance decay: rising denials, rule pressure, and compliance friction over time.
          </p>

          {endpointUsed && (
            <div className="mt-2 text-xs text-gray-500">
              Source: <span className="font-mono break-all">{endpointUsed}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <ControlPill label="Window (days)">
            <select
              className={`${theme.select || "bg-black/20 border border-gray-800"} text-sm rounded-md px-3 py-2`}
              value={windowDays}
              onChange={(e) => setWindowDays(parseInt(e.target.value, 10))}
            >
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
              <option value={180}>180</option>
              <option value={365}>365</option>
            </select>
          </ControlPill>

          <ControlPill label="Scan limit (optional)">
            <input
              className={`${theme.input || "bg-black/20 border border-gray-800"} text-sm rounded-md px-3 py-2 w-40`}
              placeholder="e.g. 2000"
              inputMode="numeric"
              value={limitScan ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (!v) return setLimitScan(undefined);
                const n = Number(v);
                if (!Number.isFinite(n)) return;
                setLimitScan(Math.max(1, Math.floor(n)));
              }}
            />
          </ControlPill>

          <button
            onClick={onRefresh}
            className={`${theme.buttonSecondary || "bg-cyan-500/10 text-cyan-400"} text-sm px-4 py-2 rounded-md hover:opacity-90 transition disabled:opacity-50`}
            disabled={refreshing}
            title="Refresh policy drift"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ============================= */}
      {/* Executive Banner */}
      {/* ============================= */}
      <PostureBanner
        theme={theme}
        level={normalized.driftLevel}
        score={normalized.driftScore}
        summary={normalized.summary}
      />

      {/* ============================= */}
      {/* KPI Grid */}
      {/* ============================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          theme={theme}
          title="Drift Level"
          value={normalized.driftLevel || "UNKNOWN"}
          subtitle={`Window: ${normalized.window} days`}
          badgeType={levelToBadge(normalized.driftLevel)}
        />

        <KpiCard
          theme={theme}
          title="Drift Score"
          value={
            typeof normalized.driftScore === "number"
              ? `${Math.round(normalized.driftScore * 100)}%`
              : "N/A"
          }
          subtitle="Audit-derived confidence signal"
          badgeType={
            typeof normalized.driftScore === "number"
              ? normalized.driftScore >= 0.75
                ? "danger"
                : normalized.driftScore >= 0.45
                  ? "warn"
                  : "ok"
              : "neutral"
          }
        />

        <KpiCard
          theme={theme}
          title="Policy Allows (Now)"
          value={safeNum(normalized.allowNow)}
          subtitle={
            normalized.allowPrev != null
              ? `Prev: ${safeNum(normalized.allowPrev)}`
              : "Prev: N/A"
          }
          badgeType="ok"
        />

        <KpiCard
          theme={theme}
          title="Policy Denies (Now)"
          value={safeNum(normalized.denyNow)}
          subtitle={
            normalized.denyPrev != null
              ? `Prev: ${safeNum(normalized.denyPrev)}`
              : "Prev: N/A"
          }
          badgeType={
            normalized.denyNow != null && normalized.denyNow > 0 ? "danger" : "neutral"
          }
        />
      </div>

      {/* ============================= */}
      {/* Drivers + Hotspots */}
      {/* ============================= */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel theme={theme} title="🔥 Top Drift Drivers" subtitle="Rules or signals contributing most to drift pressure">
          <DriversList theme={theme} drivers={normalized.topDrivers} />
        </Panel>

        <Panel theme={theme} title="🧩 Key Hotspots" subtitle="Keys showing the most governance friction (denials, early rotations, or repeated enforcement)">
          <KeyHotspotsList theme={theme} items={normalized.keyHotspots} />
        </Panel>
      </div>

      {/* ============================= */}
      {/* Optional Timeseries */}
      {/* ============================= */}
      <Panel theme={theme} title="📈 Drift Trend" subtitle="Optional time-series if your backend emits it">
        <TrendMiniChart theme={theme} series={normalized.series} />
      </Panel>

      {/* ============================= */}
      {/* Footer */}
      {/* ============================= */}
      <div className="text-xs text-gray-500">
        Generated:{" "}
        <span className="font-mono">
          {normalized.generatedAt ? new Date(normalized.generatedAt).toLocaleString() : "N/A"}
        </span>
      </div>
    </div>
  );
}

/* =====================================================================================
   Components
===================================================================================== */

function ControlPill({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </div>
  );
}

function Panel({ theme, title, subtitle, children }) {
  return (
    <div className={`${theme.panel} p-6 rounded-xl`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className={`font-semibold ${theme.panelTitle}`}>{title}</h3>
          {subtitle && <p className={`${theme.mutedText} text-sm mt-1`}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function PostureBanner({ theme, level, score, summary }) {
  const cfg = postureConfig(level);
  const scoreTxt = typeof score === "number" ? `${Math.round(score * 100)}%` : "N/A";

  return (
    <div className={`p-5 rounded-xl border ${cfg.border} ${cfg.bg}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className={`text-sm font-semibold ${cfg.text}`}>
            {cfg.icon} {cfg.title}
          </div>
          <div className={`${theme.mutedText} text-sm mt-1`}>
            {summary || cfg.defaultSummary}
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <Badge type={levelToBadge(level)} text={String(level || "UNKNOWN")} />
          <div className="text-xs text-gray-500">
            Drift Score: <span className="font-mono text-cyan-400">{scoreTxt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ theme, title, value, subtitle, badgeType = "neutral" }) {
  return (
    <div className={`${theme.panel} p-4 rounded-xl`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-400">{title}</div>
        <Badge type={badgeType} text={badgeLabel(badgeType)} />
      </div>

      <div className="text-3xl font-bold text-cyan-400 mt-2">
        {value}
      </div>

      <div className={`text-xs ${theme.mutedText} mt-1`}>
        {subtitle}
      </div>
    </div>
  );
}

function DriversList({ theme, drivers }) {
  if (!drivers || (Array.isArray(drivers) && drivers.length === 0)) {
    return <p className={theme.mutedText}>No drift drivers available yet.</p>;
  }

  // Support array of strings OR objects
  const list = Array.isArray(drivers) ? drivers : [];

  return (
    <div className="space-y-3">
      {list.slice(0, 10).map((d, idx) => {
        const name =
          typeof d === "string"
            ? d
            : d?.rule || d?.name || d?.id || `Driver ${idx + 1}`;

        const pressure =
          typeof d === "object"
            ? d?.pressure ?? d?.score ?? d?.weight ?? null
            : null;

        const severity =
          typeof d === "object"
            ? d?.severity || d?.level || null
            : null;

        return (
          <div key={idx} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className={`text-sm ${theme.panelText} truncate`}>{name}</div>
              <div className="text-xs text-gray-500">
                {severity ? `Severity: ${severity}` : "Severity: N/A"}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-cyan-400 text-sm">
                {pressure != null && Number.isFinite(Number(pressure))
                  ? Number(pressure).toFixed(2)
                  : "—"}
              </span>
              <div className="w-28 h-2 rounded bg-black/30 border border-gray-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-500/60"
                  style={{
                    width: pressureToPct(pressure),
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KeyHotspotsList({ theme, items }) {
  if (!items || (Array.isArray(items) && items.length === 0)) {
    return <p className={theme.mutedText}>No hotspot keys detected.</p>;
  }

  const list = Array.isArray(items) ? items : [];

  return (
    <div className="space-y-3">
      {list.slice(0, 10).map((k, idx) => {
        const keyId =
          typeof k === "string"
            ? k
            : k?.key_id || k?.id || k?.keyId || `Key ${idx + 1}`;

        const denies =
          typeof k === "object"
            ? k?.policy_denials ?? k?.denies ?? k?.deny_count ?? null
            : null;

        const rotations =
          typeof k === "object"
            ? k?.rotations ?? k?.rotate_count ?? null
            : null;

        const migrations =
          typeof k === "object"
            ? k?.migrations ?? k?.migrate_count ?? null
            : null;

        const label = shortId(keyId);

        return (
          <div key={idx} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-cyan-400 text-sm truncate">{label}</div>
              <div className="text-xs text-gray-500 truncate">{keyId}</div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <MiniStat label="denies" value={denies} />
              <MiniStat label="rot" value={rotations} />
              <MiniStat label="mig" value={migrations} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <span className="px-2 py-1 rounded border border-gray-800 bg-black/20 text-gray-300">
      <span className="text-gray-500">{label}:</span>{" "}
      <span className="font-mono text-cyan-400">{safeNum(value)}</span>
    </span>
  );
}

function TrendMiniChart({ theme, series }) {
  if (!series || !Array.isArray(series) || series.length < 2) {
    return <p className={theme.mutedText}>No trend series provided by backend (optional).</p>;
  }

  // Expect points like {t: "...", score: 0.1} or {timestamp_utc:"", drift_score:...}
  const points = series
    .map((p) => {
      const t = p.t || p.time || p.timestamp || p.timestamp_utc || p.generated_at_utc || null;
      let s = p.score ?? p.drift_score ?? p.value ?? null;
      if (typeof s === "number" && s > 1) s = s / 100;
      if (!Number.isFinite(Number(s))) s = null;
      return { t, s };
    })
    .filter((p) => p.s != null);

  if (points.length < 2) {
    return <p className={theme.mutedText}>Trend series present but not in a recognized format.</p>;
  }

  // Build a simple bar sparkline (no chart libs)
  const max = Math.max(...points.map((p) => p.s));
  const min = Math.min(...points.map((p) => p.s));

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-24">
        {points.slice(-40).map((p, idx) => {
          const h = max === 0 ? 0 : Math.round((p.s / max) * 100);
          return (
            <div
              key={idx}
              className="flex-1 bg-cyan-500/30 border border-cyan-500/20 rounded-sm"
              style={{ height: `${Math.max(6, h)}%` }}
              title={`${p.t || "t"} → ${Math.round(p.s * 100)}%`}
            />
          );
        })}
      </div>

      <div className="text-xs text-gray-500 flex items-center justify-between">
        <span>
          Min: <span className="font-mono text-cyan-400">{Math.round(min * 100)}%</span>
        </span>
        <span>
          Max: <span className="font-mono text-cyan-400">{Math.round(max * 100)}%</span>
        </span>
        <span>
          Points: <span className="font-mono text-cyan-400">{points.length}</span>
        </span>
      </div>
    </div>
  );
}

/* =====================================================================================
   Utilities
===================================================================================== */

function Badge({ type = "neutral", text }) {
  const map = {
    neutral: "bg-gray-500/10 text-gray-300 border-gray-600/40",
    ok: "bg-green-500/10 text-green-400 border-green-500/30",
    warn: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    danger: "bg-red-500/10 text-red-400 border-red-500/30",
    info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-xs border ${map[type] || map.neutral}`}>
      {text}
    </span>
  );
}

function safeNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function shortId(id) {
  if (!id || typeof id !== "string") return "unknown";
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`;
}

function pressureToPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "15%";
  // normalize: accept 0..1 or 0..100-ish
  let x = n;
  if (x > 1) x = Math.min(1, x / 100);
  x = Math.max(0, Math.min(1, x));
  return `${Math.round(x * 100)}%`;
}

function badgeLabel(type) {
  const map = {
    neutral: "INFO",
    ok: "OK",
    warn: "WATCH",
    danger: "ALERT",
    info: "INFO",
  };
  return map[type] || "INFO";
}

function levelToBadge(level) {
  const l = String(level || "").toUpperCase();
  if (l.includes("CRIT") || l.includes("EMERG") || l.includes("SEVERE")) return "danger";
  if (l.includes("ELEV") || l.includes("WARN") || l.includes("WATCH")) return "warn";
  if (l.includes("STABLE") || l.includes("NORMAL") || l.includes("OK")) return "ok";
  return "neutral";
}

function postureConfig(level) {
  const l = String(level || "").toUpperCase();

  if (l.includes("CRIT") || l.includes("EMERG") || l.includes("SEVERE")) {
    return {
      title: "Critical Drift Detected",
      icon: "🚨",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-400",
      defaultSummary:
        "Governance posture is actively deteriorating. Prioritize policy remediation and key lifecycle enforcement.",
    };
  }

  if (l.includes("ELEV") || l.includes("WARN") || l.includes("WATCH")) {
    return {
      title: "Elevated Drift Pressure",
      icon: "⚠️",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      text: "text-yellow-400",
      defaultSummary:
        "Drift pressure is rising. Review drivers and hotspot keys before the posture degrades into enforcement failures.",
    };
  }

  if (l.includes("STABLE") || l.includes("NORMAL") || l.includes("OK")) {
    return {
      title: "Stable Governance Posture",
      icon: "✅",
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      text: "text-green-400",
      defaultSummary:
        "No meaningful drift detected. Continue monitoring and maintain consistent key lifecycle hygiene.",
    };
  }

  return {
    title: "Drift Status Unknown",
    icon: "🧭",
    bg: "bg-gray-500/10",
    border: "border-gray-600/40",
    text: "text-gray-300",
    defaultSummary:
      "Backend returned an unexpected schema or insufficient data. Generate more audit events and retry.",
  };
}