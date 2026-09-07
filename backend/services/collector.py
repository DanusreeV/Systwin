"""
services/collector.py
─────────────────────
Background thread that polls psutil every second and maintains a
rolling in-memory history buffer. Also persists snapshots to SQLite.
"""

import threading
import time
import sqlite3
import os
from collections import deque
from datetime import datetime
from typing import Dict, List

import psutil


DB_PATH = os.path.join(os.path.dirname(__file__), "../data/metrics.db")


class MetricsCollector:
    """
    Continuously collects CPU, memory, disk and process data.
    Thread-safe: internal lock guards the deque history.
    """

    def __init__(self, history_size: int = 300):
        self.history_size = history_size
        self._lock = threading.Lock()

        # Rolling history deques (one entry per second)
        self._cpu_history:  deque = deque(maxlen=history_size)
        self._mem_history:  deque = deque(maxlen=history_size)
        self._disk_history: deque = deque(maxlen=history_size)
        self._proc_history: deque = deque(maxlen=history_size)
        self._timestamps:   deque = deque(maxlen=history_size)

        self._thread: threading.Thread | None = None
        self._running = False

        self._init_db()
        self._load_history_from_db()   # Warm up from persisted data

    # ── DB ────────────────────────────────────────────────────────────────

    def _init_db(self):
        """Create SQLite table if it doesn't exist."""
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
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
            conn.execute("CREATE INDEX IF NOT EXISTS idx_ts ON metrics(timestamp)")
            conn.commit()

    def _save_snapshot(self, cpu, mem, disk, procs):
        """Persist a single row to SQLite (non-blocking)."""
        try:
            with sqlite3.connect(DB_PATH) as conn:
                conn.execute(
                    "INSERT INTO metrics (timestamp,cpu,memory,disk,processes) VALUES (?,?,?,?,?)",
                    (datetime.utcnow().isoformat(), cpu, mem, disk, procs)
                )
                conn.commit()
        except Exception:
            pass  # Non-critical — don't crash the collector

    def _load_history_from_db(self):
        """Load the last N rows from SQLite to warm-start the deques."""
        try:
            with sqlite3.connect(DB_PATH) as conn:
                rows = conn.execute(
                    "SELECT timestamp,cpu,memory,disk,processes FROM metrics "
                    "ORDER BY id DESC LIMIT ?", (self.history_size,)
                ).fetchall()
            for ts, cpu, mem, disk, procs in reversed(rows):
                self._timestamps.append(ts)
                self._cpu_history.append(cpu)
                self._mem_history.append(mem)
                self._disk_history.append(disk)
                self._proc_history.append(procs)
        except Exception:
            pass

    # ── Collection Loop ───────────────────────────────────────────────────

    def _collect_once(self):
        """Sample all metrics once and append to history."""
        cpu  = psutil.cpu_percent(interval=None)
        mem  = psutil.virtual_memory().percent
        disk = psutil.disk_usage("/").percent
        procs = len(psutil.pids())

        with self._lock:
            ts = datetime.utcnow().isoformat()
            self._timestamps.append(ts)
            self._cpu_history.append(cpu)
            self._mem_history.append(mem)
            self._disk_history.append(disk)
            self._proc_history.append(procs)

        # Persist every 5th sample (reduce write load)
        if len(self._cpu_history) % 5 == 0:
            self._save_snapshot(cpu, mem, disk, procs)

    def _run(self):
        """Main collector loop — runs until stop() is called."""
        # Prime psutil cpu_percent (first call always returns 0.0)
        psutil.cpu_percent(interval=1)
        while self._running:
            self._collect_once()
            time.sleep(1)

    def start(self):
        """Start background collection thread."""
        if self._thread and self._thread.is_alive():
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)

    # ── Data Access ───────────────────────────────────────────────────────

    def get_snapshot(self) -> Dict:
        """Current system state (one data point)."""
        with self._lock:
            cpu  = self._cpu_history[-1]  if self._cpu_history  else 0.0
            mem  = self._mem_history[-1]  if self._mem_history  else 0.0
            disk = self._disk_history[-1] if self._disk_history else 0.0
            procs = self._proc_history[-1] if self._proc_history else 0

        return {
            "cpu":       round(cpu, 1),
            "memory":    round(mem, 1),
            "disk":      round(disk, 1),
            "processes": procs,
            "timestamp": datetime.utcnow().isoformat(),
        }

    def get_history(self, last_n: int | None = None) -> Dict[str, List]:
        """
        Return rolling history lists.
        last_n: if set, return only the last N samples.
        """
        with self._lock:
            cpu   = list(self._cpu_history)
            mem   = list(self._mem_history)
            disk  = list(self._disk_history)
            procs = list(self._proc_history)
            ts    = list(self._timestamps)

        if last_n:
            cpu, mem, disk, procs, ts = (
                cpu[-last_n:], mem[-last_n:], disk[-last_n:],
                procs[-last_n:], ts[-last_n:]
            )

        return {"cpu": cpu, "memory": mem, "disk": disk,
                "processes": procs, "timestamps": ts}

    def get_top_processes(self, n: int = 10) -> List[Dict]:
        """
        Return top-N processes sorted by CPU usage.
        Includes root cause analysis fields.
        """
        procs = []
        for p in psutil.process_iter(
            ["pid", "name", "cpu_percent", "memory_percent", "status", "create_time"]
        ):
            try:
                info = p.info
                if info["cpu_percent"] is None:
                    continue
                procs.append({
                    "pid":    info["pid"],
                    "name":   info["name"][:30],
                    "cpu":    round(info["cpu_percent"], 1),
                    "memory": round(info["memory_percent"], 1),
                    "status": info["status"],
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        # Sort by CPU desc, take top-N
        procs.sort(key=lambda x: x["cpu"], reverse=True)
        return procs[:n]
