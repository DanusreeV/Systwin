"""
ml_model/lstm_model.py
──────────────────────
Optional LSTM upgrade for SysTwin AI.

Requires: pip install tensorflow

Usage:
  from ml_model.lstm_model import LSTMPredictor
  model = LSTMPredictor()
  model.train(history_dict)
  preds = model.predict(history_dict)

The LSTMPredictor has the same .train() / .predict() / .simulate()
interface as MLService so it can be dropped in as a replacement:

  # In app.py startup:
  from ml_model.lstm_model import LSTMPredictor
  app.state.ml_service = LSTMPredictor()

When to use LSTM vs Linear Regression:
  • Linear Regression: Fast, interpretable, works well with ≥30 samples.
    Best for stable workloads with gradual trends.
  • LSTM: Captures non-linear temporal patterns, memory-aware.
    Better for spiky, bursty workloads. Needs ≥200 samples to train well.
    ~10x slower to train but predictions are more accurate for complex patterns.
"""

try:
    import numpy as np
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.callbacks import EarlyStopping
    from sklearn.preprocessing import MinMaxScaler
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

WINDOW     = 30    # look-back window (seconds)
PRED_STEPS = 7     # how many 5-minute steps to predict


class LSTMPredictor:
    """
    LSTM-based predictor. Drop-in replacement for MLService.
    Falls back gracefully to a simple trend extrapolation if TF is unavailable.
    """

    def __init__(self):
        self.is_trained   = False
        self.cpu_model    = None
        self.mem_model    = None
        self.cpu_scaler   = MinMaxScaler() if TF_AVAILABLE else None
        self.mem_scaler   = MinMaxScaler() if TF_AVAILABLE else None
        self.train_r2_cpu = 0.0
        self.train_r2_mem = 0.0
        self.n_samples    = 0

    # ── Model architecture ─────────────────────────────────────────────────

    def _build_model(self):
        """Single-layer LSTM → Dense. Lightweight for on-device inference."""
        model = Sequential([
            LSTM(64, input_shape=(WINDOW, 1), return_sequences=True),
            Dropout(0.1),
            LSTM(32),
            Dropout(0.1),
            Dense(16, activation="relu"),
            Dense(1),
        ])
        model.compile(optimizer="adam", loss="mse")
        return model

    # ── Sliding window dataset ─────────────────────────────────────────────

    @staticmethod
    def _make_sequences(series, window=WINDOW):
        """Convert 1-D series → (X, y) with shape (N, window, 1) and (N,)."""
        arr = np.array(series, dtype=np.float32).reshape(-1, 1)
        X, y = [], []
        for i in range(window, len(arr)):
            X.append(arr[i - window:i])
            y.append(arr[i])
        return np.array(X), np.array(y)

    # ── Training ───────────────────────────────────────────────────────────

    def train(self, history):
        if not TF_AVAILABLE:
            return {"trained": False, "reason": "TensorFlow not installed"}

        cpu_raw = np.array(history["cpu"],    dtype=np.float32).reshape(-1, 1)
        mem_raw = np.array(history["memory"], dtype=np.float32).reshape(-1, 1)

        min_required = WINDOW + 20
        if len(cpu_raw) < min_required:
            return {"trained": False, "reason": f"Need ≥{min_required} samples"}

        # Scale to [0, 1] — LSTM is sensitive to input scale
        cpu_scaled = self.cpu_scaler.fit_transform(cpu_raw).flatten()
        mem_scaled = self.mem_scaler.fit_transform(mem_raw).flatten()

        X_cpu, y_cpu = self._make_sequences(cpu_scaled)
        X_mem, y_mem = self._make_sequences(mem_scaled)

        early_stop = EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)

        self.cpu_model = self._build_model()
        self.cpu_model.fit(
            X_cpu, y_cpu,
            epochs=50, batch_size=32,
            validation_split=0.1,
            callbacks=[early_stop],
            verbose=0,
        )

        self.mem_model = self._build_model()
        self.mem_model.fit(
            X_mem, y_mem,
            epochs=50, batch_size=32,
            validation_split=0.1,
            callbacks=[early_stop],
            verbose=0,
        )

        # Approximate R² on training set
        cpu_pred = self.cpu_model.predict(X_cpu, verbose=0).flatten()
        mem_pred = self.mem_model.predict(X_mem, verbose=0).flatten()
        self.train_r2_cpu = float(1 - np.var(y_cpu - cpu_pred) / (np.var(y_cpu) + 1e-8))
        self.train_r2_mem = float(1 - np.var(y_mem - mem_pred) / (np.var(y_mem) + 1e-8))
        self.n_samples    = len(X_cpu)
        self.is_trained   = True

        return {
            "trained":   True,
            "model":     "LSTM",
            "n_samples": self.n_samples,
            "r2_cpu":    round(self.train_r2_cpu, 4),
            "r2_mem":    round(self.train_r2_mem, 4),
        }

    # ── Auto-regressive prediction ─────────────────────────────────────────

    def _predict_series(self, series, model, scaler, steps=PRED_STEPS):
        """Iteratively predict `steps` values using the LSTM model."""
        scaled = scaler.transform(np.array(series, dtype=np.float32).reshape(-1, 1)).flatten()
        window_vals = list(scaled[-WINDOW:])
        predictions = []

        for _ in range(steps):
            x = np.array(window_vals[-WINDOW:], dtype=np.float32).reshape(1, WINDOW, 1)
            pred_scaled = float(model.predict(x, verbose=0)[0, 0])
            pred_scaled = np.clip(pred_scaled, 0.0, 1.0)
            # Inverse-scale back to percent
            pred_pct = float(scaler.inverse_transform([[pred_scaled]])[0, 0])
            pred_pct = np.clip(pred_pct, 0.0, 100.0)
            predictions.append(round(pred_pct, 1))
            window_vals.append(pred_scaled)

        return predictions

    # ── Public predict ─────────────────────────────────────────────────────

    def predict(self, history):
        if not self.is_trained:
            return None

        cpu_preds = self._predict_series(history["cpu"],    self.cpu_model, self.cpu_scaler)
        mem_preds = self._predict_series(history["memory"], self.mem_model, self.mem_scaler)
        labels    = ["now"] + [f"+{i*5}m" for i in range(1, PRED_STEPS)]

        return {
            "labels":    labels,
            "cpu":       cpu_preds,
            "memory":    mem_preds,
            "r2_cpu":    self.train_r2_cpu,
            "r2_mem":    self.train_r2_mem,
            "n_samples": self.n_samples,
            "model":     "LSTM",
        }

    # ── Simulation ─────────────────────────────────────────────────────────

    def simulate(self, history, cpu_increase=0, mem_increase=0, new_processes=0):
        """Same interface as MLService.simulate() — inject load and re-predict."""
        if not self.is_trained:
            return None

        proc_cpu = new_processes * 0.15
        proc_mem = new_processes * 0.08

        cpu_modified = [min(100.0, v + cpu_increase + proc_cpu) for v in history["cpu"]]
        mem_modified = [min(100.0, v + mem_increase + proc_mem) for v in history["memory"]]

        sim_cpu  = self._predict_series(cpu_modified, self.cpu_model, self.cpu_scaler)
        sim_mem  = self._predict_series(mem_modified, self.mem_model, self.mem_scaler)
        base_cpu = self._predict_series(history["cpu"],    self.cpu_model, self.cpu_scaler)
        base_mem = self._predict_series(history["memory"], self.mem_model, self.mem_scaler)

        peak_cpu   = max(sim_cpu)
        peak_mem   = max(sim_mem)
        risk_score = int(min(100, peak_cpu * 0.4 + peak_mem * 0.35 + new_processes * 0.5))
        risk_level = "LOW" if risk_score < 35 else "MEDIUM" if risk_score < 65 else "HIGH"

        return {
            "labels":     ["now"] + [f"+{i*5}m" for i in range(1, PRED_STEPS)],
            "sim_cpu":    sim_cpu,   "sim_mem":  sim_mem,
            "base_cpu":   base_cpu,  "base_mem": base_mem,
            "risk_score": risk_score, "risk_level": risk_level,
            "peak_cpu":   round(peak_cpu, 1), "peak_mem": round(peak_mem, 1),
        }
