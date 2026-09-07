"""
routes/simulation.py
────────────────────
What-If Scenario Engine endpoints.
Allows users to inject hypothetical loads and see predicted outcomes.
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


class SimulationRequest(BaseModel):
    """Payload for a What-If simulation run."""
    cpu_increase:  float = Field(0.0, ge=0, le=60,  description="Extra CPU % to simulate")
    mem_increase:  float = Field(0.0, ge=0, le=40,  description="Extra Memory % to simulate")
    new_processes: int   = Field(0,   ge=0, le=100, description="Number of extra processes")


@router.post("/run")
async def run_simulation(request: Request, body: SimulationRequest):
    """
    Run the digital twin simulation.
    Injects the specified load delta into the current history,
    re-runs the ML model, and returns simulated vs baseline predictions.
    """
    collector  = request.app.state.collector
    ml_service = request.app.state.ml_service

    if not ml_service.is_trained:
        raise HTTPException(status_code=503, detail="ML model not trained yet. Wait for more data.")

    history = collector.get_history()
    result  = ml_service.simulate(
        history,
        cpu_increase  = body.cpu_increase,
        mem_increase  = body.mem_increase,
        new_processes = body.new_processes,
    )

    if result is None:
        raise HTTPException(status_code=503, detail="Simulation failed")

    # Add human-readable suggestion based on risk level
    suggestions = {
        "LOW":    "System can handle this workload safely. No action required.",
        "MEDIUM": "Consider closing background processes before adding this load.",
        "HIGH":   "WARNING: This workload will likely cause system instability. "
                  "Terminate high-CPU processes and increase swap before proceeding.",
    }
    result["suggestion"] = suggestions[result["risk_level"]]
    return result


@router.get("/presets")
async def get_presets():
    """Return built-in simulation preset definitions."""
    return {
        "presets": [
            {"name": "Gaming",    "cpu_increase": 40, "mem_increase": 20, "new_processes": 15},
            {"name": "Coding",    "cpu_increase": 20, "mem_increase": 15, "new_processes": 8},
            {"name": "Video Edit","cpu_increase": 55, "mem_increase": 30, "new_processes": 5},
            {"name": "Idle",      "cpu_increase": 0,  "mem_increase": 0,  "new_processes": 0},
        ]
    }
