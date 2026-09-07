// src/components/Cards.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable card primitives, metric displays, process pills, and layout helpers
// that are shared across Dashboard, Prediction, Simulation, and Alerts pages.

// ── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, accent, style = {} }) {
  return (
    <div style={{
      background:   "#0f1628",
      border:       `1px solid ${accent ? accent + "40" : "rgba(0,212,255,0.12)"}`,
      borderRadius: 12,
      padding:      18,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── CardTitle ────────────────────────────────────────────────────────────────

export function CardTitle({ children, color = "#94a3b8" }) {
  return (
    <div style={{
      fontSize:      12,
      fontWeight:    700,
      letterSpacing: "1px",
      color,
      textTransform: "uppercase",
      marginBottom:  16,
      display:       "flex",
      alignItems:    "center",
      gap:           8,
    }}>
      {children}
    </div>
  );
}

export function ColorDot({ color }) {
  return <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

// ── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: "2px",
      color:         "#475569",
      textTransform: "uppercase",
      margin:        "20px 0 12px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────
// Large stat card with accent bar, value, unit, progress bar, and trend line.

export function MetricCard({ label, value, unit = "", color = "#00d4ff", bar = 0, trend, children }) {
  const barColor = bar > 80 ? "#ef4444" : bar > 60 ? "#f59e0b" : color;

  return (
    <div style={{ background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: "0 18px 16px", overflow: "hidden" }}>
      {/* Top accent gradient bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${color},transparent)`, marginBottom: 12 }} />

      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "JetBrains Mono", lineHeight: 1, color: barColor }}>
        {value ?? "—"}
        {unit && <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: 2 }}>{unit}</span>}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#1a2444", borderRadius: 2, marginTop: 12, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, bar || 0)}%`, background: barColor, borderRadius: 2, transition: "width 0.8s ease" }} />
      </div>

      {trend && (
        <div style={{ fontSize: 10, color: "#475569", fontFamily: "JetBrains Mono", marginTop: 6 }}>{trend}</div>
      )}

      {children}
    </div>
  );
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

export function Grid4({ children, gap = 14, style = {} }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap, marginBottom: 24, ...style }}>
      {children}
    </div>
  );
}

export function Grid2({ children, gap = 14, style = {} }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap, marginBottom: 24, ...style }}>
      {children}
    </div>
  );
}

// ── CPU pill ──────────────────────────────────────────────────────────────────

export function CpuPill({ value }) {
  const style =
    value > 15 ? { background: "rgba(239,68,68,0.15)",  color: "#f87171" } :
    value >  6 ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24" } :
                 { background: "rgba(16,185,129,0.15)", color: "#34d399" };

  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, ...style }}>
      {typeof value === "number" ? value.toFixed(1) : value}%
    </span>
  );
}

// ── StatusDot ─────────────────────────────────────────────────────────────────

export function StatusDot({ color = "#10b981", pulse = false, size = 6 }) {
  return (
    <div style={{
      width:     size,
      height:    size,
      borderRadius: "50%",
      background:   color,
      boxShadow:    `0 0 ${size}px ${color}`,
      flexShrink:   0,
      animation:    pulse ? "pulse 2s infinite" : "none",
    }} />
  );
}

// ── AiBadge ───────────────────────────────────────────────────────────────────

export function AiBadge({ children }) {
  return (
    <span style={{
      fontSize:      9,
      fontWeight:    700,
      letterSpacing: "1.5px",
      padding:       "3px 8px",
      borderRadius:  4,
      background:    "rgba(124,58,237,0.15)",
      color:         "#a78bfa",
      border:        "1px solid rgba(124,58,237,0.3)",
      textTransform: "uppercase",
    }}>
      {children}
    </span>
  );
}

// ── RiskBadge ─────────────────────────────────────────────────────────────────

export function RiskBadge({ level }) {
  const map = {
    LOW:    { color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
    MEDIUM: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
    HIGH:   { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)"   },
  };
  const s = map[level] || map.LOW;
  return (
    <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "JetBrains Mono", color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {level}
    </span>
  );
}

// ── ProcessTable ──────────────────────────────────────────────────────────────

export function ProcessTable({ processes = [] }) {
  return (
    <div style={{ background: "#0f1628", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, overflow: "hidden" }}>
      <div style={TH.header}>
        <span>Process</span><span>PID</span><span>CPU %</span><span>MEM %</span><span>Tag</span><span>Status</span>
      </div>

      {processes.length === 0 && (
        <div style={{ padding: "24px 16px", color: "#475569", fontSize: 12, textAlign: "center" }}>
          No process data — is the backend running?
        </div>
      )}

      {processes.map(p => (
        <div key={p.pid} style={TH.row}>
          <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{p.name}</span>
          <span style={{ color: "#475569" }}>{p.pid}</span>
          <CpuPill value={p.cpu} />
          <span style={{ color: "#a78bfa" }}>{p.memory?.toFixed(1)}%</span>
          <RcaTag tag={p.rca_tag} />
          <span style={{ color: "#10b981", fontSize: 10 }}>● {p.status}</span>
        </div>
      ))}
    </div>
  );
}

function RcaTag({ tag }) {
  const map = {
    HIGH_CPU: { label: "CPU HOG",  color: "#f87171", bg: "rgba(239,68,68,0.12)" },
    HIGH_MEM: { label: "MEM HOG",  color: "#a78bfa", bg: "rgba(124,58,237,0.12)" },
    NORMAL:   { label: "normal",   color: "#475569", bg: "transparent" },
  };
  const s = map[tag] || map.NORMAL;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.5px", padding: "2px 6px", borderRadius: 3, color: s.color, background: s.bg, fontFamily: "JetBrains Mono" }}>
      {s.label}
    </span>
  );
}

const TH = {
  header: {
    display:               "grid",
    gridTemplateColumns:   "2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr",
    gap:                   8,
    padding:               "10px 16px",
    background:            "#141c35",
    fontSize:              10,
    fontWeight:            700,
    letterSpacing:         "1.5px",
    color:                 "#475569",
    textTransform:         "uppercase",
  },
  row: {
    display:               "grid",
    gridTemplateColumns:   "2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr",
    gap:                   8,
    padding:               "10px 16px",
    borderTop:             "1px solid rgba(0,212,255,0.07)",
    alignItems:            "center",
    fontSize:              12,
    fontFamily:            "JetBrains Mono",
    transition:            "background 0.15s",
  },
};
