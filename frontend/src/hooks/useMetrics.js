// src/hooks/useMetrics.js
// ─────────────────────────────────────────────────────────────────────────────
// Custom hook that centralises all polling logic.
// Components import this instead of calling api directly —
// ensures consistent refresh cadence and shared abort/cleanup.

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../services/api";

// ── Default polling intervals (ms) ──────────────────────────────────────────
const INTERVALS = {
  snapshot:  2_000,   // every 2s  — live metrics
  history:  10_000,   // every 10s — chart data
  processes: 5_000,   // every 5s  — process table
  forecast: 30_000,   // every 30s — ML prediction
  alerts:    5_000,   // every 5s  — alert evaluation
};

/**
 * useMetrics()
 * Returns { snapshot, history, processes, forecast, alerts, health, error }
 * Automatically polls all endpoints and cleans up on unmount.
 */
export function useMetrics() {
  const [snapshot,  setSnapshot]  = useState(null);
  const [history,   setHistory]   = useState({ cpu: [], memory: [], timestamps: [] });
  const [processes, setProcesses] = useState([]);
  const [forecast,  setForecast]  = useState(null);
  const [alerts,    setAlerts]    = useState(null);
  const [error,     setError]     = useState(null);
  const timers = useRef([]);

  // Derived health score (0–100)
  const health = snapshot
    ? Math.max(0, Math.min(100, Math.round(
        100 - snapshot.cpu * 0.35 - snapshot.memory * 0.35
            - snapshot.disk * 0.15
            - Math.min(100, snapshot.processes / 5) * 0.15
      )))
    : null;

  const poll = useCallback(async (fn, setter, interval) => {
    const run = async () => {
      try {
        const data = await fn();
        setter(data);
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    };
    await run();                                     // immediate first call
    const id = setInterval(run, interval);
    timers.current.push(id);
  }, []);

  useEffect(() => {
    poll(() => api.snapshot(),            setSnapshot,  INTERVALS.snapshot);
    poll(() => api.history(60),           setHistory,   INTERVALS.history);
    poll(() => api.processes(12).then(r => r.processes), setProcesses, INTERVALS.processes);
    poll(() => api.forecast(),            setForecast,  INTERVALS.forecast);
    poll(() => api.alerts(),              setAlerts,    INTERVALS.alerts);

    return () => timers.current.forEach(clearInterval);
  }, [poll]);

  return { snapshot, history, processes, forecast, alerts, health, error };
}

/**
 * useHealthScore()
 * Lightweight hook for components that only need the health number.
 */
export function useHealthScore() {
  const [score, setScore] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        const d = await api.healthScore();
        const s = Math.max(0, Math.min(100, Math.round(
          100 - d.cpu * 0.35 - d.memory * 0.35
        )));
        setScore(s);
      } catch { /* backend not yet up */ }
    };
    run();
    const id = setInterval(run, 3000);
    return () => clearInterval(id);
  }, []);

  return score;
}
