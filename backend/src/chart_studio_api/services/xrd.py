"""X-ray diffraction (XRD) pattern analysis: smoothing, baseline removal and peaks."""

import math

import numpy as np
from numpy.typing import NDArray
from pybaselines import Baseline
from scipy.signal import find_peaks, peak_widths, savgol_filter

from chart_studio_api.schemas import XrdPeak, XrdRequest, XrdResult

Array = NDArray[np.float64]

POLYNOMIAL_ORDER = 3


class XrdError(ValueError):
    """Raised when a pattern cannot be analysed."""


def analyze(request: XrdRequest) -> XrdResult:
    angle, intensity = _prepare(request.two_theta, request.intensity)
    smoothed = _smooth(intensity, request.smoothing_window)
    baseline = _baseline(angle, smoothed, request)
    corrected = smoothed - baseline
    floor = max(5 * _noise(intensity), 1e-6 * max(1.0, float(np.abs(intensity).max())))
    return XrdResult(
        two_theta=angle.tolist(),
        smoothed=smoothed.tolist(),
        baseline=baseline.tolist(),
        corrected=corrected.tolist(),
        peaks=_peaks(angle, corrected, floor, request),
    )


def _prepare(angles: list[float], counts: list[float]) -> tuple[Array, Array]:
    if len(angles) != len(counts):
        raise XrdError("The angle and intensity columns must have the same length.")
    angle = np.asarray(angles, dtype=np.float64)
    intensity = np.asarray(counts, dtype=np.float64)
    if not (np.isfinite(angle).all() and np.isfinite(intensity).all()):
        raise XrdError("The pattern contains values that are not finite numbers.")
    order = np.argsort(angle, kind="stable")
    angle, intensity = angle[order], intensity[order]
    if angle[0] <= 0 or angle[-1] >= 180:
        raise XrdError("The angles (2theta) must be between 0 and 180 degrees.")
    if np.any(np.diff(angle) <= 0):
        raise XrdError("The angle column must not contain repeated values.")
    return angle, intensity


def _noise(values: Array) -> float:
    steps = np.diff(values)
    return float(1.4826 * np.median(np.abs(steps - np.median(steps))) / math.sqrt(2))


def _step(angle: Array) -> float:
    return float(np.median(np.diff(angle)))


def _smooth(values: Array, window: int) -> Array:
    if window < 3:
        return values.copy()
    size = window if window % 2 == 1 else window + 1
    largest = len(values) if len(values) % 2 == 1 else len(values) - 1
    size = min(size, largest)
    order = min(POLYNOMIAL_ORDER, size - 1)
    return np.asarray(savgol_filter(values, size, order), dtype=np.float64)


def _baseline(angle: Array, values: Array, request: XrdRequest) -> Array:
    if request.baseline_method == "none":
        return np.zeros_like(values)
    half_window = max(2, round(request.baseline_window / _step(angle) / 2))
    half_window = min(half_window, (len(values) - 1) // 2)
    fitted, _ = Baseline(x_data=angle).snip(values, max_half_window=half_window)
    return np.asarray(fitted, dtype=np.float64)


def _peaks(angle: Array, corrected: Array, floor: float, request: XrdRequest) -> list[XrdPeak]:
    top = float(corrected.max())
    if top <= floor:
        return []
    found, _ = find_peaks(
        corrected,
        prominence=max(request.min_prominence / 100 * top, floor),
        distance=max(1, round(request.min_distance / _step(angle))),
    )
    if len(found) == 0:
        return []
    _, _, left_ips, right_ips = peak_widths(corrected, found, rel_height=0.5)
    grid = np.arange(len(angle), dtype=np.float64)
    widths = np.interp(right_ips, grid, angle) - np.interp(left_ips, grid, angle)
    tallest = float(corrected[found].max())
    return [
        _build_peak(angle, corrected, int(index), float(width), tallest, request)
        for index, width in zip(found, widths, strict=True)
    ]


def _build_peak(
    angle: Array,
    corrected: Array,
    index: int,
    fwhm: float,
    tallest: float,
    request: XrdRequest,
) -> XrdPeak:
    position = _refine(angle, corrected, index)
    height = float(corrected[index])
    theta = math.radians(position / 2)
    return XrdPeak(
        position=position,
        d_spacing=request.wavelength / (2 * math.sin(theta)),
        height=height,
        relative_intensity=height / tallest * 100,
        fwhm=fwhm,
        crystallite_size=_crystallite_size(fwhm, position, request),
    )


def _refine(angle: Array, values: Array, index: int) -> float:
    left, middle, right = values[index - 1], values[index], values[index + 1]
    curvature = left - 2 * middle + right
    if curvature == 0:
        return float(angle[index])
    shift = float(np.clip(0.5 * (left - right) / curvature, -1.0, 1.0))
    local_step = (angle[index + 1] - angle[index - 1]) / 2
    return float(angle[index] + shift * local_step)


def _crystallite_size(fwhm: float, position: float, request: XrdRequest) -> float | None:
    observed = math.radians(fwhm)
    instrument = math.radians(request.instrument_broadening)
    if observed <= instrument:
        return None
    width = math.sqrt(observed**2 - instrument**2)
    theta = math.radians(position / 2)
    size_angstrom = request.shape_factor * request.wavelength / (width * math.cos(theta))
    return size_angstrom / 10
