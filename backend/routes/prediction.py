"""
routes/prediction.py
────────────────────
Prediction endpoints — returns ML-generated forecasts for CPU and memory.
"""

from fastapi import APIRouter, Request, HTTPException

router = APIRouter()


@router.get("/forecast")
async def get_forecast(request: Request):
    """
    Run the ML model and return 30-minute forecasts.
    Triggers auto-training if model is not yet trained.
    """
    collector  = request.app.state.collector
    ml_service = request.app.state.ml_service
    history    = collector.get_history()

    # Auto-train if needed
    if not ml_service.is_trained:
        result = ml_service.train(history)
        if not result.get("trained"):
            raise HTTPException(
                status_code=503,
                detail=f"Not enough data to train model: {result.get('reason')}"
            )

    forecast = ml_service.predict(history)
    if forecast is None:
        raise HTTPException(status_code=503, detail="Model not ready")

    return forecast


@router.get("/compare")
async def get_compare(request: Request, last_n: int = 20):
    """
    Compare actual vs model-predicted values over the last N samples.
    Used for the accuracy chart on the prediction panel.
    """
    collector  = request.app.state.collector
    ml_service = request.app.state.ml_service

    history = collector.get_history(last_n=last_n + 20)  # extra for feature window

    if not ml_service.is_trained:
        raise HTTPException(status_code=503, detail="Model not trained yet")

    # Walk through actual data and generate predictions at each step
    cpu_actual, cpu_predicted = [], []
    mem_actual, mem_predicted = [], []

    cpu_series = history["cpu"]
    mem_series = history["memory"]
    min_w = 22  # minimum window needed

    for i in range(min_w, len(cpu_series)):
        partial_history = {
            "cpu":    cpu_series[:i],
            "memory": mem_series[:i],
        }
        preds = ml_service.predict(partial_history)
        if preds:
            cpu_actual.append(round(cpu_series[i], 1))
            cpu_predicted.append(preds["cpu"][1])   # +5 min prediction
            mem_actual.append(round(mem_series[i], 1))
            mem_predicted.append(preds["memory"][1])

    # Return last_n points
    return {
        "cpu_actual":    cpu_actual[-last_n:],
        "cpu_predicted": cpu_predicted[-last_n:],
        "mem_actual":    mem_actual[-last_n:],
        "mem_predicted": mem_predicted[-last_n:],
        "r2_cpu":        ml_service.train_r2_cpu,
        "r2_mem":        ml_service.train_r2_mem,
    }
