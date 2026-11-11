# Chart Studio API

The backend of [Animated Chart Studio](../README.md): a FastAPI service that reads uploaded files,
works out their statistics and analyses X-ray diffraction (XRD) patterns.

## Run it

You need [uv](https://docs.astral.sh/uv/). It installs Python 3.12 and the packages.

~~~bash
uv sync
uv run uvicorn chart_studio_api.main:app --reload
~~~

The API is on http://localhost:8000 and its interactive documentation on
http://localhost:8000/docs. To run it in Docker together with the frontend, use
`docker compose up --build` in the folder above.

## Endpoints

| Method and path | Input | Output |
| --- | --- | --- |
| `GET /health` | nothing | `status` and `version` |
| `POST /api/v1/datasets/parse` | a form with `file` and, if wanted, `header=false` | the table: `filename`, `rows`, `columns`, `data` and `summary` |
| `POST /api/v1/analysis/summary` | JSON `{"rows": [...]}`, up to 100 000 rows | the summary of those rows |
| `POST /api/v1/xrd/analyze` | JSON with `two_theta`, `intensity` and settings | the smoothed, baseline and corrected curves, and the peaks |
| `POST /api/v1/xrd/identify` | JSON with the peaks and the measured range | the matching materials and the Miller indices of each peak |

Input that cannot be used gets status 422 with the reason in `detail`. A file over the size limit
or a table over the row limit gets status 413.

### A parsed file

Each column has a `name`, a `kind` (`numeric`, `datetime`, `boolean` or `text`) and its number of
`missing` values. The `summary` adds, per column, the number of `unique` values, the statistics of
a number column (`count`, `mean`, `std`, `min`, `q25`, `median`, `q75`, `max`) and the five most
frequent values of a text or yes/no column. Its `correlation` covers the first 30 number columns.

### XRD settings

| Field | Default | Meaning |
| --- | --- | --- |
| `wavelength` | `1.5406` | X-ray wavelength in Å (Cu Kα1) |
| `smoothing_window` | `9` | points in the smoothing window; `0` switches smoothing off |
| `baseline_method` | `snip` | `snip` removes the baseline, `none` keeps it |
| `baseline_window` | `5.0` | width of the baseline window in degrees |
| `min_prominence` | `3.0` | smallest peak, in percent of the tallest one |
| `min_distance` | `0.2` | smallest gap between two peaks in degrees |
| `shape_factor` | `0.9` | K in the Scherrer equation |
| `instrument_broadening` | `0.0` | peak width caused by the instrument, in degrees |

A pattern needs between 20 and 200 000 points, with angles between 0 and 180 degrees and no
repeated angle.

## How the XRD analysis works

1. The points are sorted by angle and checked.
2. The intensity is smoothed with a Savitzky-Golay filter.
3. The baseline is found with the SNIP method and taken off.
4. Peaks are found by their prominence. A peak must stand out by the chosen share of the tallest
   peak and by five times the noise of the data, whichever is larger.
5. The top of each peak is refined with a parabola through its three highest points, and its
   width is measured at half its height (FWHM).
6. The spacing comes from Bragg's law, `d = λ / (2 sin θ)`, and the crystallite size from the
   Scherrer equation, `size = K λ / (β cos θ)`, where `β` is the width after the instrument's
   share is taken off.

To name the material, the lines of each reference material are turned into angles for the
wavelength in use and paired with the measured peaks, closest first, within the tolerance. The
score combines how much of the material's strong lines were found with how much of the measured
intensity they explain. Materials that score at least 0.4 are returned, the best five at most,
and each peak gets the Miller indices of the first material that explains it.

## The reference library

`src/chart_studio_api/data/xrd_references.json` holds the reflections of 49 common materials,
such as metals, oxides, sulfides, carbides and salts. It stores the spacing `d` of every
reflection, so it works with any wavelength.

The library is built from crystal structures (space group, lattice constants and atom positions)
with pymatgen. To add a material, add it to `scripts/build_references.py` and build again:

~~~bash
uv run --group reference python scripts/build_references.py
~~~

## How files are read

`.xlsx` and plain `.csv` files are read as tables with pandas. Text files from instruments (`.xy`,
`.xye`, `.dat`, `.asc`, `.txt`, `.tsv`, and `.csv` files with notes at the top) go through
`services/numeric_block.py` first. It finds the longest run of lines made only of numbers and
takes that as the data. Lines above it are notes, and the line right above it gives the column
names if it fits. A file with words or empty cells among its numbers is an ordinary table and
goes to pandas, so no row is dropped.

## Layout

~~~text
src/chart_studio_api/
  main.py        builds the app
  config.py      settings, read from CHART_STUDIO_* environment variables
  schemas.py     the shapes of requests and responses
  api/           one module per group of endpoints
  services/      the work itself: reading files, statistics, XRD analysis and identification
  data/          the XRD reference library
scripts/         the builder of the reference library
tests/           one test module per feature
~~~

## Checks

~~~bash
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest
~~~

`pytest` also prints how much of the code the tests cover.
