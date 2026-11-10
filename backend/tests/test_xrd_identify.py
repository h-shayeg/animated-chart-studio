"""Tests for naming the material of an XRD pattern."""

import math

import pytest
from fastapi.testclient import TestClient

from chart_studio_api.main import app
from chart_studio_api.schemas import IdentifyPeak, XrdIdentifyRequest
from chart_studio_api.services.xrd_identify import (
    IdentifyError,
    Phase,
    Reflection,
    identify,
    load_library,
)

client = TestClient(app)

URL = "/api/v1/xrd/identify"
WAVELENGTH = 1.5406


def angle(d_spacing):
    return 2 * math.degrees(math.asin(WAVELENGTH / (2 * d_spacing)))


def phase(name, formula, lines):
    reflections = tuple(Reflection(d, intensity, (hkl,)) for d, intensity, hkl in lines)
    return Phase(name=name, formula=formula, space_group="x", reflections=reflections)


SILICON_LINES = [
    (3.1356, 100, (1, 1, 1)),
    (1.9201, 55, (2, 2, 0)),
    (1.6375, 30, (3, 1, 1)),
    (1.3577, 6, (4, 0, 0)),
    (1.2459, 11, (3, 3, 1)),
]
COPPER_LINES = [
    (2.0871, 100, (1, 1, 1)),
    (1.8075, 46, (2, 0, 0)),
    (1.2780, 20, (2, 2, 0)),
    (1.0900, 17, (3, 1, 1)),
]
GERMANIUM_LINES = [
    (3.266, 100, (1, 1, 1)),
    (2.000, 60, (2, 2, 0)),
    (1.706, 35, (3, 1, 1)),
    (1.414, 8, (4, 0, 0)),
    (1.298, 14, (3, 3, 1)),
]
LIBRARY = (
    phase("Silicon", "Si", SILICON_LINES),
    phase("Copper", "Cu", COPPER_LINES),
    phase("Germanium", "Ge", GERMANIUM_LINES),
)


def request(lines, shift=0.0, high=80, **options):
    peaks = [
        IdentifyPeak(position=angle(d) + shift, relative_intensity=intensity)
        for d, intensity, _ in lines
    ]
    return XrdIdentifyRequest(peaks=peaks, two_theta_min=20, two_theta_max=high, **options)


def test_names_the_material_and_gives_the_indices_of_every_peak():
    result = identify(request(SILICON_LINES), LIBRARY)

    assert result.phases[0].name == "Silicon"
    assert result.phases[0].score > 0.9
    assert [item.hkl for item in result.assignments] == [[list(hkl)] for _, _, hkl in SILICON_LINES]


def test_allows_a_small_shift_of_the_whole_pattern():
    result = identify(request(SILICON_LINES, shift=0.08), LIBRARY)

    assert result.phases[0].name == "Silicon"
    assert len(result.assignments) == len(SILICON_LINES)


def test_a_shift_larger_than_the_tolerance_finds_nothing():
    result = identify(request(SILICON_LINES, shift=0.6), LIBRARY)

    assert result.phases == []
    assert result.assignments == []


def test_a_wider_tolerance_accepts_a_larger_shift():
    result = identify(request(SILICON_LINES, shift=0.5, tolerance=0.8), LIBRARY)

    assert result.phases[0].name == "Silicon"


def test_explains_the_peaks_of_a_mixture_with_both_materials():
    result = identify(request(SILICON_LINES + COPPER_LINES, high=95), LIBRARY)

    names = {result.phases[item.phase_index].name for item in result.assignments}
    assert names == {"Silicon", "Copper"}
    assert len(result.assignments) == len(SILICON_LINES) + len(COPPER_LINES)


def test_peaks_that_belong_to_no_material_find_nothing():
    peaks = [
        IdentifyPeak(position=position, relative_intensity=i)
        for position, i in [(24.7, 100), (31.3, 40), (58.2, 30)]
    ]
    result = identify(XrdIdentifyRequest(peaks=peaks, two_theta_min=20, two_theta_max=80), LIBRARY)

    assert result.phases == []


def test_the_range_must_make_sense():
    bad = XrdIdentifyRequest(
        peaks=[IdentifyPeak(position=30, relative_intensity=100)],
        two_theta_min=50,
        two_theta_max=40,
    )

    with pytest.raises(IdentifyError):
        identify(bad, LIBRARY)


def family(hkl):
    return tuple(sorted(abs(value) for value in hkl[0]))


def test_the_shipped_library_names_silicon_with_its_indices():
    assert "Silicon" in {item.name for item in load_library()}
    peaks = [
        IdentifyPeak(position=position, relative_intensity=intensity)
        for position, intensity in [(28.44, 100), (47.30, 55), (56.12, 30), (69.13, 6), (76.38, 11)]
    ]

    result = identify(XrdIdentifyRequest(peaks=peaks, two_theta_min=20, two_theta_max=80))

    assert result.phases[0].name == "Silicon"
    assert [family(item.hkl) for item in result.assignments] == [
        (1, 1, 1),
        (0, 2, 2),
        (1, 1, 3),
        (0, 0, 4),
        (1, 3, 3),
    ]


def test_endpoint_names_the_material():
    body = {
        "peaks": [
            {"position": position, "relative_intensity": intensity}
            for position, intensity in [(28.44, 100), (47.30, 55), (56.12, 30)]
        ],
        "two_theta_min": 20,
        "two_theta_max": 80,
    }

    response = client.post(URL, json=body)

    assert response.status_code == 200
    assert response.json()["phases"][0]["name"] == "Silicon"


@pytest.mark.parametrize(
    "body",
    [
        {"peaks": [], "two_theta_min": 20, "two_theta_max": 80},
        {"peaks": [{"position": 30, "relative_intensity": 100}], "two_theta_min": 20},
        {
            "peaks": [{"position": 30, "relative_intensity": 100}],
            "two_theta_min": 50,
            "two_theta_max": 40,
        },
    ],
)
def test_endpoint_rejects_invalid_input(body):
    assert client.post(URL, json=body).status_code == 422


def test_the_closer_of_two_look_alikes_wins():
    lookalike = phase(
        "Sphalerite",
        "ZnS",
        [(3.1233, 100, (1, 1, 1)), (1.9125, 55, (2, 2, 0)), (1.6310, 30, (3, 1, 1))],
    )

    result = identify(request(SILICON_LINES[:3]), (lookalike, *LIBRARY))

    assert result.phases[0].name == "Silicon"
    assert result.phases[1].name == "Sphalerite"
