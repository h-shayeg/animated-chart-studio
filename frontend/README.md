# Chart Studio frontend

The page of [Animated Chart Studio](../README.md): a React app with a chart studio, a statistical
summary and an XRD workspace. It talks to the [backend](../backend/README.md) for reading files
and for the analysis.

## Run it

You need Node 22, and the backend running on http://localhost:8000.

~~~bash
npm ci
npm run dev
~~~

The page is on http://localhost:5173. The dev server passes `/api` and `/health` on to the
backend, so the page and the API share one address, as they do in Docker.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the dev server with live reload. |
| `npm run build` | Checks the types and builds the page into `dist/`. |
| `npm run preview` | Serves the built page, to try it before a release. |
| `npm run lint` | Checks the code with oxlint. |
| `npm test` | Runs the tests once with Vitest. |

## Layout

~~~text
src/
  App.tsx        the page: header, tabs and the workspace of the chosen tab
  api.ts         the calls to the backend and the shapes of its answers
  store.ts       the loaded table (Zustand)
  chart/         functions that turn data and settings into a chart: options, colour ranges,
                 magnifier, XRD chart, export
  components/    the parts of the page: chart studio, summary panel, data table, upload panel,
                 ribbon, XRD workspace and results
  i18n/          the texts, in English and Persian
  spectra/       the list of spectrum tabs
~~~

## How it is put together

- **Charts** are drawn with Apache ECharts. Everything a chart shows is worked out by plain
  functions in `src/chart/` that return an option object. The components only hand that object to
  the chart. This keeps the logic testable without a browser.
- **Only the needed parts of ECharts** are loaded, in `src/chart/echartsSetup.ts`. The export code
  is loaded when the first export is asked for.
- **Texts** live in `src/i18n/`. Every text has an English and a Persian version; add both. In
  Persian the page runs right to left, so use the Tailwind classes that follow the direction
  (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) instead of left and right.
- **Themes**: the dark theme is the class `dark` on the page. Charts are drawn again with the
  matching ECharts theme when it changes.
- **State**: the loaded table is in a small Zustand store. The settings of a chart stay in the
  component that owns them.

## Tests

`npm test` runs every `*.test.ts` and `*.test.tsx` file next to the code it tests.

- Functions in `src/chart/` are tested directly. Some tests draw the chart with the real library
  as an SVG string, so a chart that cannot be drawn fails in the tests and not on the page.
- Components are tested with Testing Library. The chart itself is replaced by a stand-in there,
  because the test browser has no canvas.
- The backend is not needed: its answers are stubbed.

## Adding a spectrum tool

Each spectrum type has a tab in the ribbon. A tab that is not built yet shows a "coming soon"
panel with a link to its roadmap issue.

1. In `src/spectra/tabs.ts`, set the `issue` of the tab to `null`.
2. Build its workspace as a component, like `components/XrdWorkspace.tsx`, and show it in
   `App.tsx` when its tab is chosen.
3. Put its chart logic in `src/chart/` and its texts in `src/i18n/`, in both languages.

## In Docker

`Dockerfile` builds the page with Node and serves `dist/` with nginx on port 8080. `nginx.conf`
passes `/api`, `/health`, `/docs` and `/openapi.json` on to the backend service. Start both parts
with `docker compose up --build` in the folder above.
