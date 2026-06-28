// src/services/apiClient.js

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8008";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    let detail = "";
    try { const body = await res.json(); detail = body?.detail || JSON.stringify(body); }
    catch { detail = await res.text(); }
    throw new Error(`[API ERROR] ${res.status} ${res.statusText} :: ${path}\n${detail}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const apiGet  = (path)       => request(path, { method: "GET" });
export const apiPost = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });

// ── Keys ──────────────────────────────────────────────────────
export const KeysAPI = {
  list:          (limit=25)     => apiGet(`/api/keys?limit=${limit}`),
  get:           (keyId)        => apiGet(`/api/keys/${keyId}`),
  active:        ()             => apiGet("/api/keys/active"),
  activate:      (keyId)        => apiPost(`/api/keys/${keyId}/activate`, {}),
  rotateActive:  (force=false)  => apiPost(`/api/keys/active/rotate?force=${force}`, {}),
  status:        (keyId)        => apiGet(`/api/keys/${keyId}/status`),
  lifecycle:     (keyId)        => apiGet(`/api/keys/${keyId}/lifecycle`),
  lifecycleScan: (limit=50)     => apiGet(`/api/keys/lifecycle/scan?limit=${limit}`),
  migration:     (keyId)        => apiGet(`/api/keys/${keyId}/migration`),
  simulate:      (keyId, params={}) => {
    const q = new URLSearchParams(params).toString();
    return apiGet(`/api/keys/${keyId}/simulation${q ? "?" + q : ""}`);
  },
  explain:       (keyId, profile="enterprise-default") =>
                                   apiGet(`/api/keys/${keyId}/explain?profile=${profile}`),
  replay:        (keyId)        => apiGet(`/api/keys/${keyId}/replay`),
  rotate:        (keyId, force=false) => apiPost(`/api/keys/${keyId}/rotate?force=${force}`, {}),
  migrate:       (keyId, force=false) => apiPost(`/api/keys/${keyId}/migrate`, { force }),
};

// ── Crypto ────────────────────────────────────────────────────
export const CryptoAPI = {
  keygen:           (payload={})                => apiPost("/api/keygen", payload),
  encrypt:          (keyId, plaintext)          => apiPost("/api/encrypt", { key_id: keyId, plaintext }),
  decrypt:          (keyId, ciphertext)         => apiPost("/api/decrypt", { key_id: keyId, ciphertext }),
  sign:             (keyId, message)            => apiPost("/api/sign", { key_id: keyId, message }),
  verify:           (keyId, message, signature) => apiPost("/api/verify", { key_id: keyId, message, signature }),
  kemEncap:         (publicKey, paramSet)       => apiPost("/api/kem/encap", { public_key: publicKey, parameter_set: paramSet }),
  kemDecap:         (keyId, kemCiphertext)      => apiPost("/api/kem/decap", { key_id: keyId, kem_ciphertext: kemCiphertext }),
  encryptClassical: (plaintext, scheme="rsa-2048") => apiPost("/api/encrypt-classical", { plaintext, scheme }),
  signClassical:    (message, scheme="ecc-p256")   => apiPost("/api/sign-classical", { message, scheme }),
};

// ── Policy ────────────────────────────────────────────────────
export const PolicyAPI = {
  check:       (scheme, parameterSet, longevity=30) =>
                 apiGet(`/api/policy/check?scheme=${scheme}&parameter_set=${parameterSet}&longevity=${longevity}`),
  checkPost:   (payload)   => apiPost("/api/policy/check", payload),
  status:      ()          => apiGet("/api/policy/status"),
  drift:       (params={}) => {
    const q = new URLSearchParams(params).toString();
    return apiGet(`/api/policy-drift${q ? "?" + q : ""}`);
  },
  driftStatus: () => apiGet("/api/policy-drift/status"),
};

// ── Telemetry ─────────────────────────────────────────────────
export const TelemetryAPI = {
  system:        ()               => apiGet("/api/telemetry/system"),
  key:           (keyId)          => apiGet(`/api/telemetry/keys/${keyId}`),
  keyReplay:     (keyId)          => apiGet(`/api/telemetry/keys/${keyId}/replay`),
  replayAll:     ()               => apiGet("/api/telemetry/replay"),
  status:        ()               => apiGet("/api/telemetry/status"),
  metrics:       (windowHours=24) => apiGet(`/api/telemetry/metrics?window_hours=${windowHours}`),
  metricsStatus: ()               => apiGet("/api/telemetry/metrics/status"),
};

// ── Anomaly ───────────────────────────────────────────────────
export const AnomalyAPI = {
  // FIX: was /api/anomalies/summary → correct is /api/anomalies/scan
  scan:   (windowHours=24) => apiGet(`/api/anomalies/scan?window_hours=${windowHours}`),
  status: ()               => apiGet("/api/anomalies/status"),
};

// ── Simulation ────────────────────────────────────────────────
export const SimulationAPI = {
  status:    ()           => apiGet("/api/simulations/status"),
  portfolio: (payload={}) => apiPost("/api/simulations/portfolio", {
    safety_margin_years: 10, limit: 200, seed: 1337, ...payload,
  }),
  key: (keyId, params={}) => KeysAPI.simulate(keyId, params),
};

// ── Replay / Audit ────────────────────────────────────────────
export const ReplayAPI = {
  // FIX: was /api/replay/keys/:id → correct is /api/keys/:id/replay
  key:    (keyId) => apiGet(`/api/keys/${keyId}/replay`),
  all:    ()      => apiGet("/api/replay"),
  status: ()      => apiGet("/api/replay/status"),
};

// ── Explain ───────────────────────────────────────────────────
export const ExplainAPI = {
  // FIX: was /api/explain/keys/:id → correct is /api/keys/:id/explain
  key:    (keyId, profile="enterprise-default") => KeysAPI.explain(keyId, profile),
  status: () => apiGet("/api/explain/status"),
};

// ── Rust Benchmark ────────────────────────────────────────────
export const BenchmarkAPI = {
  rust: (mode="benchmark") => apiGet(`/api/rust/benchmark?mode=${mode}`),
};

// ── Governance (mapped to real routes) ───────────────────────
export const GovernanceAPI = {
  // FIX: /api/governance/risk doesn't exist → use policy drift
  risk:         ()          => PolicyAPI.drift(),
  policyDrift:  (params={}) => PolicyAPI.drift(params),
  lifecycleScan:(limit=50)  => KeysAPI.lifecycleScan(limit),
};