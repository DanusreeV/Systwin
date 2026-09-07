"""
routes/alerts.py
────────────────
Alert & Decision System endpoints.
Evaluates current metrics + ML forecast against configurable thresholds
and returns a structured alert list with suggestions.
"""

from fastapi import APIRouter, Request
from datetime import datetime

router = APIRouter()

# Configurable thresholds (could be moved to a config file / env vars)
THRESHOLDS = {
    "cpu_current":   85.0,
    "cpu_predicted": 75.0,
    "mem_current":   85.0,
    "mem_predicted": 80.0,
    "process_count": 400,
}


def _health_score(cpu: float, mem: float, disk: float, procs: int) -> int:
    """
    Composite health score 0–100.
    Weighted: CPU 35%, Memory 35%, Disk 15%, Processes 15%
    """
    cpu_score  = max(0, 100 - cpu)   * 0.35
    mem_score  = max(0, 100 - mem)   * 0.35
    disk_score = max(0, 100 - disk)  * 0.15
    proc_score = max(0, 100 - min(100, procs / 5)) * 0.15
    return int(cpu_score + mem_score + disk_score + proc_score)


@router.get("/")
async def get_alerts(request: Request):
    """
    Evaluate system state and return active alerts + health score.
    """
    collector  = request.app.state.collector
    ml_service = request.app.state.ml_service

    snapshot = collector.get_snapshot()
    history  = collector.get_history(last_n=60)
    now      = datetime.utcnow().isoformat()

    alerts = []

    # ── Real-time alerts ──────────────────────────────────────────────────

    if snapshot["cpu"] > THRESHOLDS["cpu_current"]:
        alerts.append({
            "id":       "cpu-live-high",
            "severity": "DANGER",
            "title":    "Critical CPU Usage",
            "message":  f"CPU at {snapshot['cpu']}% — exceeds {THRESHOLDS['cpu_current']}% threshold.",
            "suggestion": "Immediately terminate high-CPU processes. Use top/htop to identify offenders.",
            "timestamp": now,
        })

    if snapshot["memory"] > THRESHOLDS["mem_current"]:
        alerts.append({
            "id":       "mem-live-high",
            "severity": "DANGER",
            "title":    "Critical Memory Usage",
            "message":  f"Memory at {snapshot['memory']}% — swap usage imminent.",
            "suggestion": "Free memory by stopping unused services. Check for memory leaks with pmap.",
            "timestamp": now,
        })

    # ── Prediction-based alerts ───────────────────────────────────────────

    if ml_service.is_trained:
        forecast = ml_service.predict(history)
        if forecast:
            peak_cpu = max(forecast["cpu"])
            peak_mem = max(forecast["memory"])

            if peak_cpu > THRESHOLDS["cpu_predicted"]:
                alerts.append({
                    "id":       "cpu-pred-warn",
                    "severity": "WARNING",
                    "title":    "CPU Threshold Breach Predicted",
                    "message":  f"Model predicts CPU will reach {peak_cpu:.1f}% within 30 minutes.",
                    "suggestion": "Proactively reduce load: close background processes, pause syncs.",
                    "timestamp": now,
                    "predicted_peak": peak_cpu,
                })

            if peak_mem > THRESHOLDS["mem_predicted"]:
                alerts.append({
                    "id":       "mem-pred-warn",
                    "severity": "WARNING",
                    "title":    "Memory Pressure Incoming",
                    "message":  f"Model forecasts memory reaching {peak_mem:.1f}% — near swap threshold.",
                    "suggestion": "Clear page cache: sudo sysctl vm.drop_caches=1. Stop idle containers.",
                    "timestamp": now,
                    "predicted_peak": peak_mem,
                })

    # ── Process count alert ───────────────────────────────────────────────

    if snapshot["processes"] > THRESHOLDS["process_count"]:
        alerts.append({
            "id":       "proc-count-high",
            "severity": "INFO",
            "title":    "High Process Count",
            "message":  f"{snapshot['processes']} processes active. Check for zombie processes.",
            "suggestion": "Run: ps aux | grep Z | awk '{print $2}' | xargs kill -9",
            "timestamp": now,
        })

    # ── Health score ──────────────────────────────────────────────────────

    health = _health_score(
        snapshot["cpu"], snapshot["memory"],
        snapshot["disk"], snapshot["processes"]
    )
    health_label = (
        "Excellent" if health >= 90 else
        "Good"      if health >= 70 else
        "Moderate"  if health >= 50 else
        "Poor"      if health >= 30 else
        "Critical"
    )

    return {
        "alerts":       alerts,
        "alert_count":  len(alerts),
        "health_score": health,
        "health_label": health_label,
        "snapshot":     snapshot,
        "thresholds":   THRESHOLDS,
    }


@router.get("/health-score")
async def get_health_score(request: Request):
    """Lightweight endpoint — just returns the health score."""
    collector = request.app.state.collector
    snap = collector.get_snapshot()
    score = _health_score(snap["cpu"], snap["memory"], snap["disk"], snap["processes"])
    return {"health_score": score, "cpu": snap["cpu"], "memory": snap["memory"]}
