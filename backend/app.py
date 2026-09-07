"""
SysTwin AI — Backend Entry Point
Boots the FastAPI server, registers all routers, and initializes
the ML model service and real-time data collector.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routes.metrics import router as metrics_router
from routes.prediction import router as prediction_router
from routes.simulation import router as simulation_router
from routes.alerts import router as alerts_router
from services.collector import MetricsCollector
from services.ml_service import MLService

# ── App Init ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SysTwin AI",
    description="AI-Powered Digital Twin OS Monitor",
    version="1.0.0"
)

# Allow React frontend on localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global Services ─────────────────────────────────────────────────────────
collector = MetricsCollector(history_size=300)   # 5-minute history at 1s intervals
ml_service = MLService()


@app.on_event("startup")
async def startup_event():
    """Initialize background collection and train the initial ML model."""
    collector.start()                    # Start psutil polling in background thread
    initial_data = collector.get_history()
    if len(initial_data["cpu"]) >= 30:
        ml_service.train(initial_data)   # Train on any loaded historical data


@app.on_event("shutdown")
async def shutdown_event():
    collector.stop()


# ── Route Registration ──────────────────────────────────────────────────────
app.include_router(metrics_router,    prefix="/api/metrics",    tags=["Metrics"])
app.include_router(prediction_router, prefix="/api/prediction", tags=["Prediction"])
app.include_router(simulation_router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(alerts_router,     prefix="/api/alerts",     tags=["Alerts"])


# Inject shared services into routers via app state
app.state.collector  = collector
app.state.ml_service = ml_service


@app.get("/api/health")
def health_check():
    return {"status": "ok", "model_trained": ml_service.is_trained}


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
