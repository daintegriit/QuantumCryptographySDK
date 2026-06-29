// src/pages/AdminPage.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost } from "../services/apiClient";
import { FaUsers, FaKey, FaChartBar, FaShieldAlt, FaDatabase, FaScroll } from "react-icons/fa";

const TABS = [
  { id: "users",      label: "Users",           icon: <FaUsers /> },
  { id: "keystores",  label: "Keystores",       icon: <FaKey /> },
  { id: "telemetry",  label: "Telemetry",       icon: <FaChartBar /> },
  { id: "audit",      label: "Audit Log",       icon: <FaScroll /> },
  { id: "algorithms", label: "Algorithm Stats", icon: <FaShieldAlt /> },
  { id: "health",     label: "System Health",   icon: <FaDatabase /> },
];

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
        users:      "/api/admin/users",
        keystores:  "/api/admin/keystores",
        telemetry:  "/api/admin/telemetry",
        audit:      "/api/admin/audit",
        algorithms: "/api/admin/algorithms/stats",
        health:     "/api/admin/health",
      };
      const res = await apiGet(endpoints[t]);
      setData(d => ({ ...d, [t]: res }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleUser(userId, isActive) {
    await apiPost(`/api/admin/users/${userId}/${isActive ? "disable" : "enable"}`, {});
    fetchTab("users");
  }

  async function toggleAdmin(userId) {
    await apiPost(`/api/admin/users/${userId}/toggle_admin`, {});
    fetchTab("users");
  }

  if (!user?.is_admin) {
    return (
      <div className="p-8 text-center text-red-400">
        Admin access required
      </div>
    );
  }

  const d = data[tab];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
        <p className="text-xs text-gray-400 mt-1">System management — admin only</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === t.id ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "text-gray-400 hover:bg-gray-800"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-red-400 text-sm border border-red-500/20 rounded-lg p-3">{error}</div>}
      {loading && <div className="text-cyan-400 text-sm animate-pulse">Loading...</div>}

      {/* ── Users ── */}
      {tab === "users" && d && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">{d.total} users total</div>
          {d.users?.map(u => (
            <div key={u.user_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {u.avatar_url
                  ? <img src={u.avatar_url} className="w-9 h-9 rounded-full" alt={u.name} />
                  : <div className="w-9 h-9 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">{u.name?.[0]}</div>
                }
                <div>
                  <div className="text-sm text-white font-medium flex items-center gap-2">
                    {u.name}
                    {u.is_admin && <span className="text-xs text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">Admin</span>}
                    {!u.is_active && <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Disabled</span>}
                  </div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {u.key_count} keys · Last login: {new Date(u.last_login).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => toggleAdmin(u.user_id)}
                  className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition">
                  {u.is_admin ? "Revoke Admin" : "Make Admin"}
                </button>
                <button onClick={() => toggleUser(u.user_id, u.is_active)}
                  className={`text-xs px-2 py-1 rounded transition ${u.is_active
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                  {u.is_active ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Keystores ── */}
      {tab === "keystores" && d && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[["Total Users", d.total_users], ["Total Keys", d.total_keys], ["Avg Keys/User", d.total_users ? (d.total_keys / d.total_users).toFixed(1) : 0]].map(([label, val]) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400">{label}</div>
                <div className="text-2xl font-semibold text-cyan-400 mt-1">{val}</div>
              </div>
            ))}
          </div>
          {d.users?.map(u => (
            <div key={u.user_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div className="font-mono text-xs text-gray-400">{u.user_id}</div>
                <div className="text-cyan-400 text-sm font-medium">{u.key_count} keys</div>
              </div>
              <div className="flex gap-2 flex-wrap mt-2">
                {Object.entries(u.algorithms || {}).map(([alg, count]) => (
                  <span key={alg} className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                    {alg}: {count}
                  </span>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">Avg risk: {u.avg_risk_score}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Telemetry ── */}
      {tab === "telemetry" && d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(d.events_by_type || {}).map(([type, count]) => (
              <div key={type} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400">{type}</div>
                <div className="text-xl font-semibold text-cyan-400 mt-1">{count}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Recent Events</div>
            {d.recent_events?.map((e, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex justify-between text-xs">
                <div>
                  <span className="text-cyan-400">{e.event_type}</span>
                  <span className="text-gray-500 ml-2">{e.scheme}/{e.parameter_set}</span>
                </div>
                <div className="text-gray-500 font-mono">{e.user_id?.slice(0, 8)}...</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Audit Log ── */}
      {tab === "audit" && d && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400">{d.total} total events</div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {d.events?.map((e, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-cyan-400">{e.event_type}</span>
                  <span className="text-gray-500">{e.timestamp?.slice(0, 19)}</span>
                </div>
                <div className="text-gray-400 mt-0.5">
                  {e.scheme} · {e.parameter_set} · user: {e.user_id?.slice(0, 8)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Algorithm Stats ── */}
      {tab === "algorithms" && d && (
        <div className="space-y-4">
          <div className="text-sm text-gray-400">Total keys: <span className="text-white font-medium">{d.total_keys}</span></div>
          <div className="grid grid-cols-2 gap-4">
            {[["By Algorithm", d.by_algorithm], ["By Parameter Set", d.by_parameter_set],
              ["By Key Type", d.by_key_type], ["By Security Level", d.by_security_level]].map(([title, obj]) => (
              <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">{title}</div>
                {Object.entries(obj || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-800 last:border-0">
                    <span className="text-gray-300 font-mono">{k}</span>
                    <span className="text-cyan-400 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── System Health ── */}
      {tab === "health" && d && (
        <div className="space-y-4">
          {[
            ["Database", d.database, d.database?.status === "connected" ? "green" : "red"],
            ["Keystore", d.keystore, d.keystore?.status === "mounted" ? "green" : "yellow"],
            ["liboqs", d.liboqs, "cyan"],
            ["Disk", d.disk, d.disk?.used_pct > 80 ? "yellow" : "green"],
          ].map(([title, info, color]) => (
            <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className={`text-sm font-medium text-${color}-400 mb-2`}>{title}</div>
              <div className="space-y-1">
                {Object.entries(info || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-gray-200 font-mono">{String(v)}</span>
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