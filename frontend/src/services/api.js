// src/services/api.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralised API client for SysTwin AI backend (FastAPI on port 8000).
// All fetch calls go through these helpers so error handling is consistent.

const BASE = "http://localhost:8000/api";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  // Metrics
  snapshot:   ()          => get("/metrics/snapshot"),
  history:    (n = 60)    => get(`/metrics/history?last_n=${n}`),
  processes:  (top = 10)  => get(`/metrics/processes?top=${top}`),
  retrain:    ()          => post("/metrics/retrain", {}),

  // Predictions
  forecast:   ()          => get("/prediction/forecast"),
  compare:    (n = 20)    => get(`/prediction/compare?last_n=${n}`),

  // Simulation
  simulate:   (body)      => post("/simulation/run", body),
  presets:    ()          => get("/simulation/presets"),

  // Alerts
  alerts:     ()          => get("/alerts/"),
  healthScore:()          => get("/alerts/health-score"),
};
