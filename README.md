# SysTwin AI 🧠
### AI-Powered Digital Twin Operating System Monitor with Predictive Simulation

A full-stack application that monitors real OS performance in real time, predicts future system behaviour using machine learning, and lets you simulate hypothetical workloads through an interactive What-If Scenario Engine — all before the load ever hits your machine.

---



## Quick Start

### 1 · Clone & set up backend

```bash
cd systwin-ai/backend

# Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Seed SQLite with 8 hours of synthetic training data
python ml_model/generate_sample_data.py

# Start the API server
python app.py
# → API running at http://localhost:8000
# → Docs at       http://localhost:8000/docs
```

### 2 · Start frontend

```bash
cd systwin-ai/frontend
npm install
npm run dev
# → App running at http://localhost:3000
```

Open **http://localhost:3000** — the dashboard connects to your machine's real psutil data automatically.

---

## Folder Structure

```
systwin-ai/
├── backend/
│   ├── app.py                        # FastAPI entry point
│   ├── requirements.txt
│   ├── routes/
│   │   ├── metrics.py                # /api/metrics/*
│   │   ├── prediction.py             # /api/prediction/*
│   │   ├── simulation.py             # /api/simulation/*
│   │   └── alerts.py                 # /api/alerts/*
│   ├── services/
│   │   ├── collector.py              # psutil polling + SQLite
│   │   └── ml_service.py             # LinearRegression engine
│   ├── ml_model/
│   │   ├── generate_sample_data.py   # synthetic training data
│   │   └── lstm_model.py             # optional LSTM upgrade
│   └── data/
│       └── metrics.db                # SQLite (auto-created)
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx                   # root layout + routing
        ├── services/
        │   └── api.js                # all API calls
        ├── hooks/
        │   └── useMetrics.js         # shared polling hook
        ├── components/
        │   ├── Charts.jsx            # Line, Bar, Sparkline
        │   └── Cards.jsx             # MetricCard, ProcessTable, etc.
        └── pages/
            ├── Dashboard.jsx         # live metrics + process table
            ├── Prediction.jsx        # forecast + accuracy compare
            ├── Simulation.jsx        # What-If engine
            └── Prediction.jsx        # also exports Alerts
```

---

## API Reference

### Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metrics/snapshot` | Current CPU, memory, disk, process count |
| GET | `/api/metrics/history?last_n=60` | Rolling history arrays |
| GET | `/api/metrics/processes?top=10` | Top-N processes with RCA tags |
| POST | `/api/metrics/retrain` | Force-retrain ML model |

### Prediction

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prediction/forecast` | 30-minute ML forecast (7 data points) |
| GET | `/api/prediction/compare?last_n=20` | Actual vs predicted accuracy |

### Simulation

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/simulation/run` | `{cpu_increase, mem_increase, new_processes}` | Run What-If simulation |
| GET | `/api/simulation/presets` | — | Built-in preset workloads |

**Simulation request example:**
```json
POST /api/simulation/run
{
  "cpu_increase":  40,
  "mem_increase":  20,
  "new_processes": 15
}
```

**Response:**
```json
{
  "labels":     ["now", "+5m", "+10m", "+15m", "+20m", "+25m", "+30m"],
  "base_cpu":   [42, 43, 44, 45, 46, 47, 48],
  "sim_cpu":    [82, 84, 85, 87, 88, 89, 91],
  "base_mem":   [61, 62, 62, 63, 63, 64, 64],
  "sim_mem":    [81, 82, 83, 84, 85, 86, 87],
  "risk_score": 73,
  "risk_level": "HIGH",
  "suggestion": "WARNING: This workload will likely cause system instability..."
}
```

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts/` | All active alerts + health score |
| GET | `/api/alerts/health-score` | Health score only (lightweight) |

---

## ML Model Details

### Linear Regression (default)

**Feature engineering per prediction step:**
- 20 lag values (the last 20 data points)
- 5-sample rolling mean
- 5-sample rolling standard deviation
- Linear trend slope over last 10 points

**Training:** StandardScaler → LinearRegression  
**Inference:** auto-regressive (each predicted value becomes input for the next)  
**Typical R²:** 0.88–0.93 on smooth workloads

### LSTM (optional upgrade)

Install TensorFlow, then swap the model in `app.py`:

```python
from ml_model.lstm_model import LSTMPredictor
app.state.ml_service = LSTMPredictor()
```

Architecture: `LSTM(64) → Dropout(0.1) → LSTM(32) → Dropout(0.1) → Dense(16) → Dense(1)`  
Better for: spiky/bursty workloads, patterns with longer memory  
Requires: ≥200 samples to train well  
Training time: ~20–40s on CPU

---

## What-If Simulation Engine

The simulation engine works by:

1. Taking the current rolling history buffer
2. Adding the specified load delta to every sample: `cpu_modified[i] = cpu[i] + Δcpu + procs * 0.15`
3. Running the ML prediction model on the modified history
4. Comparing simulated trajectory vs baseline trajectory
5. Computing a risk score: `risk = peak_cpu × 0.4 + peak_mem × 0.35 + new_procs × 0.5`

| Risk Score | Level | Meaning |
|-----------|-------|---------|
| 0–34 | LOW | Safe to proceed |
| 35–64 | MEDIUM | Proceed with caution |
| 65–100 | HIGH | Likely to cause instability |

---

## Alert Thresholds

Configurable in `backend/routes/alerts.py`:

```python
THRESHOLDS = {
    "cpu_current":   85.0,   # trigger if current CPU > 85%
    "cpu_predicted": 75.0,   # trigger if predicted CPU > 75%
    "mem_current":   85.0,
    "mem_predicted": 80.0,
    "process_count": 400,
}
```

---

## Health Score Formula

```
health = (100 - cpu) × 0.35
       + (100 - mem) × 0.35
       + (100 - disk) × 0.15
       + (100 - min(100, procs/5)) × 0.15
```

Ranges: Excellent ≥90 · Good ≥70 · Moderate ≥50 · Poor ≥30 · Critical <30

---

## Extending the Project

**Add a new metric (e.g. GPU):**
1. Collect in `services/collector.py` using `pynvml` or `gputil`
2. Expose via a new field in `get_snapshot()` and `get_history()`
3. Add a feature column in `ml_service.py`'s `_make_features()`
4. Add a `MetricCard` in `frontend/src/pages/Dashboard.jsx`

**Switch to PostgreSQL:**
Replace `sqlite3` calls in `collector.py` with `psycopg2` or `asyncpg`.
Set `DB_URL` via environment variable.

**Add authentication:**
```bash
pip install python-jose passlib
```
Use FastAPI's `OAuth2PasswordBearer` — wrap all routers with a `Depends(verify_token)`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Chart.js, react-chartjs-2 |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| ML | scikit-learn (LinearRegression) · TensorFlow/Keras (LSTM, optional) |
| System | psutil |
| Storage | SQLite (default) · PostgreSQL (swap-in) |
| Fonts | Syne (display) · JetBrains Mono (data) |
