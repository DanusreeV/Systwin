"""
tests/test_backend.py
──────────────────────
Unit tests for SysTwin AI backend services.

Run: pytest tests/ -v
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import numpy as np

from backend.services.ml_service import MLService


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_history(n=100, cpu_base=50, mem_base=60):
    """Generate a simple synthetic history dict for testing."""
    t = np.linspace(0, 4 * np.pi, n)
    cpu    = (cpu_base + 10 * np.sin(t) + np.random.normal(0, 2, n)).clip(0, 100).tolist()
    memory = (mem_base + 5  * np.sin(t * 0.5) + np.random.normal(0, 1, n)).clip(0, 100).tolist()
    return {"cpu": cpu, "memory": memory}


@pytest.fixture
def trained_ml():
    """Fixture: trained MLService ready for use."""
    ml = MLService()
    hist = make_history(150)
    result = ml.train(hist)
    assert result["trained"], f"Training failed: {result}"
    return ml, hist


# ── MLService.train() ─────────────────────────────────────────────────────────

class TestMLTrain:

    def test_train_returns_trained_true(self):
        ml = MLService()
        result = ml.train(make_history(100))
        assert result["trained"] is True

    def test_train_sets_is_trained(self):
        ml = MLService()
        ml.train(make_history(100))
        assert ml.is_trained is True

    def test_train_reports_n_samples(self):
        ml = MLService()
        result = ml.train(make_history(100))
        assert result["n_samples"] > 0

    def test_train_r2_reasonable(self):
        """R² should be positive — model beats a flat-mean baseline."""
        ml = MLService()
        result = ml.train(make_history(200))
        assert result["r2_cpu"] > 0.0
        assert result["r2_mem"] > 0.0

    def test_train_fails_with_too_few_samples(self):
        ml = MLService()
        result = ml.train(make_history(10))
        assert result["trained"] is False
        assert "reason" in result


# ── MLService.predict() ───────────────────────────────────────────────────────

class TestMLPredict:

    def test_predict_returns_none_before_training(self):
        ml = MLService()
        assert ml.predict(make_history(100)) is None

    def test_predict_returns_dict(self, trained_ml):
        ml, hist = trained_ml
        result = ml.predict(hist)
        assert isinstance(result, dict)

    def test_predict_cpu_length(self, trained_ml):
        ml, hist = trained_ml
        result = ml.predict(hist)
        assert len(result["cpu"]) == 7   # PRED_HORIZON

    def test_predict_mem_length(self, trained_ml):
        ml, hist = trained_ml
        result = ml.predict(hist)
        assert len(result["memory"]) == 7

    def test_predict_values_in_range(self, trained_ml):
        ml, hist = trained_ml
        result = ml.predict(hist)
        for v in result["cpu"] + result["memory"]:
            assert 0.0 <= v <= 100.0, f"Out of range: {v}"

    def test_predict_has_labels(self, trained_ml):
        ml, hist = trained_ml
        result = ml.predict(hist)
        assert len(result["labels"]) == 7
        assert result["labels"][0] == "now"

    def test_predict_has_model_info(self, trained_ml):
        ml, hist = trained_ml
        result = ml.predict(hist)
        assert "model"     in result
        assert "r2_cpu"    in result
        assert "n_samples" in result


# ── MLService.simulate() ──────────────────────────────────────────────────────

class TestMLSimulate:

    def test_simulate_returns_none_before_training(self):
        ml = MLService()
        assert ml.simulate(make_history(100)) is None

    def test_simulate_returns_dict(self, trained_ml):
        ml, hist = trained_ml
        result = ml.simulate(hist, cpu_increase=20, mem_increase=10, new_processes=5)
        assert isinstance(result, dict)

    def test_simulate_has_all_keys(self, trained_ml):
        ml, hist = trained_ml
        result = ml.simulate(hist, cpu_increase=10)
        for key in ("sim_cpu", "sim_mem", "base_cpu", "base_mem",
                    "risk_score", "risk_level", "peak_cpu", "peak_mem"):
            assert key in result, f"Missing key: {key}"

    def test_simulate_risk_level_valid(self, trained_ml):
        ml, hist = trained_ml
        result = ml.simulate(hist, cpu_increase=10, mem_increase=5)
        assert result["risk_level"] in ("LOW", "MEDIUM", "HIGH")

    def test_simulate_risk_score_in_range(self, trained_ml):
        ml, hist = trained_ml
        result = ml.simulate(hist, cpu_increase=30, mem_increase=20, new_processes=10)
        assert 0 <= result["risk_score"] <= 100

    def test_simulate_high_load_increases_cpu(self, trained_ml):
        """Simulated CPU should be higher than baseline when load is added."""
        ml, hist = trained_ml
        result = ml.simulate(hist, cpu_increase=40, mem_increase=0, new_processes=0)
        sim_peak  = max(result["sim_cpu"])
        base_peak = max(result["base_cpu"])
        assert sim_peak > base_peak, "Simulated CPU should exceed baseline"

    def test_simulate_no_load_equals_baseline(self, trained_ml):
        """Zero-delta simulation should produce predictions close to baseline."""
        ml, hist = trained_ml
        result = ml.simulate(hist, cpu_increase=0, mem_increase=0, new_processes=0)
        for s, b in zip(result["sim_cpu"], result["base_cpu"]):
            assert abs(s - b) < 1.0, f"Mismatch with zero delta: {s} vs {b}"

    def test_simulate_values_clamped(self, trained_ml):
        """Even extreme load should not produce values outside [0, 100]."""
        ml, hist = trained_ml
        result = ml.simulate(hist, cpu_increase=60, mem_increase=40, new_processes=50)
        for v in result["sim_cpu"] + result["sim_mem"]:
            assert 0.0 <= v <= 100.0, f"Value out of range: {v}"


# ── Feature engineering ───────────────────────────────────────────────────────

class TestFeatureEngineering:

    def test_make_features_shape(self):
        ml = MLService()
        series = list(range(50))
        X, y = ml._make_features(series)
        # Each row: 20 lags + rolling_mean + rolling_std + slope = 23 features
        assert X.shape[1] == 23
        assert len(X) == len(y)

    def test_make_features_returns_numpy(self):
        ml = MLService()
        X, y = ml._make_features(list(range(50)))
        assert isinstance(X, np.ndarray)
        assert isinstance(y, np.ndarray)

    def test_make_features_minimum_length(self):
        ml = MLService()
        # Series shorter than window+1 → empty result
        X, y = ml._make_features(list(range(10)))
        assert len(X) == 0
