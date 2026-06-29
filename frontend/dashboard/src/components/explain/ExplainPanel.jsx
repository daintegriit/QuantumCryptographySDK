import { useEffect, useState } from "react";
import { apiGet } from "../../services/apiClient";

export default function ExplainPanel({ keyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!keyId) return;
    setLoading(true);
    setError(null);
    apiGet(`/api/keys/${keyId}/explain`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [keyId]);

  if (!keyId) return <div className="p-4 text-gray-400">Select a key to view explanation.</div>;
  if (loading) return <div className="p-4 text-gray-400 animate-pulse">Loading explanation...</div>;
  if (error) return <div className="p-4 text-red-400">Explanation Error: {error}</div>;
  if (!data) return null;

  const status = data.policy_status || (data.policy?.allowed ? "ALLOWED" : "BLOCKED");

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wide text-gray-400">Policy Status</span>
          <span className={`text-sm font-bold ${status === "ALLOWED" ? "text-green-400" : "text-red-400"}`}>
            {status}
          </span>
        </div>
        <div className="text-sm text-gray-300">{data.algorithm} / {data.parameter_set}</div>
        <div className="text-xs text-gray-500 mt-1">{data.security_level} · Risk: {(data.risk_score || 0).toFixed(2)}</div>
      </div>

      {(data.explanation || []).map((line, i) => (
        <div key={i} className="flex gap-3 text-sm bg-gray-800 rounded-lg p-3">
          <span className={`shrink-0 font-mono text-xs px-1.5 py-0.5 rounded ${
            line.level === "CRITICAL" ? "bg-red-500/20 text-red-400" :
            line.level === "WARN" ? "bg-yellow-500/20 text-yellow-400" :
            "bg-gray-500/20 text-gray-400"}`}>
            {line.level}
          </span>
          <span className="text-gray-300">{line.message}</span>
        </div>
      ))}

      {data.warnings?.length > 0 && (
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
          <div className="text-xs font-semibold text-yellow-400 mb-2">Warnings</div>
          {data.warnings.map((w, i) => <div key={i} className="text-xs text-yellow-300">• {w}</div>)}
        </div>
      )}

      {data.required_actions?.length > 0 && (
        <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
          <div className="text-xs font-semibold text-red-400 mb-2">Required Actions</div>
          {data.required_actions.map((a, i) => <div key={i} className="text-xs text-red-300 font-mono">• {a}</div>)}
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-4 text-xs text-gray-400">
        Profile: {data.profile} · NIST: {data.nist_standard || "FIPS 203/204/205"}
      </div>
    </div>
  );
}
