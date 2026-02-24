// src/services/replayApi.js

/**
 * replayApi
 *
 * Deterministic audit / replay API layer.
 *
 * Design goals:
 * - No UI logic
 * - Explicit errors
 * - Read-only
 * - Rollup/Vite safe
 * - Backend-contract aligned
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
      `[ReplayAPI] ${res.status} ${res.statusText} :: ${path}\n${detail}`
    );
  }

  return res.json();
}

/* =====================================================
 * Exports (USED BY UI)
 * ===================================================== */

/**
 * Fetch replay timeline for a cryptographic key
 */
export function fetchKeyReplay(keyId) {
  if (!keyId) {
    throw new Error("fetchKeyReplay requires keyId");
  }

  return apiGet(`/api/replay/keys/${keyId}`);
}