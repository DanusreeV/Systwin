// src/pages/Dashboard.jsx
// Live system metrics page with real-time charts and process table.

import { useEffect, useState, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Filler, Tooltip,
} from "chart.js";
import { api } from "../services/api";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const CHART_OPT = (color) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: { legend: { display: false }, tooltip: { mode: "index" } },
  scales: {
    x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#475569", font: { size: 9 } } },
    y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#475569", font: { size: 9 } }, min: 0, max: 100 },
  },
});

const makeDS = (data, color) => ({
  data,
  borderColor: color,
  backgroundColor: color + "20",
  borderWidth: 1.5,
  fill: true,
  tension: 0.4,
  pointRadius: 0,
});

export default function Dashboard({ onHealthChange }) {
  const [snap, setSnap]   = useState(null);
  const [hist, setHist]   = useState({ cpu: [], memory: [], timestamps: [] });
  const [procs, setProcs] = useState([]);
  const prevCpu = useRef(null);

  useEffect(() => {
    async function refresh() {
      try {
        const [s, h, p] = await Promise.all([
          api.snapshot(), api.history(60), api.processes(10)
        ]);
        setSnap(s);
        setHist(h);
        setProcs(p.processes || []);
        prevCpu.current = s.cpu;
        if (onHealthChange) {
          const score = Math.round(100 - s.cpu * 0.3 - s.memory * 0.2);
          onHealthChange(Math.max(0, Math.min(100, score)));
        }
      } catch (e) { console.warn("API unavailable — using mock data"); }
    }
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const labels = hist.timestamps.slice(-60).map((_, i) =>
    i % 15 === 0 ? `${60 - i}s` : ""
  );

  const cpuColor  = snap?.cpu  > 75 ? "#ef4444" : snap?.cpu  > 55 ? "#f59e0b" : "#00d4ff";
  const memColor  = snap?.memory > 80 ? "#ef4444" : "#7c3aed";

  return (
    <div>
      {/* Metric Cards */}
      <div style={styles.grid4}>
        <MetricCard label="CPU Usage"       value={snap?.cpu ?? "—"}  unit="%" color={cpuColor}  bar={snap?.cpu} />
        <MetricCard label="Memory"          value={snap?.memory ?? "—"} unit="%" color="#7c3aed" bar={snap?.memory} />
        <MetricCard label="Disk Usage"      value={snap?.disk ?? "—"}  unit="%" color="#10b981" bar={snap?.disk} />
        <MetricCard label="Processes"       value={snap?.processes ?? "—"} color="#f59e0b" bar={Math.min(100,(snap?.processes||0)/5)} />
      </div>

      {/* Charts */}
      <div style={styles.grid2}>
        <div style={styles.chartCard}>
          <div style={styles.cardTitle}><Dot color={cpuColor} /> CPU History (60s)</div>
          <div style={{ height: 160, position: "relative" }}>
            <Line data={{ labels, datasets: [makeDS(hist.cpu.slice(-60), cpuColor)] }} options={CHART_OPT(cpuColor)} />
          </div>
        </div>
        <div style={styles.chartCard}>
          <div style={styles.cardTitle}><Dot color="#7c3aed" /> Memory History (60s)</div>
          <div style={{ height: 160, position: "relative" }}>
            <Line data={{ labels, datasets: [makeDS(hist.memory.slice(-60), "#7c3aed")] }} options={CHART_OPT("#7c3aed")} />
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div style={styles.sectionLabel}>Top Processes — Root Cause Analysis</div>
      <div style={styles.procTable}>
        <div style={styles.procHeader}>
          <span>Process</span><span>PID</span><span>CPU %</span><span>MEM %</span><span>Status</span>
        </div>
        {procs.map(p => (
          <div key={p.pid} style={styles.procRow}>
            <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{p.name}</span>
            <span style={{ color: "#475569" }}>{p.pid}</span>
            <span style={{ ...styles.pill, ...cpuPillStyle(p.cpu) }}>{p.cpu.toFixed(1)}%</span>
            <span style={{ color: "#7c3aed" }}>{p.memory.toFixed(1)}%</span>
            <span style={{ color: "#10b981", fontSize: 10 }}>● {p.status}</span>
          </div>
        ))}
        {procs.length === 0 && (
          <div style={{ padding: "20px 16px", color: "#475569", fontSize: 12, textAlign: "center" }}>
            Connecting to backend... (start backend/app.py)
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit = "", color, bar = 0 }) {
  return (
    <div style={{ ...styles.metricCard, "--c": color }}>
      <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${color},transparent)`, marginBottom: 12 }} />
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "JetBrains Mono", color }}>
        {value}<span style={{ fontSize: 13, color: "#94a3b8", marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={styles.metricBar}>
        <div style={{ height: "100%", width: `${bar || 0}%`, background: color, borderRadius: 2, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

const Dot = ({ color }) => (
  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
);

function cpuPillStyle(cpu) {
  if (cpu > 8) return { background: "rgba(239,68,68,0.15)", color: "#f87171" };
  if (cpu > 4) return { background: "rgba(245,158,11,0.15)", color: "#fbbf24" };
  return { background: "rgba(16,185,129,0.15)", color: "#34d399" };
}

const styles = {
  grid4:       { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 },
  grid2:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 },
  metricCard:  { background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: "0 18px 16px", overflow: "hidden" },
  metricLabel: { fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", color: "#475569", textTransform: "uppercase", marginBottom: 8 },
  metricBar:   { height: 3, background: "#1a2444", borderRadius: 2, marginTop: 12, overflow: "hidden" },
  chartCard:   { background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: 18 },
  cardTitle:   { fontSize: 12, fontWeight: 700, letterSpacing: "1px", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  sectionLabel:{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#475569", textTransform: "uppercase", margin: "20px 0 12px" },
  procTable:   { background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, overflow: "hidden" },
  procHeader:  { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px", gap: 8, padding: "10px 16px", background: "#141c35", fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", color: "#475569", textTransform: "uppercase" },
  procRow:     { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px", gap: 8, padding: "10px 16px", borderTop: "1px solid rgba(0,212,255,0.08)", alignItems: "center", fontSize: 12, fontFamily: "JetBrains Mono" },
  pill:        { padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 },
};
