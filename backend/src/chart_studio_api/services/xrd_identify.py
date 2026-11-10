"""Names the material of an XRD pattern by matching its peaks with reference patterns."""

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from chart_studio_api.schemas import (
    IdentifyPeak,
    PeakAssignment,
    PeakMatch,
    PhaseMatch,
    XrdIdentifyRequest,
    XrdIdentifyResult,
)

LIBRARY_PATH = Path(__file__).resolve().parent.parent / "data" / "xrd_references.json"

# Reflections weaker than this (percent of the strongest) are left out of the matching.
MIN_REFERENCE_INTENSITY = 5.0
# The lines a material must show to count as present.
STRONG_REFERENCE_INTENSITY = 15.0
MIN_SCORE = 0.4
MAX_PHASES = 5
# A second material is only added when it explains at least this many peaks the first ones did not.
MIN_NEW_PEAKS = 2


class IdentifyError(ValueError):
    """Raised when a pattern cannot be matched."""


@dataclass(frozen=True)
class Reflection:
    d_spacing: float
    intensity: float
    hkl: tuple[tuple[int, ...], ...]


@dataclass(frozen=True)
class Phase:
    name: str
    formula: str
    space_group: str
    reflections: tuple[Reflection, ...]


def _phase(entry: dict[str, Any]) -> Phase:
    reflections = tuple(
        Reflection(
            d_spacing=float(line["d"]),
            intensity=float(line["i"]),
            hkl=tuple(tuple(int(index) for index in family) for family in line["hkl"]),
        )
        for line in entry["reflections"]
    )
    return Phase(
        name=str(entry["name"]),
        formula=str(entry["formula"]),
        space_group=str(entry["space_group"]),
        reflections=reflections,
    )


@lru_cache(maxsize=1)
def load_library() -> tuple[Phase, ...]:
    raw = json.loads(LIBRARY_PATH.read_text(encoding="utf-8"))
    return tuple(_phase(entry) for entry in raw["phases"])


def _two_theta(d_spacing: float, wavelength: float) -> float | None:
    ratio = wavelength / (2 * d_spacing)
    if ratio >= 1:
        return None
    return 2 * math.degrees(math.asin(ratio))


def _lines_in_range(phase: Phase, request: XrdIdentifyRequest) -> list[tuple[float, Reflection]]:
    low = request.two_theta_min - request.tolerance
    high = request.two_theta_max + request.tolerance
    lines: list[tuple[float, Reflection]] = []
    for reflection in phase.reflections:
        if reflection.intensity < MIN_REFERENCE_INTENSITY:
            continue
        angle = _two_theta(reflection.d_spacing, request.wavelength)
        if angle is not None and low <= angle <= high:
            lines.append((angle, reflection))
    return lines


def _pair_up(
    peaks: list[IdentifyPeak], lines: list[tuple[float, Reflection]], tolerance: float
) -> dict[int, int]:
    """Pairs peaks with reference lines, closest first, each used at most once."""
    candidates = [
        (abs(peak.position - angle), peak_index, line_index)
        for peak_index, peak in enumerate(peaks)
        for line_index, (angle, _) in enumerate(lines)
        if abs(peak.position - angle) <= tolerance
    ]
    candidates.sort()
    taken_peaks: set[int] = set()
    taken_lines: set[int] = set()
    pairs: dict[int, int] = {}
    for _, peak_index, line_index in candidates:
        if peak_index in taken_peaks or line_index in taken_lines:
            continue
        taken_peaks.add(peak_index)
        taken_lines.add(line_index)
        pairs[peak_index] = line_index
    return pairs


def _match_phase(phase: Phase, request: XrdIdentifyRequest) -> PhaseMatch | None:
    lines = _lines_in_range(phase, request)
    strong = {
        index
        for index, (_, line) in enumerate(lines)
        if line.intensity >= STRONG_REFERENCE_INTENSITY
    }
    pairs = _pair_up(request.peaks, lines, request.tolerance)
    if not strong or len(pairs) < min(2, len(request.peaks)):
        return None

    # A peak counts in proportion to how close it is to its reference line.
    closeness = {
        peak_index: max(
            0.0,
            1
            - (abs(request.peaks[peak_index].position - lines[line_index][0]) / request.tolerance)
            ** 2,
        )
        for peak_index, line_index in pairs.items()
    }
    strong_total = sum(lines[index][1].intensity for index in strong)
    strong_found = sum(
        lines[line_index][1].intensity * closeness[peak_index]
        for peak_index, line_index in pairs.items()
        if line_index in strong
    )
    observed_total = sum(peak.relative_intensity for peak in request.peaks)
    observed_found = sum(
        request.peaks[peak_index].relative_intensity * closeness[peak_index] for peak_index in pairs
    )
    reference_share = strong_found / strong_total
    observed_share = observed_found / max(observed_total, 1e-9)
    score = math.sqrt(reference_share * observed_share)
    if score < MIN_SCORE:
        return None

    matches = [
        PeakMatch(
            peak_index=peak_index,
            hkl=[list(hkl) for hkl in lines[line_index][1].hkl],
            reference_two_theta=lines[line_index][0],
            difference=request.peaks[peak_index].position - lines[line_index][0],
        )
        for peak_index, line_index in sorted(pairs.items())
    ]
    matched_strong = strong.intersection(pairs.values())
    return PhaseMatch(
        name=phase.name,
        formula=phase.formula,
        space_group=phase.space_group,
        score=round(score, 3),
        matches=matches,
        missing=len(strong) - len(matched_strong),
    )


def _assign(phases: list[PhaseMatch]) -> list[PeakAssignment]:
    """Gives each peak the indices of the first material that explains it."""
    assigned: dict[int, PeakAssignment] = {}
    for rank, phase in enumerate(phases):
        fresh = [match for match in phase.matches if match.peak_index not in assigned]
        if rank > 0 and len(fresh) < MIN_NEW_PEAKS:
            continue
        for match in fresh:
            assigned[match.peak_index] = PeakAssignment(
                peak_index=match.peak_index, phase_index=rank, hkl=match.hkl
            )
    return [assigned[index] for index in sorted(assigned)]


def identify(
    request: XrdIdentifyRequest, library: tuple[Phase, ...] | None = None
) -> XrdIdentifyResult:
    if request.two_theta_min >= request.two_theta_max:
        raise IdentifyError("The smallest angle must be smaller than the largest angle.")
    phases = load_library() if library is None else library
    found = [match for phase in phases if (match := _match_phase(phase, request)) is not None]
    found.sort(key=lambda match: match.score, reverse=True)
    top = found[:MAX_PHASES]
    return XrdIdentifyResult(phases=top, assignments=_assign(top))
