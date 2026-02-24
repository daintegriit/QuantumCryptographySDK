// src/services/explainApi.js

/**
 * explainApi
 *
 * Deterministic explanation + replay fetch layer.
 *
 * Design goals:
 * - No UI logic
 * - No side effects
 * - Explicit failures
 * - Matches backend contract exactly
 * - Rollup / Vite safe
 */

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8008";

/* =====================================================
 * Helpers
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
      `[ExplainAPI] ${res.status} ${res.statusText} :: ${path}\n${detail}`
    );
  }

  return res.json();
}

/* =====================================================
 * Exports (USED BY UI)
 * ===================================================== */

/**
 * Fetch deterministic governance explanation for a key
 */
export function fetchKeyExplain(keyId) {
  if (!keyId) {
    throw new Error("fetchKeyExplain requires keyId");
  }

  return apiGet(`/api/explain/keys/${keyId}`);
}

/**
 * Fetch key replay timeline (audit-safe)
 */
export function fetchKeyReplay(keyId) {
  if (!keyId) {
    throw new Error("fetchKeyReplay requires keyId");
  }

  return apiGet(`/api/replay/keys/${keyId}`);
}