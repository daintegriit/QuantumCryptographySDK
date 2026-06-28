// src/services/replayApi.js
import { apiGet } from "./apiClient.js";

// FIX: /api/replay/keys/:id → /api/keys/:id/replay
export const fetchKeyReplay = (keyId) => {
  if (!keyId) throw new Error("fetchKeyReplay requires keyId");
  return apiGet(`/api/keys/${keyId}/replay`);
};

export const fetchAllReplay = (limitScan) => {
  const q = limitScan ? `?limit_scan=${limitScan}` : "";
  return apiGet(`/api/replay${q}`);
};

export const fetchReplayStatus = () =>
  apiGet("/api/replay/status");