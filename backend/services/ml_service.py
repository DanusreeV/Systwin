"""
services/ml_service.py
──────────────────────
Machine Learning Prediction Engine for SysTwin AI.

Architecture:
  • Primary model: Linear Regression (scikit-learn) — fast, interpretable
  • Feature engineering: lag features + rolling stats → horizon prediction
  • Optional: LSTM via TensorFlow (uncomment the TF block if available)

Training input:  rolling history of cpu/memory readings
Training output: value N steps ahead (regression target)

Prediction:      feed current window → get next 7 values (0..30 min)
"""

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score
from typing import Dict, List, Optional


# Number of past data points used as features per prediction
WINDOW_SIZE  = 20
# How many steps (minutes) ahead to predict
PRED_HORIZON = 7
# Target offset: predict N seconds ahead (60 = 1 minute per step)
STEP_SECONDS = 60 * 5   # 5-minute steps → 30-minute horizon


class MLService:
    """
    Wraps two LinearRegression models (CPU + Memory) and exposes
    train / predict / simulate methods.
    """

    def __init__(self):
        self.cpu_model   = LinearRegression()
        self.mem_model   = LinearRegression()
        self.cpu_scaler  = StandardScaler()
        self.mem_scaler  = StandardScaler()

        self.is_trained  = False
        self.train_r2_cpu = 0.0
        self.train_r2_mem = 0.0
        self.n_samples    = 0

    # ── Feature Engineering ───────────────────────────────────────────────

    @staticmethod
    def _make_features(series: List[float], window: int = WINDOW_SIZE) -> np.ndarray:
        """
        Convert a 1-D time series into a 2-D feature matrix.
        Each row = [lag_1 … lag_W, rolling_mean_5, rolling_std_5, trend_slope]
        """
        arr = np.array(series, dtype=float)
        X, y = [], []

        for i in range(window, len(arr) - 1):
            window_vals = arr[i - window:i]
            roll5 = window_vals[-5:]
            features = list(window_vals)          # lag features
            features.append(float(np.mean(roll5)))    # rolling mean
            features.append(float(np.std(roll5)))     # rolling std
            # Linear trend slope of last 10 points
            xs = np.arange(10)
            ys = window_vals[-10:]
            slope = np.polyfit(xs, ys, 1)[0]
            features.append(float(slope))
            X.append(features)
            y.append(arr[i + 1])                  # next-step target

        return np.array(X), np.array(y)

    # ── Training ──────────────────────────────────────────────────────────

    def train(self, history: Dict[str, List]) -> Dict:
        """
        Train both models on the current history buffer.
        Returns a dict with training metrics.
        """
        cpu_series = history.get("cpu", [])
        mem_series = history.get("memory", [])

        min_required = WINDOW_SIZE + 10
        if len(cpu_series) < min_required or len(mem_series) < min_required:
            return {"trained": False, "reason": f"Need at least {min_required} samples"}

        # Build feature matrices
        X_cpu, y_cpu = self._make_features(cpu_series)
        X_mem, y_mem = self._make_features(mem_series)

        # Scale features
        X_cpu_s = self.cpu_scaler.fit_transform(X_cpu)
        X_mem_s = self.mem_scaler.fit_transform(X_mem)

        # Fit models
        self.cpu_model.fit(X_cpu_s, y_cpu)
        self.mem_model.fit(X_mem_s, y_mem)

        # Evaluate on training set (in-sample R²)
        self.train_r2_cpu = round(r2_score(y_cpu, self.cpu_model.predict(X_cpu_s)), 4)
        self.train_r2_mem = round(r2_score(y_mem, self.mem_model.predict(X_mem_s)), 4)
        self.n_samples    = len(X_cpu)
        self.is_trained   = True

        return {
            "trained":   True,
            "n_samples": self.n_samples,
            "r2_cpu":    self.train_r2_cpu,
            "r2_mem":    self.train_r2_mem,
        }

    # ── Prediction ────────────────────────────────────────────────────────

    def _predict_series(self, series: List[float], model, scaler,
                        horizon: int = PRED_HORIZON) -> List[float]:
        """
        Iteratively predict `horizon` steps ahead.
        Each predicted value is appended to the working series and used
        as a lag feature for the next prediction (auto-regressive).
        """
        working = list(series[-WINDOW_SIZE - 10:])   # keep extra history
        predictions = []

        for _ in range(horizon):
            window_vals = working[-WINDOW_SIZE:]
            roll5       = window_vals[-5:]
            xs          = np.arange(10)
            ys          = window_vals[-10:]
            slope       = float(np.polyfit(xs, ys, 1)[0])

            features = window_vals + [
                float(np.mean(roll5)),
                float(np.std(roll5)),
                slope,
            ]
            X = scaler.transform([features])
            pred = float(model.predict(X)[0])
            pred = max(0.0, min(100.0, pred))       # clamp to [0,100]
            predictions.append(round(pred, 1))
            working.append(pred)                    # feed back in

        return predictions

    def predict(self, history: Dict[str, List]) -> Optional[Dict]:
        """
        Generate next PRED_HORIZON predictions for CPU and memory.
        Returns None if models are not trained.
        """
        if not self.is_trained:
            return None

        cpu_preds = self._predict_series(
            history["cpu"], self.cpu_model, self.cpu_scaler
        )
        mem_preds = self._predict_series(
            history["memory"], self.mem_model, self.mem_scaler
        )

        labels = [f"+{i*5}m" for i in range(PRED_HORIZON)]
        labels[0] = "now"

        return {
            "labels":       labels,
            "cpu":          cpu_preds,
            "memory":       mem_preds,
            "r2_cpu":       self.train_r2_cpu,
            "r2_mem":       self.train_r2_mem,
            "n_samples":    self.n_samples,
            "model":        "LinearRegression",
        }

    # ── What-If Simulation ────────────────────────────────────────────────

    def simulate(
        self,
        history: Dict[str, List],
        cpu_increase: float = 0.0,
        mem_increase: float = 0.0,
        new_processes: int  = 0,
    ) -> Optional[Dict]:
        """
        Digital Twin simulation: inject hypothetical load into the current
        history snapshot, then run the prediction model on the modified data.

        cpu_increase:  additional CPU % to inject (0–60)
        mem_increase:  additional memory % to inject (0–40)
        new_processes: additional processes (each adds ~0.15% CPU + ~0.08% RAM)
        """
        if not self.is_trained:
            return None

        proc_cpu_factor = new_processes * 0.15
        proc_mem_factor = new_processes * 0.08

        # Modify the last WINDOW_SIZE+10 values to reflect simulated load
        cpu_modified = [
            min(100.0, v + cpu_increase + proc_cpu_factor)
            for v in history["cpu"]
        ]
        mem_modified = [
            min(100.0, v + mem_increase + proc_mem_factor)
            for v in history["memory"]
        ]

        sim_cpu = self._predict_series(cpu_modified, self.cpu_model, self.cpu_scaler)
        sim_mem = self._predict_series(mem_modified, self.mem_model, self.mem_scaler)

        # Baseline (unmodified) for comparison
        base_cpu = self._predict_series(history["cpu"], self.cpu_model, self.cpu_scaler)
        base_mem = self._predict_series(history["memory"], self.mem_model, self.mem_scaler)

        labels = ["now"] + [f"+{i*5}m" for i in range(1, PRED_HORIZON)]

        # Risk scoring: 0–100
        peak_cpu = max(sim_cpu)
        peak_mem = max(sim_mem)
        risk_score = int(min(100, peak_cpu * 0.4 + peak_mem * 0.35 + new_processes * 0.5))
        risk_level = "LOW" if risk_score < 35 else "MEDIUM" if risk_score < 65 else "HIGH"

        return {
            "labels":       labels,
            "sim_cpu":      sim_cpu,
            "sim_mem":      sim_mem,
            "base_cpu":     base_cpu,
            "base_mem":     base_mem,
            "risk_score":   risk_score,
            "risk_level":   risk_level,
            "peak_cpu":     round(peak_cpu, 1),
            "peak_mem":     round(peak_mem, 1),
        }
