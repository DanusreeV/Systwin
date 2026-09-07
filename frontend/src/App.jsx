// src/App.jsx
// Root component — handles layout, sidebar navigation, and page routing.

import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Simulation from "./pages/Simulation";
import { Prediction, Alerts } from "./pages/Prediction";
import { api } from "./services/api";

const pages = {
  dashboard:  { label: "Dashboard",    icon: "◈", title: "System Dashboard",       meta: "Live monitoring · Updated every 2s" },
  prediction: { label: "Predictions",  icon: "◎", title: "ML Prediction Engine",   meta: "Linear Regression · 30-minute forecast window" },
  simulation: { label: "Simulation",   icon: "⬡", title: "What-If Scenario Engine", meta: "Digital twin · Hypothetical load simulation" },
  alerts:     { label: "Alerts",       icon: "◇", title: "Alert & Decision Center", meta: "Threshold monitoring · Root cause analysis" },
};

export default function App() {
  const [page,   setPage]   = useState("dashboard");
  const [health, setHealth] = useState(87);
  const [tick,   setTick]   = useState(0);
  const [alerts, setAlerts] = useState(3);
  const [uptime, setUptime] = useState(0);

  // Clock and uptime
  useEffect(() => {
    const id = setInterval(() => { setUptime(u => u + 1); setTick(t => t + 1); }, 1000);
    return () => clearInterval(id);
  }, []);

  // Poll alert count
  useEffect(() => {
    api.alerts().then(d => setAlerts(d.alert_count ?? 3)).catch(() => {});
  }, [Math.floor(tick / 5)]);

  const hh = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const mm = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const ss = String(uptime % 60).padStart(2, "0");
  const uptimeStr = `${hh}:${mm}:${ss}`;
  const now = new Date().toLocaleTimeString("en-US", { hour12: false });

  const healthColor = health >= 70 ? "#10b981" : health >= 45 ? "#f59e0b" : "#ef4444";
  const healthLabel = health >= 70 ? "HEALTHY" : health >= 45 ? "MODERATE" : "CRITICAL";

  return (
    <div style={S.app}>
      {/* Scanlines overlay */}
      <div style={S.scanline} />

      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoTitle}>SysTwin<span style={{ color: "#94a3b8", fontWeight: 400 }}> AI</span></div>
          <div style={S.logoSub}><Dot /> DIGITAL TWIN ACTIVE</div>
        </div>

        <nav style={{ padding: "16px 0", flex: 1 }}>
          {Object.entries(pages).map(([key, { label, icon }]) => (
            <div key={key} style={{ ...S.navItem, ...(page === key ? S.navActive : {}) }}
              onClick={() => setPage(key)}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              {label}
              {key === "alerts" && alerts > 0 && (
                <span style={S.badge}>{alerts}</span>
              )}
            </div>
          ))}
        </nav>

        <div style={S.sysInfo}>
          {[["OS", "Linux 6.1"], ["Cores", "8 vCPU"], ["RAM", "16 GB"], ["Uptime", uptimeStr], ["Model", "LinearReg"]].map(([k, v]) => (
            <div key={k} style={S.sysRow}><span>{k}</span><span style={{ color: "#00d4ff" }}>{v}</span></div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div style={S.main}>
        {/* Topbar */}
        <header style={S.topbar}>
          <div>
            <div style={S.topTitle}>{pages[page].title}</div>
            <div style={S.topMeta}>{pages[page].meta}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#475569", fontFamily: "JetBrains Mono" }}>{now}</span>
            <div style={{ ...S.healthBadge, borderColor: healthColor, color: healthColor, background: healthColor + "14" }}>
              <Dot color={healthColor} pulse /> {healthLabel} · {health}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={S.content}>
          {page === "dashboard"  && <Dashboard  onHealthChange={setHealth} />}
          {page === "prediction" && <Prediction />}
          {page === "simulation" && <Simulation />}
          {page === "alerts"     && <Alerts />}
        </div>
      </div>
    </div>
  );
}

function Dot({ color = "#10b981", pulse = false }) {
  return (
    <div style={{
      width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block",
      marginRight: 6, flexShrink: 0,
      animation: pulse ? "none" : "pulse 2s infinite",
      boxShadow: `0 0 6px ${color}`,
    }} />
  );
}

const S = {
  app:      { display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh", background: "#0a0e1a", color: "#e2e8f0", fontFamily: "'Syne', 'Segoe UI', sans-serif", position: "relative" },
  scanline: { position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,212,255,0.012) 2px,rgba(0,212,255,0.012) 4px)", pointerEvents: "none", zIndex: 0 },
  sidebar:  { background: "#0f1628", borderRight: "1px solid rgba(0,212,255,0.12)", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 },
  logo:     { padding: "24px 20px 20px", borderBottom: "1px solid rgba(0,212,255,0.12)" },
  logoTitle:{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px", color: "#00d4ff" },
  logoSub:  { fontSize: 10, color: "#475569", fontFamily: "JetBrains Mono", marginTop: 4, letterSpacing: "1px" },
  navItem:  { display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#94a3b8", borderLeft: "2px solid transparent", transition: "all .2s", letterSpacing: "0.3px" },
  navActive:{ color: "#00d4ff", borderLeftColor: "#00d4ff", background: "rgba(0,212,255,0.06)" },
  badge:    { marginLeft: "auto", background: "#ef4444", color: "#fff", fontSize: 9, padding: "1px 6px", borderRadius: 8, fontFamily: "JetBrains Mono" },
  sysInfo:  { padding: "16px 20px", borderTop: "1px solid rgba(0,212,255,0.12)", fontFamily: "JetBrains Mono", fontSize: 10, color: "#475569" },
  sysRow:   { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  main:     { display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 },
  topbar:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", borderBottom: "1px solid rgba(0,212,255,0.12)", background: "#0f1628", position: "sticky", top: 0, zIndex: 10 },
  topTitle: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px" },
  topMeta:  { fontSize: 11, color: "#475569", fontFamily: "JetBrains Mono", marginTop: 2 },
  healthBadge: { display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 600, fontFamily: "JetBrains Mono" },
  content:  { padding: "24px 28px", overflowY: "auto", flex: 1 },
};
