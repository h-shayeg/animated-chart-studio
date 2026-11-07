"""Tests for the XRD analysis service and endpoint."""

import math

import numpy as np
import pytest
from fastapi.testclient import TestClient

from chart_studio_api.main import app
from chart_studio_api.schemas import XrdRequest
from chart_studio_api.services.xrd import analyze

client = TestClient(app)

URL = "/api/v1/xrd/analyze"
WAVELENGTH = 1.5406
FWHM = 0.2
SIGMA = FWHM / (2 * math.sqrt(2 * math.log(2)))
PEAKS = [(28.44, 1000.0), (47.30, 550.0), (56.12, 300.0)]


def make_pattern(noise=8.0, seed=7):
    angle = np.arange(20.0, 80.0, 0.02)
    counts = 200 + 3 * (80 - angle)
    for centre, height in PEAKS:
        counts = counts + height * np.exp(-((angle - centre) ** 2) / (2 * SIGMA**2))
    counts = counts + np.random.default_rng(seed).normal(0, noise, angle.size)
    return angle, counts


def run(angle, counts, **options):
    return analyze(XrdRequest(two_theta=angle.tolist(), intensity=counts.tolist(), **options))


def payload(**changes):
    angle, counts = make_pattern()
    return {"two_theta": angle.tolist(), "intensity": counts.tolist(), **changes}


def test_finds_every_peak_at_the_right_position():
    result = run(*make_pattern())
    positions = [peak.position for peak in result.peaks]
    assert positions == pytest.approx([centre for centre, _ in PEAKS], abs=0.03)


def test_d_spacing_follows_braggs_law():
    first = run(*make_pattern()).peaks[0]
    expected = WAVELENGTH / (2 * math.sin(math.radians(PEAKS[0][0] / 2)))
    assert first.d_spacing == pytest.approx(expected, rel=2e-3)


def test_crystallite_size_follows_scherrer():
    first = run(*make_pattern()).peaks[0]
    theta = math.radians(PEAKS[0][0] / 2)
    expected = 0.9 * WAVELENGTH / (math.radians(FWHM) * math.cos(theta)) / 10
    assert first.fwhm == pytest.approx(FWHM, abs=0.03)
    assert first.crystallite_size == pytest.approx(expected, rel=0.1)


def test_relative_intensity_is_scaled_to_the_tallest_peak():
    peaks = run(*make_pattern()).peaks
    expected = [100 * height / PEAKS[0][1] for _, height in PEAKS]
    assert [peak.relative_intensity for peak in peaks] == pytest.approx(expected, abs=5)


def test_instrument_broadening_is_subtracted_from_the_width():
    angle, counts = make_pattern()
    plain = run(angle, counts).peaks[0].crystallite_size
    adjusted = run(angle, counts, instrument_broadening=0.1).peaks[0].crystallite_size
    assert plain is not None
    assert adjusted is not None
    assert adjusted > plain


def test_instrument_broadening_wider_than_the_peak_gives_no_size():
    result = run(*make_pattern(), instrument_broadening=0.5)
    assert all(peak.crystallite_size is None for peak in result.peaks)


def test_baseline_is_removed():
    angle, counts = make_pattern()
    result = run(angle, counts)
    region = (angle > 60) & (angle < 75)
    corrected = np.median(np.array(result.corrected)[region])
    assert corrected < 0.2 * np.median(counts[region])


def test_baseline_can_be_turned_off():
    result = run(*make_pattern(), baseline_method="none")
    assert set(result.baseline) == {0.0}


def test_unsorted_input_gives_the_same_result():
    angle, counts = make_pattern()
    order = np.random.default_rng(1).permutation(angle.size)
    shuffled = run(angle[order], counts[order])
    assert shuffled.two_theta == angle.tolist()
    assert len(shuffled.peaks) == len(PEAKS)


def test_flat_pattern_has_no_peaks():
    angle = np.linspace(10.0, 20.0, 100)
    assert run(angle, np.full(100, 5.0)).peaks == []


def test_noise_only_pattern_has_no_peaks():
    angle = np.arange(20.0, 80.0, 0.02)
    counts = 100 + np.random.default_rng(3).normal(0, 8, angle.size)
    assert run(angle, counts).peaks == []


def test_endpoint_returns_curves_and_peaks():
    response = client.post(URL, json=payload())
    assert response.status_code == 200
    body = response.json()
    assert len(body["peaks"]) == len(PEAKS)
    assert len(body["corrected"]) == len(body["two_theta"])


@pytest.mark.parametrize(
    "changes",
    [
        {"intensity": [1.0] * 100},
        {"wavelength": -1.0},
        {"smoothing_window": -3},
        {"baseline_method": "unknown"},
        {"two_theta": [1.0, 2.0], "intensity": [1.0, 2.0]},
    ],
)
def test_endpoint_rejects_invalid_input(changes):
    assert client.post(URL, json=payload(**changes)).status_code == 422


def test_endpoint_explains_out_of_range_angles():
    angle = np.linspace(100.0, 200.0, 50)
    response = client.post(URL, json={"two_theta": angle.tolist(), "intensity": [1.0] * 50})
    assert response.status_code == 422
    assert "between 0 and 180" in response.json()["detail"]
