// src/pages/Simulation.jsx
// What-If Scenario Engine — lets users simulate hypothetical workloads
// and see predicted system behavior via the ML model.

import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { api } from "../services/api";

const LABELS = ["now", "+5m", "+10m", "+15m", "+20m", "+25m", "+30m"];

const makeDS = (data, color, label, dash = false) => ({
  label, data,
  borderColor:     color,
  backgroundColor: dash ? "transparent" : color + "15",
  borderWidth:     dash ? 1 : 1.5,
  borderDash:      dash ? [4, 4] : [],
  fill:            !dash,
  tension:         0.4,
  pointRadius:     0,
});

const CHART_OPT = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#475569", font: { size: 9 } } },
    y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#475569", font: { size: 9 } }, min: 0, max: 100 },
  },
};

const PRESETS = {
  gaming:  { cpu_increase: 40, mem_increase: 20, new_processes: 15 },
  coding:  { cpu_increase: 20, mem_increase: 15, new_processes: 8  },
  video:   { cpu_increase: 55, mem_increase: 30, new_processes: 5  },
  idle:    { cpu_increase: 0,  mem_increase: 0,  new_processes: 0  },
};

export default function Simulation() {
  const [cpuAdd,   setCpuAdd]   = useState(0);
  const [memAdd,   setMemAdd]   = useState(0);
  const [procAdd,  setProcAdd]  = useState(0);
  const [preset,   setPreset]   = useState(null);
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [snap,     setSnap]     = useState({ cpu: 42, memory: 61, processes: 247 });

  useEffect(() => {
    api.snapshot().then(setSnap).catch(() => {});
  }, []);

  function applyPreset(name) {
    const p = PRESETS[name];
    setCpuAdd(p.cpu_increase);
    setMemAdd(p.mem_increase);
    setProcAdd(p.new_processes);
    setPreset(name);
  }

  async function runSim() {
    setLoading(true);
    try {
      const res = await api.simulate({
        cpu_increase:  cpuAdd,
        mem_increase:  memAdd,
        new_processes: procAdd,
      });
      setResult(res);
    } catch {
      // Mock result if backend unavailable
      const peak = Math.min(99, snap.cpu + cpuAdd + procAdd * 0.15);
      const peakM = Math.min(99, snap.memory + memAdd + procAdd * 0.08);
      const risk = Math.round(peak * 0.4 + peakM * 0.35 + procAdd * 0.5);
      setResult({
        labels:     LABELS,
        base_cpu:   LABELS.map((_, i) => Math.round(snap.cpu  + i * 0.4)),
        base_mem:   LABELS.map((_, i) => Math.round(snap.memory + i * 0.3)),
        sim_cpu:    LABELS.map((_, i) => Math.min(99, Math.round(snap.cpu + cpuAdd + i * 0.6))),
        sim_mem:    LABELS.map((_, i) => Math.min(99, Math.round(snap.memory + memAdd + i * 0.4))),
        risk_score: Math.min(100, risk),
        risk_level: risk < 35 ? "LOW" : risk < 65 ? "MEDIUM" : "HIGH",
        suggestion: risk < 35 ? "System can handle this workload." : risk < 65 ? "Consider reducing background tasks." : "WARNING: This load may destabilize the system.",
      });
    }
    setLoading(false);
  }

  const riskColors = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444" };
  const riskColor  = result ? riskColors[result.risk_level] : "#475569";

  return (
    <div style={styles.grid}>
      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.cardTitle}>⬡ What-If Scenario Engine</div>

        <div style={styles.sectionLabel}>Preset Workloads</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {Object.keys(PRESETS).map(name => (
            <button key={name} style={{ ...styles.presetBtn, ...(preset === name ? styles.presetActive : {}) }}
              onClick={() => applyPreset(name)}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>

        <div style={styles.sectionLabel}>Adjust Parameters</div>

        <SliderGroup label="CPU Load Increase" value={cpuAdd} min={0} max={60} unit="%" onChange={v => { setCpuAdd(v); setPreset(null); }} />
        <SliderGroup label="Memory Increase"   value={memAdd} min={0} max={40} unit="%" onChange={v => { setMemAdd(v);  setPreset(null); }} />
        <SliderGroup label="New Processes"      value={procAdd} min={0} max={50}         onChange={v => { setProcAdd(v); setPreset(null); }} />

        <div style={styles.stateBox}>
          <div style={styles.stateLabel}>Simulated State</div>
          <StateRow label="Total CPU"    value={`${Math.min(99, snap.cpu    + cpuAdd  + procAdd * 0.15 | 0)}%`} color="#00d4ff" />
          <StateRow label="Total Memory" value={`${Math.min(99, snap.memory + memAdd  + procAdd * 0.08 | 0)}%`} color="#7c3aed" />
          <StateRow label="Processes"    value={`${snap.processes + procAdd}`}                                    color="#f59e0b" />
        </div>

        <button style={{ ...styles.runBtn, opacity: loading ? 0.7 : 1 }} onClick={runSim} disabled={loading}>
          {loading ? "Simulating…" : "↗ Run Simulation"}
        </button>
      </div>

      {/* Output */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Risk display */}
        <div style={styles.riskCard}>
          <div style={styles.riskLabel}>System Risk Level</div>
          <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "JetBrains Mono", color: riskColor }}>
            {result ? result.risk_level : "—"}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", fontFamily: "JetBrains Mono", marginTop: 4 }}>
            {result ? `Risk Score: ${result.risk_score} / 100` : "Run simulation to evaluate impact"}
          </div>
          {result?.suggestion && (
            <div style={{ marginTop: 12, fontSize: 11, color: "#94a3b8", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 6, lineHeight: 1.6 }}>
              {result.suggestion}
            </div>
          )}
        </div>

        {/* CPU sim chart */}
        <div style={styles.chartCard}>
          <div style={styles.cardTitle}><Dot color="#00d4ff" /> Simulated CPU Timeline</div>
          <div style={{ height: 160, position: "relative" }}>
            <Line data={{
              labels: LABELS,
              datasets: result
                ? [makeDS(result.base_cpu, "#00d4ff", "Baseline"), makeDS(result.sim_cpu, "#ef4444", "Simulated")]
                : [makeDS(Array(7).fill(snap.cpu), "#00d4ff", "Baseline")]
            }} options={CHART_OPT} />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11 }}>
            <Legend color="#00d4ff" label="Baseline" />
            <Legend color="#ef4444" label="Simulated" />
          </div>
        </div>

        {/* Memory sim chart */}
        <div style={styles.chartCard}>
          <div style={styles.cardTitle}><Dot color="#7c3aed" /> Simulated Memory Timeline</div>
          <div style={{ height: 160, position: "relative" }}>
            <Line data={{
              labels: LABELS,
              datasets: result
                ? [makeDS(result.base_mem, "#7c3aed", "Baseline"), makeDS(result.sim_mem, "#f59e0b", "Simulated")]
                : [makeDS(Array(7).fill(snap.memory), "#7c3aed", "Baseline")]
            }} options={CHART_OPT} />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11 }}>
            <Legend color="#7c3aed" label="Baseline" />
            <Legend color="#f59e0b" label="Simulated" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderGroup({ label, value, min, max, unit = "", onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "JetBrains Mono", color: "#00d4ff" }}>+{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} step={1}
        style={{ width: "100%", accentColor: "#00d4ff" }}
        onChange={e => onChange(+e.target.value)} />
    </div>
  );
}

function StateRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "JetBrains Mono", marginBottom: 4 }}>
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

const Dot = ({ color }) => <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
const Legend = ({ color, label }) => (
  <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
    {label}
  </span>
);

const styles = {
  grid:        { display: "grid", gridTemplateColumns: "380px 1fr", gap: 16 },
  controls:    { background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: 20 },
  cardTitle:   { fontSize: 13, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.5px", marginBottom: 16 },
  sectionLabel:{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#475569", textTransform: "uppercase", margin: "0 0 12px" },
  presetBtn:   { padding: "6px 14px", border: "1px solid rgba(0,212,255,0.25)", borderRadius: 6, background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .2s" },
  presetActive:{ borderColor: "#00d4ff", color: "#00d4ff", background: "rgba(0,212,255,0.08)" },
  stateBox:    { background: "#141c35", borderRadius: 8, padding: 12, marginBottom: 16 },
  stateLabel:  { fontSize: 10, color: "#475569", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 },
  runBtn:      { width: "100%", padding: 12, background: "#00d4ff", color: "#0a0e1a", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.5px" },
  riskCard:    { background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: 20, textAlign: "center" },
  riskLabel:   { fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#475569", textTransform: "uppercase", marginBottom: 12 },
  chartCard:   { background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: 18 },
};
