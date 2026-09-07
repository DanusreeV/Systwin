"""
routes/metrics.py
─────────────────
REST endpoints for real-time system metrics.

GET /api/metrics/snapshot   → current CPU, memory, disk, processes
GET /api/metrics/history    → rolling history arrays (up to 300 points)
GET /api/metrics/processes  → top-N processes with CPU/mem breakdown
POST /api/metrics/retrain   → trigger ML model retraining on latest data
"""

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/snapshot")
async def get_snapshot(request: Request):
    """Current instantaneous system state."""
    collector = request.app.state.collector
    return collector.get_snapshot()


@router.get("/history")
async def get_history(request: Request, last_n: int = 60):
    """
    Rolling history.
    last_n: how many most-recent samples to return (default 60 = last 60s).
    """
    collector = request.app.state.collector
    return collector.get_history(last_n=last_n)


@router.get("/processes")
async def get_processes(request: Request, top: int = 10):
    """
    Top-N processes sorted by CPU usage.
    Includes root cause analysis fields (cpu%, mem%, status).
    """
    collector = request.app.state.collector
    procs = collector.get_top_processes(n=top)

    # Annotate with root-cause tags
    for p in procs:
        if p["cpu"] > 15:
            p["rca_tag"] = "HIGH_CPU"
        elif p["memory"] > 10:
            p["rca_tag"] = "HIGH_MEM"
        else:
            p["rca_tag"] = "NORMAL"

    return {"processes": procs, "total_shown": len(procs)}


@router.post("/retrain")
async def retrain(request: Request):
    """
    Force-retrain the ML models on the latest history buffer.
    Useful after a significant workload shift.
    """
    collector  = request.app.state.collector
    ml_service = request.app.state.ml_service
    history    = collector.get_history()
    result     = ml_service.train(history)
    return result
