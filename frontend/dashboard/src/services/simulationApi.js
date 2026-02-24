/**
 * simulationApi.js
 *
 * Frontend API client for cryptographic simulations.
 *
 * GUARANTEES:
 * - Read-only by default
 * - No key mutation
 * - Audit-safe
 * - Deterministic
 *
 * BACKEND:
 * - backend/api/simulations.py
 * - backend/simulations/simulations.py
 * - backend/agility/migration_simulator.py
 */

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8008/api";

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Simulation API ${res.status}: ${text}`);
  }

  return res.json();
}

// -----------------------------------------------------
// Simulation API
// -----------------------------------------------------

export const SimulationAPI = {
  /**
   * Readiness / health probe
   *
   * GET /api/simulations/status
   */
  async status() {
    return fetchJson(`${API_BASE}/simulations/status`);
  },

  /**
   * Single-key lifespan simulation
   *
   * GET /api/keys/{key_id}/simulation
   */
  async simulateKey({
    keyId,
    startYear,
    horizonYears = 50,
    safetyMarginYears = 10,
  }) {
    if (!keyId) {
      throw new Error("simulateKey requires keyId");
    }

    const qs = new URLSearchParams();
    if (startYear) qs.set("start_year", startYear);
    qs.set("horizon_years", horizonYears);
    qs.set("safety_margin_years", safetyMarginYears);

    return fetchJson(
      `${API_BASE}/keys/${keyId}/simulation?${qs.toString()}`
    );
  },

  /**
   * Portfolio-wide scenario simulation
   *
   * POST /api/simulations/portfolio
   *
   * BACKED BY:
   * - MigrationSimulator.simulate_portfolio()
   */
  async runPortfolio({
    safetyMarginYears = 10,
    scenarios = ["conservative", "baseline", "aggressive", "breakthrough"],
    limit = 200,
    seed = 1337,
  } = {}) {
    return fetchJson(`${API_BASE}/simulations/portfolio`, {
      method: "POST",
      body: JSON.stringify({
        safety_margin_years: safetyMarginYears,
        scenarios,
        limit,
        seed,
      }),
    });
  },
};