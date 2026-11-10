"""Builds the XRD reference library from known crystal structures.

Run it from the backend folder:
    uv run --group reference python scripts/build_references.py

Each material is a space group, experimental lattice constants and the atoms of its asymmetric
unit. pymatgen turns them into the reflections of a powder pattern. The library stores the
spacing d of every reflection, so it works with any X-ray wavelength.
"""

import json
import math
from dataclasses import dataclass
from pathlib import Path

from pymatgen.analysis.diffraction.xrd import XRDCalculator
from pymatgen.core import Lattice, Structure

OUTPUT = Path(__file__).resolve().parent.parent / "src/chart_studio_api/data/xrd_references.json"
WAVELENGTH = 1.5406
MIN_INTENSITY = 1.0
TWO_THETA_RANGE = (5.0, 120.0)
THIRD = 1 / 3
TWO_THIRDS = 2 / 3
FIVE_EIGHTHS = 5 / 8

Coords = list[list[float]]


@dataclass(frozen=True)
class Entry:
    name: str
    group: int
    group_name: str
    lattice: Lattice
    species: list[str]
    coords: Coords
    atoms: int


def fcc(name: str, element: str, a: float) -> Entry:
    return Entry(name, 225, "Fm-3m", Lattice.cubic(a), [element], [[0, 0, 0]], 4)


def bcc(name: str, element: str, a: float) -> Entry:
    return Entry(name, 229, "Im-3m", Lattice.cubic(a), [element], [[0, 0, 0]], 2)


def hcp(name: str, element: str, a: float, c: float) -> Entry:
    lattice = Lattice.hexagonal(a, c)
    return Entry(name, 194, "P6_3/mmc", lattice, [element], [[THIRD, TWO_THIRDS, 0.25]], 2)


def rocksalt(name: str, cation: str, anion: str, a: float) -> Entry:
    coords = [[0, 0, 0], [0.5, 0.5, 0.5]]
    return Entry(name, 225, "Fm-3m", Lattice.cubic(a), [cation, anion], coords, 8)


def fluorite(name: str, cation: str, anion: str, a: float) -> Entry:
    coords = [[0, 0, 0], [0.25, 0.25, 0.25]]
    return Entry(name, 225, "Fm-3m", Lattice.cubic(a), [cation, anion], coords, 12)


def zincblende(name: str, cation: str, anion: str, a: float) -> Entry:
    coords = [[0, 0, 0], [0.25, 0.25, 0.25]]
    return Entry(name, 216, "F-43m", Lattice.cubic(a), [cation, anion], coords, 8)


def wurtzite(name: str, cation: str, anion: str, a: float, c: float, u: float) -> Entry:
    coords = [[THIRD, TWO_THIRDS, 0], [THIRD, TWO_THIRDS, u]]
    return Entry(name, 186, "P6_3mc", Lattice.hexagonal(a, c), [cation, anion], coords, 4)


def corundum(name: str, metal: str, a: float, c: float, z: float, x: float) -> Entry:
    coords = [[0, 0, z], [x, 0, 0.25]]
    return Entry(name, 167, "R-3c", Lattice.hexagonal(a, c), [metal, "O"], coords, 30)


def spinel(name: str, a_site: str, b_site: str, a: float, u: float) -> Entry:
    coords = [[0, 0, 0], [FIVE_EIGHTHS] * 3, [u] * 3]
    return Entry(name, 227, "Fd-3m", Lattice.cubic(a), [a_site, b_site, "O"], coords, 56)


ENTRIES = [
    Entry("Silicon", 227, "Fd-3m", Lattice.cubic(5.4309), ["Si"], [[0, 0, 0]], 8),
    Entry("Germanium", 227, "Fd-3m", Lattice.cubic(5.6579), ["Ge"], [[0, 0, 0]], 8),
    fcc("Gold", "Au", 4.0782),
    fcc("Silver", "Ag", 4.0862),
    fcc("Copper", "Cu", 3.6150),
    fcc("Aluminium", "Al", 4.0495),
    fcc("Platinum", "Pt", 3.9231),
    fcc("Palladium", "Pd", 3.8907),
    fcc("Nickel", "Ni", 3.5238),
    fcc("Lead", "Pb", 4.9502),
    bcc("Iron (alpha)", "Fe", 2.8665),
    bcc("Tungsten", "W", 3.1652),
    bcc("Molybdenum", "Mo", 3.1472),
    hcp("Titanium", "Ti", 2.9508, 4.6855),
    hcp("Zinc", "Zn", 2.6649, 4.9468),
    hcp("Magnesium", "Mg", 3.2094, 5.2105),
    hcp("Cobalt (hcp)", "Co", 2.5071, 4.0686),
    Entry(
        "Graphite",
        194,
        "P6_3/mmc",
        Lattice.hexagonal(2.4640, 6.7110),
        ["C", "C"],
        [[0, 0, 0.25], [THIRD, TWO_THIRDS, 0.25]],
        4,
    ),
    Entry(
        "Tin (beta)", 141, "I4_1/amd", Lattice.tetragonal(5.8318, 3.1818), ["Sn"], [[0, 0, 0]], 4
    ),
    rocksalt("Halite", "Na", "Cl", 5.6402),
    rocksalt("Sylvite", "K", "Cl", 6.2931),
    rocksalt("Lithium fluoride", "Li", "F", 4.0273),
    rocksalt("Periclase", "Mg", "O", 4.2112),
    rocksalt("Bunsenite", "Ni", "O", 4.1771),
    rocksalt("Cobalt monoxide", "Co", "O", 4.2667),
    rocksalt("Titanium nitride", "Ti", "N", 4.2417),
    rocksalt("Titanium carbide", "Ti", "C", 4.3274),
    fluorite("Fluorite", "Ca", "F", 5.4631),
    fluorite("Ceria", "Ce", "O", 5.4113),
    wurtzite("Zincite", "Zn", "O", 3.2495, 5.2069, 0.3825),
    wurtzite("Greenockite", "Cd", "S", 4.1348, 6.7490, 0.3770),
    zincblende("Sphalerite", "Zn", "S", 5.4093),
    zincblende("Silicon carbide (3C)", "Si", "C", 4.3596),
    Entry(
        "Anatase",
        141,
        "I4_1/amd",
        Lattice.tetragonal(3.7845, 9.5143),
        ["Ti", "O"],
        [[0, 0, 0], [0, 0, 0.2081]],
        12,
    ),
    Entry(
        "Rutile",
        136,
        "P4_2/mnm",
        Lattice.tetragonal(4.5937, 2.9587),
        ["Ti", "O"],
        [[0, 0, 0], [0.3053, 0.3053, 0]],
        6,
    ),
    Entry(
        "Cassiterite",
        136,
        "P4_2/mnm",
        Lattice.tetragonal(4.7382, 3.1871),
        ["Sn", "O"],
        [[0, 0, 0], [0.3056, 0.3056, 0]],
        6,
    ),
    corundum("Corundum", "Al", 4.7589, 12.9911, 0.3522, 0.3064),
    corundum("Hematite", "Fe", 5.0356, 13.7489, 0.3553, 0.3059),
    corundum("Eskolaite", "Cr", 4.9587, 13.5942, 0.3475, 0.3059),
    Entry(
        "Calcite",
        167,
        "R-3c",
        Lattice.hexagonal(4.9896, 17.0610),
        ["Ca", "C", "O"],
        [[0, 0, 0], [0, 0, 0.25], [0.2578, 0, 0.25]],
        30,
    ),
    spinel("Magnetite", "Fe", "Fe", 8.3963, 0.3799),
    spinel("Cobalt oxide (spinel)", "Co", "Co", 8.0837, 0.3881),
    spinel("Magnesium aluminate (spinel)", "Mg", "Al", 8.0831, 0.3875),
    Entry(
        "Cuprite",
        224,
        "Pn-3m",
        Lattice.cubic(4.2696),
        ["O", "Cu"],
        [[0, 0, 0], [0.25, 0.25, 0.25]],
        6,
    ),
    Entry(
        "Tenorite",
        15,
        "C2/c",
        Lattice.monoclinic(4.6837, 3.4226, 5.1288, 99.54),
        ["Cu", "O"],
        [[0.25, 0.25, 0], [0, 0.4184, 0.25]],
        8,
    ),
    Entry(
        "Molybdenite",
        194,
        "P6_3/mmc",
        Lattice.hexagonal(3.1604, 12.295),
        ["Mo", "S"],
        [[THIRD, TWO_THIRDS, 0.25], [THIRD, TWO_THIRDS, 0.621]],
        6,
    ),
    Entry(
        "Strontium titanate",
        221,
        "Pm-3m",
        Lattice.cubic(3.905),
        ["Sr", "Ti", "O"],
        [[0.5, 0.5, 0.5], [0, 0, 0], [0.5, 0, 0]],
        5,
    ),
    Entry(
        "Lanthanum hexaboride",
        221,
        "Pm-3m",
        Lattice.cubic(4.1569),
        ["La", "B"],
        [[0, 0, 0], [0.1993, 0.5, 0.5]],
        7,
    ),
    Entry(
        "Tungsten carbide",
        187,
        "P-6m2",
        Lattice.hexagonal(2.9065, 2.8366),
        ["W", "C"],
        [[0, 0, 0], [THIRD, TWO_THIRDS, 0.5]],
        2,
    ),
]


def reflections(structure: Structure, calculator: XRDCalculator) -> list[dict[str, object]]:
    pattern = calculator.get_pattern(structure, scaled=True, two_theta_range=TWO_THETA_RANGE)
    lines: list[dict[str, object]] = []
    for intensity, spacing, families in zip(pattern.y, pattern.d_hkls, pattern.hkls, strict=True):
        if intensity < MIN_INTENSITY:
            continue
        hkl = [[int(index) for index in family["hkl"]] for family in families[:2]]
        lines.append({"d": round(float(spacing), 5), "i": round(float(intensity), 1), "hkl": hkl})
    return lines


def describe(entry: Entry, lines: list[dict[str, object]]) -> str:
    strongest = sorted(lines, key=lambda line: float(str(line["i"])), reverse=True)[:3]
    parts = []
    for line in strongest:
        angle = 2 * math.degrees(math.asin(WAVELENGTH / (2 * float(str(line["d"])))))
        hkl = line["hkl"][0] if isinstance(line["hkl"], list) else ""
        parts.append(f"{angle:.2f} {tuple(hkl)}")
    return f"{entry.name:30s} {entry.atoms:3d} atoms | " + " | ".join(parts)


def main() -> None:
    calculator = XRDCalculator(wavelength=WAVELENGTH)
    phases = []
    for entry in ENTRIES:
        structure = Structure.from_spacegroup(
            entry.group, entry.lattice, entry.species, entry.coords
        )
        if len(structure) != entry.atoms:
            raise SystemExit(f"{entry.name}: expected {entry.atoms} atoms, got {len(structure)}")
        lines = reflections(structure, calculator)
        phases.append(
            {
                "name": entry.name,
                "formula": structure.composition.reduced_formula,
                "space_group": entry.group_name,
                "reflections": lines,
            }
        )
        print(describe(entry, lines))
    payload = {"wavelength": WAVELENGTH, "phases": phases}
    OUTPUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(phases)} materials written to {OUTPUT}")


if __name__ == "__main__":
    main()
