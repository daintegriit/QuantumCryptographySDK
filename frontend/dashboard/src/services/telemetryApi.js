// src/services/telemetryApi.js
import { apiGet } from "./apiClient.js";

export const fetchKeyTelemetry    = (keyId) => {
  if (!keyId) throw new Error("fetchKeyTelemetry requires keyId");
  return apiGet(`/api/telemetry/keys/${keyId}`);
};

export const fetchSystemTelemetry = () => apiGet("/api/telemetry/system");

// FIX: route is /api/telemetry/metrics (confirmed from metrics.py)
export const fetchTelemetryMetrics = (windowHours=24) =>
  apiGet(`/api/telemetry/metrics?window_hours=${windowHours}`);

export const fetchTelemetryStatus = () => apiGet("/api/telemetry/status");

export const fetchKeyReplay = (keyId) => {
  if (!keyId) throw new Error("fetchKeyReplay requires keyId");
  return apiGet(`/api/telemetry/keys/${keyId}/replay`);
};