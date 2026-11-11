# Changelog

The changes of each release are written down here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the version numbers follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-11

The first release: animated charts, statistics and XRD analysis.

### Data

- CSV and Excel files are read, and so are the text files instruments write (`.xy`, `.xye`, `.dat`, `.asc`, `.txt`, `.tsv`). Notes above the numbers are skipped; tabs, spaces, semicolons and decimal commas are understood.
- The data is shown as a table, with the type of each column and its missing values.
- A statistical summary of every file: mean, standard deviation, quartiles and the most frequent values of each column, and a correlation table of the number columns.
- Limits: 10 MB per file, 50 000 rows, and 2 000 columns in a text or CSV file.

### Charts

- Line, area, bar, scatter and pie charts with colour palettes and an animation that can be replayed.
- Colour ranges on the X or the Y axis, cropping, a zoom slider and an adjustable chart height.
- A magnifier: a frame on the chart with that part enlarged beside it.
- Export as PNG, JPEG, SVG, or as a WebM video of the animation.

### XRD analysis

- Import with checks that say what is wrong with a file that is not an XRD pattern.
- Smoothing, baseline removal, peak detection, d-spacing (Bragg's law) and crystallite size (Scherrer equation).
- Material identification against a library of 49 common materials, with the Miller indices of every peak.
- The peak table downloads as CSV and the chart saves as a PNG, JPEG or SVG picture.

### Interface

- English and Persian (right to left), light and dark themes.
- A ribbon with a tab for each spectrum type. XRD is built; Raman, FTIR, UV-Vis, photoluminescence, XPS, EDS, XAS, NMR, mass spectra, TGA and DSC, and TPD and TPR are planned.

### Running it

- `docker compose up --build` starts the whole app on http://localhost:8080.
- Each release publishes two Docker images, `ghcr.io/h-shayeg/animated-chart-studio-backend` and `ghcr.io/h-shayeg/animated-chart-studio-frontend`.

[1.0.0]: https://github.com/h-shayeg/animated-chart-studio/releases/tag/v1.0.0
