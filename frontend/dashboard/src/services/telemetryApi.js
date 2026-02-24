// src/services/telemetryApi.js

/**
 * telemetryApi
 *
 * Deterministic telemetry access layer.
 *
 * Design goals:
 * - Read-only
 * - Explicit exports
 * - No UI logic
 * - Rollup-safe
 * - Backend contract aligned
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
      `[TelemetryAPI] ${res.status} ${res.statusText} :: ${path}\n${detail}`
    );
  }

  return res.json();
}

/* =====================================================
 * Exports (USED BY UI)
 * ===================================================== */

/**
 * Fetch telemetry for a single key
 */
export function fetchKeyTelemetry(keyId) {
  if (!keyId) {
    throw new Error("fetchKeyTelemetry requires keyId");
  }

  return apiGet(`/api/telemetry/keys/${keyId}`);
}

/**
 * Fetch system-wide telemetry
 */
export function fetchSystemTelemetry() {
  return apiGet("/api/telemetry/system");
}

/**
 * Fetch system metrics
 */
export function fetchTelemetryMetrics() {
  return apiGet("/api/telemetry/metrics");
}