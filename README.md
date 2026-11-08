# Animated Chart Studio

[![CI](https://github.com/h-shayeg/animated-chart-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/h-shayeg/animated-chart-studio/actions/workflows/ci.yml)
[![CodeQL](https://github.com/h-shayeg/animated-chart-studio/actions/workflows/codeql.yml/badge.svg)](https://github.com/h-shayeg/animated-chart-studio/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/github/license/h-shayeg/animated-chart-studio)](LICENSE)

Interactive and animated chart studio with analysis tools for materials-characterization data.
Upload a CSV or Excel file, turn it into an animated chart, and analyse X-ray diffraction (XRD)
patterns. The interface is available in English and Persian (right to left).

## Features

- Upload CSV or Excel files (up to 10 MB) and browse them as a table, with or without a header row.
- Line, area, bar, scatter and pie charts with colour palettes and animation you can replay.
- Colour ranges on the X or the Y axis, cropping, a zoom slider and an adjustable chart height.
- A magnifier: a frame on the chart with that part enlarged beside it, with its own animation.
- Light and dark themes and an English or Persian interface.
- XRD analysis: smoothing, baseline removal, peak detection, d-spacing (Bragg's law) and
  crystallite size (Scherrer equation), with a downloadable peak table.
- More spectrum types are planned, one at a time (see the roadmap below).

## Tech stack

| Part     | Tools                                                                   |
| -------- | ----------------------------------------------------------------------- |
| Backend  | Python 3.12, FastAPI, pandas, NumPy, SciPy, pybaselines, uv             |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Apache ECharts, Zustand, i18next |
| Quality  | pytest, ruff, mypy (strict), Vitest, oxlint, CodeQL, Dependabot         |

## Quick start

Backend (API on http://localhost:8000, interactive docs at `/docs`):

~~~bash
cd backend
uv sync
uv run fastapi dev
~~~

Frontend (http://localhost:5173, requests to `/api` go to the backend):

~~~bash
cd frontend
npm ci
npm run dev
~~~

The backend can also run with Docker: `docker compose up --build`.

## Try the XRD analysis

1. Open the app and upload `samples/xrd-silicon-synthetic.csv`, a synthetic pattern with five peaks.
2. In the XRD panel choose the angle column (`two_theta`) and the intensity column (`intensity`).
3. Press Analyze. The chart shows the raw, smoothed and baseline curves with the peaks marked, and
   the table lists each peak with its position, d-spacing, height, width and crystallite size.

The same analysis is available from the API: `POST /api/v1/xrd/analyze`.

## Project structure

~~~text
backend/    FastAPI service: data parsing, summaries and XRD analysis
frontend/   React app: chart studio and the XRD panel
samples/    Example data files
.github/    Workflows, issue and pull request templates, Dependabot
~~~

## Development

~~~bash
# backend
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest

# frontend
cd frontend && npm run lint && npm run build && npm test
~~~

Every pull request runs these checks, CodeQL and a dependency review. Pull request titles follow
[Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` ...), because
the squashed title becomes the commit message on `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

The planned spectrum tools are tracked as issues in the
[Spectra analysis tools](https://github.com/h-shayeg/animated-chart-studio/milestones) milestone:
Raman, FTIR, UV-Vis, photoluminescence, XPS, EDS, XAS, NMR, mass spectra, TGA and DSC, TPD and TPR,
and phase identification for XRD.

Questions and ideas are welcome in
[Discussions](https://github.com/h-shayeg/animated-chart-studio/discussions). Security problems
should be reported privately, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
