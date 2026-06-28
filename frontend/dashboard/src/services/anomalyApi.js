// src/services/anomalyApi.js
import { apiGet } from "./apiClient.js";

// FIX: /api/anomalies/summary → /api/anomalies/scan
export const fetchAnomalySummary = (windowHours=24) =>
  apiGet(`/api/anomalies/scan?window_hours=${windowHours}`);

// FIX: /api/anomalies/keys/:id → no such route; anomalies are system-wide only
// Components should use fetchAnomalySummary and filter client-side by key_id
export const fetchAnomalyStatus = () =>
  apiGet("/api/anomalies/status");