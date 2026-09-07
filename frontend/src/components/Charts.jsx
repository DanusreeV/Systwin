// src/components/Charts.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable Chart.js wrappers with consistent SysTwin AI theming.
// All charts are dark-mode, scanline-safe, and responsive.

import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend
);

// ── Shared defaults ──────────────────────────────────────────────────────────

const GRID_COLOR   = "rgba(255,255,255,0.04)";
const TICK_COLOR   = "#475569";
const TOOLTIP_OPTS = {
  backgroundColor: "#0f1628",
  borderColor:     "rgba(0,212,255,0.3)",
  borderWidth:     1,
  titleColor:      "#94a3b8",
  bodyColor:       "#e2e8f0",
  titleFont:       { size: 10 },
  bodyFont:        { family: "JetBrains Mono", size: 11 },
  padding:         8,
};

function baseOptions(yMin = 0, yMax = 100) {
  return {
    responsive:           true,
    maintainAspectRatio:  false,
    animation:            { duration: 300 },
    plugins: {
      legend:  { display: false },
      tooltip: { ...TOOLTIP_OPTS, mode: "index", intersect: false },
    },
    scales: {
      x: {
        grid:  { color: GRID_COLOR },
        ticks: { color: TICK_COLOR, font: { size: 9, family: "JetBrains Mono" }, maxRotation: 0 },
      },
      y: {
        grid:  { color: GRID_COLOR },
        ticks: { color: TICK_COLOR, font: { size: 9, family: "JetBrains Mono" } },
        min: yMin, max: yMax,
      },
    },
  };
}

// ── Dataset helpers ──────────────────────────────────────────────────────────

export function lineDS(data, color, label = "", { fill = true, dash = false } = {}) {
  return {
    label,
    data,
    borderColor:     color,
    backgroundColor: fill ? color + "18" : "transparent",
    borderWidth:     dash ? 1 : 1.5,
    borderDash:      dash ? [5, 4] : [],
    fill,
    tension:         0.4,
    pointRadius:     0,
    pointHoverRadius: 3,
    pointHoverBackgroundColor: color,
  };
}

// ── LineChart ────────────────────────────────────────────────────────────────

/**
 * Generic line chart.
 * datasets: array of { data, color, label, fill?, dash? }
 * threshold?: draw a dashed horizontal line at this value
 */
export function LineChart({ labels, datasets, height = 160, yMin = 0, yMax = 100, threshold }) {
  const builtDS = datasets.map(({ data, color, label = "", fill, dash }) =>
    lineDS(data, color, label, { fill, dash })
  );

  if (threshold !== undefined) {
    builtDS.push(lineDS(
      Array(labels.length).fill(threshold),
      "#ef444455", "Threshold",
      { fill: false, dash: true }
    ));
  }

  return (
    <div style={{ position: "relative", height }}>
      <Line
        data={{ labels, datasets: builtDS }}
        options={baseOptions(yMin, yMax)}
      />
    </div>
  );
}

// ── BarChart ─────────────────────────────────────────────────────────────────

export function BarChart({ labels, datasets, height = 160, yMin = 0, yMax = 100, horizontal = false }) {
  const builtDS = datasets.map(({ data, color, label = "" }) => ({
    label,
    data,
    backgroundColor: color + "cc",
    borderColor:     color,
    borderWidth:     1,
    borderRadius:    3,
  }));

  const opts = {
    ...baseOptions(yMin, yMax),
    indexAxis: horizontal ? "y" : "x",
  };

  return (
    <div style={{ position: "relative", height }}>
      <Bar data={{ labels, datasets: builtDS }} options={opts} />
    </div>
  );
}

// ── MiniSparkline ─────────────────────────────────────────────────────────────

/**
 * Tiny inline sparkline — no axes, no tooltip, just the shape.
 * Used inside metric cards to show trend at a glance.
 */
export function Sparkline({ data, color, height = 40 }) {
  const labels = data.map(() => "");
  return (
    <div style={{ position: "relative", height }}>
      <Line
        data={{ labels, datasets: [lineDS(data, color, "", { fill: true })] }}
        options={{
          responsive:          true,
          maintainAspectRatio: false,
          animation:           { duration: 200 },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false },
          },
        }}
      />
    </div>
  );
}

// ── Legend row ────────────────────────────────────────────────────────────────

export function ChartLegend({ items }) {
  return (
    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
      {items.map(({ color, label }) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#94a3b8" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  );
}
