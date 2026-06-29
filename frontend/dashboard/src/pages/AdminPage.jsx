import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost } from "../services/apiClient";
import { FaUsers, FaKey, FaChartBar, FaShieldAlt, FaDatabase, FaScroll, FaCheckCircle, FaTimesCircle, FaSpinner, FaBrain, FaRobot } from "react-icons/fa";

const TABS = [
  { id: "users",      label: "Users",           icon: <FaUsers /> },
  { id: "keystores",  label: "Keystores",       icon: <FaKey /> },
  { id: "telemetry",  label: "Telemetry",       icon: <FaChartBar /> },
  { id: "audit",      label: "Audit Log",       icon: <FaScroll /> },
  { id: "algorithms", label: "Algorithm Stats", icon: <FaShieldAlt /> },
  { id: "health",     label: "System Health",   icon: <FaDatabase /> },
  { id: "ai",         label: "AI Intelligence", icon: <FaBrain /> },
];

const panel  = { background: "var(--panel)",    border: "1px solid var(--border)" };
const input  = { background: "var(--input-bg)", border: "1px solid var(--border)" };

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("users");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchTab(tab); }, [tab]);

  async function fetchTab(t) {
    setLoading(true); setError(null);
    try {
      const endpoints = {
        users: "/api/admin/users", keystores: "/api/admin/keystores",
        telemetry: "/api/admin/telemetry", audit: "/api/admin/audit",
        algorithms: "/api/admin/algorithms/stats", health: "/api/admin/health",
      };
      const res = await apiGet(endpoints[t]);
      setData(d => ({ ...d, [t]: res }));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function toggleUser(userId, isActive) {
    await apiPost(`/api/admin/users/${userId}/${isActive ? "disable" : "enable"}`, {});
    fetchTab("users");
  }

  async function toggleAdmin(userId) {
    await apiPost(`/api/admin/users/${userId}/toggle_admin`, {});
    fetchTab("users");
  }

  if (!user?.is_admin) return (
    <div className="p-8 text-center text-red-400 flex items-center justify-center gap-2">
      <FaShieldAlt /> Admin access required
    </div>
  );

  const d = data[tab];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaShieldAlt style={{ color: "var(--accent)" }} /> Admin Panel
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>System management — admin only</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            style={{
              background: tab === t.id ? "var(--accent-subtle, rgba(6,182,212,0.15))" : "transparent",
              color: tab === t.id ? "var(--accent)" : "var(--text-muted)",
              border: tab === t.id ? "1px solid var(--accent)" : "1px solid var(--border)",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-red-400 text-sm rounded-lg p-3" style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>{error}</div>}
      {loading && <div className="text-sm flex items-center gap-2 animate-pulse" style={{ color: "var(--accent)" }}><FaSpinner className="animate-spin" /> Loading...</div>}

      {/* Users */}
      {tab === "users" && d && (
        <div className="space-y-3">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{d.total} users total</div>
          {d.users?.map(u => (
            <div key={u.user_id} className="rounded-xl p-4 flex items-center justify-between gap-4" style={panel}>
              <div className="flex items-center gap-3">
                {u.avatar_url
                  ? <img src={u.avatar_url} className="w-9 h-9 rounded-full" alt={u.name} />
                  : <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>{u.name?.[0]}</div>
                }
                <div>
                  <div className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    {u.name}
                    {u.is_admin && <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--accent)", background: "var(--accent-subtle)" }}>Admin</span>}
                    {!u.is_active && <span className="text-xs px-1.5 py-0.5 rounded text-red-400" style={{ background: "rgba(239,68,68,0.1)" }}>Disabled</span>}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {u.key_count} keys · Last login: {new Date(u.last_login).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => toggleAdmin(u.user_id)}
                  className="text-xs px-2 py-1 rounded transition"
                  style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border)" }}>
                  {u.is_admin ? "Revoke Admin" : "Make Admin"}
                </button>
                <button onClick={() => toggleUser(u.user_id, u.is_active)}
                  className="text-xs px-2 py-1 rounded transition"
                  style={{ background: u.is_active ? "rgba(239,68,68,0.1)" : "rgba(74,222,128,0.1)", color: u.is_active ? "#f87171" : "#4ade80", border: "1px solid var(--border)" }}>
                  {u.is_active ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Keystores */}
      {tab === "keystores" && d && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[["Total Users", d.total_users], ["Total Keys", d.total_keys],
              ["Avg Keys/User", d.total_users ? (d.total_keys / d.total_users).toFixed(1) : 0]].map(([label, val]) => (
              <div key={label} className="rounded-xl p-4" style={panel}>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
                <div className="text-2xl font-semibold mt-1" style={{ color: "var(--accent)" }}>{val}</div>
              </div>
            ))}
          </div>
          {d.users?.map(u => (
            <div key={u.user_id} className="rounded-xl p-4" style={panel}>
              <div className="flex justify-between items-center">
                <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{u.user_id}</div>
                <div className="text-sm font-medium" style={{ color: "var(--accent)" }}>{u.key_count} keys</div>
              </div>
              <div className="flex gap-2 flex-wrap mt-2">
                {Object.entries(u.algorithms || {}).map(([alg, count]) => (
                  <span key={alg} className="text-xs px-2 py-0.5 rounded" style={input}>
                    <span style={{ color: "var(--text-primary)" }}>{alg}:</span> <span style={{ color: "var(--accent)" }}>{count}</span>
                  </span>
                ))}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Avg risk: {u.avg_risk_score}</div>
            </div>
          ))}
        </div>
      )}

      {/* Telemetry */}
      {tab === "telemetry" && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(d.events_by_type || {}).map(([type, count]) => (
              <div key={type} className="rounded-xl p-4" style={panel}>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{type}</div>
                <div className="text-xl font-semibold mt-1" style={{ color: "var(--accent)" }}>{count}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Recent Events</div>
            {d.recent_events?.map((e, i) => (
              <div key={i} className="rounded-lg p-3 flex justify-between text-xs" style={panel}>
                <div>
                  <span style={{ color: "var(--accent)" }}>{e.event_type}</span>
                  <span className="ml-2" style={{ color: "var(--text-muted)" }}>{e.scheme}/{e.parameter_set}</span>
                </div>
                <div className="font-mono" style={{ color: "var(--text-muted)" }}>{e.user_id?.slice(0, 8)}...</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit */}
      {tab === "audit" && d && (
        <div className="space-y-2">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{d.total} total events</div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {d.events?.map((e, i) => (
              <div key={i} className="rounded-lg p-3 text-xs font-mono" style={panel}>
                <div className="flex justify-between">
                  <span style={{ color: "var(--accent)" }}>{e.event_type}</span>
                  <span style={{ color: "var(--text-muted)" }}>{e.timestamp?.slice(0, 19)}</span>
                </div>
                <div className="mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {e.scheme} · {e.parameter_set} · user: {e.user_id?.slice(0, 8)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Algorithm Stats */}
      {tab === "algorithms" && d && (
        <div className="space-y-4">
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Total keys: <span className="font-medium" style={{ color: "var(--text-primary)" }}>{d.total_keys}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[["By Algorithm", d.by_algorithm], ["By Parameter Set", d.by_parameter_set],
              ["By Key Type", d.by_key_type], ["By Security Level", d.by_security_level]].map(([title, obj]) => (
              <div key={title} className="rounded-xl p-4" style={panel}>
                <div className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>{title}</div>
                {Object.entries(obj || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span className="font-mono" style={{ color: "var(--text-primary)" }}>{k}</span>
                    <span className="font-medium" style={{ color: "var(--accent)" }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Intelligence */}
      {tab === "ai" && <AIIntelligenceTab />}

      {/* System Health */}
      {tab === "health" && d && (
        <div className="space-y-4">
          {[
            ["Database", d.database, d.database?.status === "connected"],
            ["Keystore", d.keystore, d.keystore?.status === "mounted"],
            ["liboqs",   d.liboqs,   true],
            ["Disk",     d.disk,     d.disk?.used_pct <= 80],
          ].map(([title, info, ok]) => (
            <div key={title} className="rounded-xl p-4" style={panel}>
              <div className="text-sm font-medium mb-2 flex items-center gap-2"
                style={{ color: ok ? "#4ade80" : "#f87171" }}>
                {ok ? <FaCheckCircle className="text-xs" /> : <FaTimesCircle className="text-xs" />} {title}
              </div>
              <div className="space-y-1">
                {Object.entries(info || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span style={{ color: "var(--text-muted)" }}>{k}</span>
                    <span className="font-mono" style={{ color: "var(--text-primary)" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AIIntelligenceTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await apiGet("/api/anomalies/ai-scan");
      setData(res);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center gap-3 p-4" style={{ color: "var(--text-muted)" }}>
      <FaSpinner className="animate-spin" style={{ color: "var(--accent)" }} /> Loading AI scan…
    </div>
  );

  if (error) return (
    <div className="p-4 rounded-xl text-red-400" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>{error}</div>
  );

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Model Info */}
      <div className="p-5 rounded-xl" style={{ background: "var(--panel)", border: "1px solid rgba(167,139,250,0.3)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FaRobot style={{ color: "#a78bfa" }} /> Isolation Forest Model — Live Status
          </h3>
          <button onClick={() => { setRefreshing(true); load(true); }} disabled={refreshing}
            className="text-xs px-3 py-1.5 rounded transition flex items-center gap-1.5"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border)" }}>
            <FaShieldAlt className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Scanning…" : "Rescan"}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ["Status",          data.status === "ok" ? "Trained · Active" : "Awaiting Data"],
            ["Events Trained",  data.model_trained ?? "—"],
            ["Events Scanned",  data.total_scanned ?? "—"],
            ["Anomaly Rate",    data.anomaly_rate != null ? `${(data.anomaly_rate * 100).toFixed(1)}%` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="p-3 rounded-xl" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
              <div className="font-semibold mt-1" style={{ color: "#a78bfa" }}>{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Features: event_type · scheme · policy_result · duration_ms · Auto-retrains every 100 new events
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Last scan: {data.scanned_at ? new Date(data.scanned_at).toLocaleString() : "—"}
        </div>
      </div>

      {/* Anomalies found */}
      <div className="p-5 rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <FaBrain style={{ color: "var(--accent)" }} />
          Anomalies Detected ({data.anomalies_found ?? 0})
        </h3>
        {!data.anomalies?.length ? (
          <p className="text-sm flex items-center gap-2 text-green-400">
            <FaCheckCircle /> No anomalies detected in current scan window.
          </p>
        ) : (
          <div className="space-y-2">
            {data.anomalies.map((a, idx) => (
              <div key={idx} className="p-3 rounded-xl text-xs font-mono flex items-start justify-between gap-4"
                style={{ background: "var(--input-bg)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#f87171" }}>{a.reason}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                      score: {a.score}
                    </span>
                  </div>
                  <div style={{ color: "var(--text-muted)" }}>
                    {a.event_type} · scheme: <span style={{ color: "var(--accent)" }}>{a.scheme}</span>
                    · policy: {a.policy_result}
                    · duration: {a.duration_ms}ms
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
