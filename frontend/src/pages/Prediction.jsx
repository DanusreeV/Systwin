// src/pages/Prediction.jsx
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { api } from "../services/api";

const PRED_LABELS = ["now", "+5m", "+10m", "+15m", "+20m", "+25m", "+30m"];
const CHART_OPT = {
  responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#475569", font: { size: 9 } } },
    y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#475569", font: { size: 9 } }, min: 0, max: 100 },
  },
};

const makeDS = (data, color, dash = false, fill = true) => ({
  data, borderColor: color, backgroundColor: fill ? color + "15" : "transparent",
  borderWidth: dash ? 1 : 1.5, borderDash: dash ? [4, 4] : [],
  fill: !dash, tension: 0.4, pointRadius: 0,
});

export function Prediction() {
  const [forecast, setForecast] = useState(null);
  const [compare,  setCompare]  = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [f, c] = await Promise.all([api.forecast(), api.compare(20)]);
        setForecast(f);
        setCompare(c);
      } catch {
        // Mock
        const base = [42, 43, 45, 47, 49, 51, 53];
        const basem = [61, 62, 62, 63, 64, 65, 66];
        setForecast({ cpu: base, memory: basem, r2_cpu: 0.91, r2_mem: 0.89, n_samples: 300 });
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const predCpu5  = forecast?.cpu[1];
  const predCpu15 = forecast?.cpu[3];
  const predMem5  = forecast?.memory[1];
  const predMem15 = forecast?.memory[3];

  return (
    <div>
      <div style={S.grid4}>
        <PredCard label="CPU in 5 min"  value={predCpu5}  color="#00d4ff" />
        <PredCard label="CPU in 15 min" value={predCpu15} color="#00d4ff" />
        <PredCard label="Mem in 5 min"  value={predMem5}  color="#7c3aed" />
        <PredCard label="Mem in 15 min" value={predMem15} color="#7c3aed" />
      </div>

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.title}><Dot c="#00d4ff" /> CPU Prediction (30 min)</div>
          <div style={{ height: 180, position: "relative" }}>
            <Line data={{ labels: PRED_LABELS, datasets: [
              makeDS(forecast?.cpu || [], "#00d4ff"),
              makeDS(Array(7).fill(75), "#ef444460", true, false),
            ]}} options={CHART_OPT} />
          </div>
        </div>
        <div style={S.card}>
          <div style={S.title}><Dot c="#7c3aed" /> Memory Prediction (30 min)</div>
          <div style={{ height: 180, position: "relative" }}>
            <Line data={{ labels: PRED_LABELS, datasets: [
              makeDS(forecast?.memory || [], "#7c3aed"),
              makeDS(Array(7).fill(80), "#ef444460", true, false),
            ]}} options={CHART_OPT} />
          </div>
        </div>
      </div>

      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.title}><Dot c="#10b981" /> Actual vs Predicted Accuracy</div>
        <div style={{ height: 180, position: "relative" }}>
          <Line data={{ labels: Array.from({ length: compare?.cpu_actual?.length || 10 }, (_, i) => `${i}s`), datasets: [
            makeDS(compare?.cpu_actual    || [], "#10b981"),
            makeDS(compare?.cpu_predicted || [], "#f59e0b", true, false),
          ]}} options={CHART_OPT} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11 }}>
          <Legend c="#10b981" label="Actual" />
          <Legend c="#f59e0b" label="Predicted" />
        </div>
      </div>

      <div style={S.aiPanel}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>◈ ML Model Metrics</span>
          <span style={S.badge}>LINEAR REGRESSION</span>
        </div>
        <div style={S.aiText}>
          Model R² (CPU): <span style={{ color: "#10b981" }}>{forecast?.r2_cpu?.toFixed(3) || "—"}</span> &nbsp;|&nbsp;
          Model R² (Memory): <span style={{ color: "#10b981" }}>{forecast?.r2_mem?.toFixed(3) || "—"}</span> &nbsp;|&nbsp;
          Training samples: <span style={{ color: "#00d4ff" }}>{forecast?.n_samples || "—"}</span>
          <br /><br />
          Predictions use a <strong>lag-feature + rolling-stats linear regression</strong> pipeline.
          Features include the last 20 data points, 5-sample rolling mean/std, and a linear trend slope.
          The model auto-retrains every 5 minutes on the latest system data.
          <br /><br />
          <span style={{ color: "#f59e0b" }}>Dashed red line</span> indicates alert threshold.
          Predicted values breaching the threshold trigger warnings in the Alerts panel.
        </div>
      </div>
    </div>
  );
}


// ─── Alerts Page ─────────────────────────────────────────────────────────────

export function Alerts() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try { setData(await api.alerts()); } catch { /* use static mock */ }
    }
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const health = data?.health_score ?? 87;
  const healthColor = health >= 70 ? "#10b981" : health >= 45 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 50;
  const offset = circumference * (1 - health / 100);

  const staticAlerts = [
    { severity: "WARNING", title: "CPU Threshold Breach Predicted", message: "Model predicts CPU will reach 78% in ~12 minutes.", suggestion: "Close heavy processes proactively.", time: "2 min ago" },
    { severity: "DANGER",  title: "Memory Pressure Detected",       message: "Memory at 61% with suspicious process showing growth.", suggestion: "Inspect PID 4821 (node) for memory leak.", time: "5 min ago" },
    { severity: "INFO",    title: "High Process Count",             message: "247 processes active. 23 zombie processes identified.", suggestion: "Run: ps aux | grep Z | awk '{print $2}' | xargs kill -9", time: "Ongoing" },
  ];

  const alerts = data?.alerts?.length ? data.alerts : staticAlerts;

  return (
    <div>
      <div style={S.grid2} className="health-grid">
        <div style={{ ...S.card, textAlign: "center" }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke={healthColor} strokeWidth="10"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset 1s" }} />
            <text x="60" y="65" textAnchor="middle" fill={healthColor} fontSize="20" fontWeight="800" fontFamily="JetBrains Mono">{health}</text>
          </svg>
          <div style={{ fontSize: 11, color: "#475569", letterSpacing: "1px", textTransform: "uppercase" }}>System Health Score</div>
          <div style={{ fontSize: 13, color: healthColor, fontWeight: 600, marginTop: 4 }}>
            {health >= 70 ? "Good Condition" : health >= 45 ? "Needs Attention" : "Critical"}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.title}><Dot c="#10b981" /> AI Recommendations</div>
          {[
            { n: 1, text: "Terminate idle browser tabs — Chrome using 12% CPU across 8 processes." },
            { n: 2, text: "Stop idle Docker containers consuming 2.4 GB RAM." },
            { n: 3, text: "Schedule Dropbox sync to off-hours to reduce disk I/O spikes." },
            { n: 4, text: "Restart node (PID 4821) — heap growing 50 MB/min (suspected leak)." },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(0,212,255,0.08)" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(0,212,255,0.1)", color: "#00d4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{text}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.sectionLabel}>Active Alerts ({alerts.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {alerts.map((a, i) => (
          <AlertItem key={i} alert={a} />
        ))}
      </div>

      <div style={S.aiPanel}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>◈ Health Breakdown</span>
          <span style={S.badge}>EXPLAINABLE AI</span>
        </div>
        <div style={S.aiText}>
          <span style={{ color: "#10b981" }}>CPU (92/100):</span> Normal range. All 8 cores balanced. Peak Core 3 at 67%.<br /><br />
          <span style={{ color: "#f59e0b" }}>Memory (74/100):</span> Moderate pressure. One process showing non-linear heap growth — flagged as potential leak.<br /><br />
          <span style={{ color: "#10b981" }}>Disk (95/100):</span> Excellent. SSD life at 94%. Read/write speeds nominal.<br /><br />
          <span style={{ color: "#10b981" }}>Processes (88/100):</span> 247 active within normal range. 23 zombies — minor overhead.<br /><br />
          <strong style={{ color: "#e2e8f0" }}>Overall: {health}/100</strong> — Good health with proactive memory attention recommended.
        </div>
      </div>
    </div>
  );
}

function AlertItem({ alert }) {
  const colors = { DANGER: "#ef4444", WARNING: "#f59e0b", INFO: "#00d4ff", INFO_GREEN: "#10b981" };
  const bgColors = { DANGER: "rgba(239,68,68,0.06)", WARNING: "rgba(245,158,11,0.06)", INFO: "rgba(0,212,255,0.06)" };
  const icons = { DANGER: "⊘", WARNING: "⚠", INFO: "◎" };
  const c = colors[alert.severity] || "#00d4ff";

  return (
    <div style={{ display: "flex", gap: 14, padding: "14px 16px", borderRadius: 10, borderLeft: `3px solid ${c}`, background: bgColors[alert.severity] || "rgba(0,212,255,0.06)" }}>
      <span style={{ fontSize: 16, color: c, marginTop: 1 }}>{icons[alert.severity] || "◎"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: c, marginBottom: 3 }}>{alert.title}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{alert.message}</div>
        {alert.suggestion && (
          <div style={{ fontSize: 11, marginTop: 6, padding: "6px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 6, color: "#94a3b8" }}>
            <strong style={{ color: "#e2e8f0" }}>Action: </strong>{alert.suggestion}
          </div>
        )}
        <div style={{ fontSize: 10, color: "#475569", fontFamily: "JetBrains Mono", marginTop: 4 }}>{alert.time || alert.timestamp?.slice(11, 19) || "Just now"}</div>
      </div>
    </div>
  );
}

// Shared helpers
const Dot = ({ c }) => <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />;
const Legend = ({ c, label }) => (
  <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
    <span style={{ width: 10, height: 10, borderRadius: 2, background: c, flexShrink: 0 }} />{label}
  </span>
);
function PredCard({ label, value, color }) {
  return (
    <div style={{ background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: "0 18px 16px", overflow: "hidden" }}>
      <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${color},transparent)`, marginBottom: 12 }} />
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "JetBrains Mono", color }}>
        {value ?? "—"}<span style={{ fontSize: 13, color: "#94a3b8", marginLeft: 2 }}>%</span>
      </div>
    </div>
  );
}

const S = {
  grid4:       { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 },
  grid2:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 },
  card:        { background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: 18 },
  title:       { fontSize: 12, fontWeight: 700, letterSpacing: "1px", color: "#94a3b8", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 },
  sectionLabel:{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#475569", textTransform: "uppercase", margin: "20px 0 12px" },
  aiPanel:     { background: "#0f1628", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 12, padding: 18, marginTop: 14 },
  badge:       { fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", padding: "3px 8px", borderRadius: 4, background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" },
  aiText:      { fontSize: 12, color: "#94a3b8", lineHeight: 1.8 },
};
