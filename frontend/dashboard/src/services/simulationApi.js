// src/services/simulationApi.js
import { apiGet, apiPost } from "./apiClient.js";

// FIX: original used VITE_API_BASE_URL (wrong env var name, differs from rest of app)
// FIX: original doubled /api in paths (API_BASE included /api then paths added /api again)
// Now uses shared apiGet/apiPost from apiClient which handles base URL correctly

export const SimulationAPI = {
  status: () => apiGet("/api/simulations/status"),

  simulateKey: ({ keyId, startYear, horizonYears=50, safetyMarginYears=10 }) => {
    if (!keyId) throw new Error("simulateKey requires keyId");
    const qs = new URLSearchParams();
    if (startYear) qs.set("start_year", startYear);
    qs.set("horizon_years", horizonYears);
    qs.set("safety_margin_years", safetyMarginYears);
    return apiGet(`/api/keys/${keyId}/simulation?${qs.toString()}`);
  },

  runPortfolio: ({
    safetyMarginYears=10,
    scenarios=["conservative","baseline","aggressive","breakthrough"],
    limit=200,
    seed=1337,
  }={}) => apiPost("/api/simulations/portfolio", {
    safety_margin_years: safetyMarginYears,
    scenarios,
    limit,
    seed,
  }),
};