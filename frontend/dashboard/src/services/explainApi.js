// src/services/explainApi.js
import { apiGet } from "./apiClient.js";

// FIX: /api/explain/keys/:id → /api/keys/:id/explain
export const fetchKeyExplain = (keyId, profile="enterprise-default") => {
  if (!keyId) throw new Error("fetchKeyExplain requires keyId");
  return apiGet(`/api/keys/${keyId}/explain?profile=${profile}`);
};

export const fetchExplainStatus = () =>
  apiGet("/api/explain/status");

// FIX: /api/replay/keys/:id → /api/keys/:id/replay
export const fetchKeyReplay = (keyId) => {
  if (!keyId) throw new Error("fetchKeyReplay requires keyId");
  return apiGet(`/api/keys/${keyId}/replay`);
};