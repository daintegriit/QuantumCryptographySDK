// src/services/anomalyApi.js

/**
 * anomalyApi
 *
 * Deterministic anomaly access layer.
 *
 * Design goals:
 * - Read-only
 * - Explicit exports
 * - No UI logic
 * - Rollup-safe
 * - Audit-friendly
 */

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8008";

/* =====================================================
 * Helper
 * ===================================================== */

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
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
      `[AnomalyAPI] ${res.status} ${res.statusText} :: ${path}\n${detail}`
    );
  }

  return res.json();
}

/* =====================================================
 * Exports (USED BY UI)
 * ===================================================== */

/**
 * Fetch anomaly summary (system-wide)
 */
export function fetchAnomalySummary() {
  return apiGet("/api/anomalies/summary");
}

/**
 * Fetch anomalies for a specific key
 */
export function fetchKeyAnomaly(keyId) {
  if (!keyId) {
    throw new Error("fetchKeyAnomaly requires keyId");
  }

  return apiGet(`/api/anomalies/keys/${keyId}`);
}