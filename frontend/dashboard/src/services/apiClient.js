// src/services/apiClient.js

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8008";

/* =====================================================
 * Core request helper
 * ===================================================== */

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    credentials: "include", // ✅ FIXED
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }

    throw new Error(
      `[API ERROR] ${res.status} ${res.statusText} :: ${path}\n${detail}`
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

/* =====================================================
 * HTTP verbs
 * ===================================================== */

export const apiGet = (path) => request(path, { method: "GET" });
export const apiPost = (path, body) =>
  request(path, { method: "POST", body: JSON.stringify(body) });

/* =====================================================
 * Domain APIs
 * ===================================================== */

// ---- Telemetry ----
export const TelemetryAPI = {
  system: () => apiGet("/api/telemetry/system"),
  metrics: () => apiGet("/api/telemetry/metrics"),
  key: (keyId) => apiGet(`/api/telemetry/keys/${keyId}`),
};

// ---- Keys ----
export const KeysAPI = {
  list: () => apiGet("/api/keys"),
  status: (keyId) => apiGet(`/api/keys/${keyId}/status`),
  migration: (keyId) => apiGet(`/api/keys/${keyId}/migration`),

  // NEW
  active: () => apiGet("/api/keys/active"),
  activate: (keyId) => apiPost(`/api/keys/${keyId}/activate`, {}),
  rotateActive: (force = false) => apiPost(`/api/keys/active/rotate?force=${force}`, {}),
  lifecycle: (keyId) => apiGet(`/api/keys/${keyId}/lifecycle`),
};

// ---- Governance ----
export const GovernanceAPI = {
  risk: () => apiGet("/api/governance/risk"),
};

// ---- Anomalies ----
export const AnomalyAPI = {
  summary: () => apiGet("/api/anomalies/summary"),
};

// ---- Replay / Audit ----
export const ReplayAPI = {
  keyTimeline: (keyId) => apiGet(`/api/replay/keys/${keyId}`),
};