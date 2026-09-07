"""
ml_model/generate_sample_data.py
─────────────────────────────────
Generates realistic synthetic OS metric time-series data for ML training.
Run this script to pre-populate the SQLite database before starting the app:

  python ml_model/generate_sample_data.py

Simulates:
  • Daily usage cycles (high during work hours, low at night)
  • Occasional CPU spikes (render jobs, backups)
  • Gradual memory growth (memory leak pattern)
  • Random noise
"""

import sqlite3
import numpy as np
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/metrics.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

np.random.seed(42)

# ── Simulation parameters ────────────────────────────────────────────────────
HOURS     = 8      # how many hours of history to generate
INTERVAL  = 1      # seconds between samples
N_SAMPLES = HOURS * 3600 // INTERVAL

print(f"Generating {N_SAMPLES:,} samples ({HOURS}h history)...")

t = np.linspace(0, HOURS * 2 * np.pi, N_SAMPLES)

# ── CPU model ────────────────────────────────────────────────────────────────
# Base: sinusoidal work cycle (peaks around mid-day)
cpu_base = 35 + 20 * np.sin(t / (HOURS * 2) * np.pi)

# Add hourly micro-cycles
cpu_micro = 5 * np.sin(t * 4)

# Random spikes (simulate render/backup jobs every ~45 min)
spikes = np.zeros(N_SAMPLES)
spike_positions = np.random.choice(N_SAMPLES, size=HOURS * 2, replace=False)
for pos in spike_positions:
    width = np.random.randint(60, 600)   # 1–10 minutes
    height = np.random.uniform(20, 45)
    start = pos
    end   = min(pos + width, N_SAMPLES)
    spikes[start:end] += height * np.exp(-np.linspace(0, 3, end - start))

cpu = np.clip(cpu_base + cpu_micro + spikes + np.random.normal(0, 3, N_SAMPLES), 2, 98)

# ── Memory model ─────────────────────────────────────────────────────────────
# Slower trend: starts at 45%, grows to 65% (simulates gradual heap growth)
mem_trend  = np.linspace(45, 65, N_SAMPLES)
mem_cycles = 4 * np.sin(t * 0.5)                         # slow oscillation
mem_noise  = np.random.normal(0, 1.5, N_SAMPLES)

# Periodic GC drops (memory falls suddenly, then climbs again)
gc_events = np.zeros(N_SAMPLES)
gc_positions = np.arange(0, N_SAMPLES, 1800)             # every 30 min
for pos in gc_positions:
    if pos < N_SAMPLES:
        drop = np.random.uniform(5, 12)
        recovery_len = min(600, N_SAMPLES - pos)
        gc_events[pos:pos+recovery_len] -= drop * np.exp(-np.linspace(0, 4, recovery_len))

memory = np.clip(mem_trend + mem_cycles + gc_events + mem_noise, 15, 95)

# ── Disk (stable) ─────────────────────────────────────────────────────────
disk = np.clip(55 + np.random.normal(0, 1, N_SAMPLES), 40, 80)

# ── Processes ──────────────────────────────────────────────────────────────
procs = np.round(220 + 60 * np.sin(t * 0.3) + np.random.normal(0, 10, N_SAMPLES)).astype(int)
procs = np.clip(procs, 100, 500)

# ── Write to SQLite ──────────────────────────────────────────────────────────
start_time = datetime.utcnow() - timedelta(hours=HOURS)

with sqlite3.connect(DB_PATH) as conn:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT    NOT NULL,
            cpu       REAL    NOT NULL,
            memory    REAL    NOT NULL,
            disk      REAL    NOT NULL,
            processes INTEGER NOT NULL
        )
    """)
    conn.execute("DELETE FROM metrics")   # clear old data

    rows = [
        (
            (start_time + timedelta(seconds=i * INTERVAL)).isoformat(),
            round(float(cpu[i]), 2),
            round(float(memory[i]), 2),
            round(float(disk[i]), 2),
            int(procs[i]),
        )
        for i in range(N_SAMPLES)
    ]

    conn.executemany(
        "INSERT INTO metrics (timestamp,cpu,memory,disk,processes) VALUES (?,?,?,?,?)",
        rows
    )
    conn.commit()

print(f"✓ Inserted {len(rows):,} rows into {DB_PATH}")
print(f"  CPU range:    {cpu.min():.1f}% – {cpu.max():.1f}%")
print(f"  Memory range: {memory.min():.1f}% – {memory.max():.1f}%")
print(f"  Process range:{procs.min()} – {procs.max()}")
print("\nRun 'python backend/app.py' to start SysTwin AI.")
