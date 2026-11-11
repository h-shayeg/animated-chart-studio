# Contributing

Thanks for your interest in Animated Chart Studio!

## Development setup

You need Git, [uv](https://docs.astral.sh/uv/) for the backend (it installs Python 3.12) and
Node 22 for the frontend.

    git clone git@github.com:h-shayeg/animated-chart-studio.git
    cd animated-chart-studio

Backend, on http://localhost:8000:

    cd backend
    uv sync
    uv run uvicorn chart_studio_api.main:app --reload

Frontend, on http://localhost:5173, in a second terminal:

    cd frontend
    npm ci
    npm run dev

Or start both in Docker from the top folder, on http://localhost:8080:

    docker compose up --build

More about each part is in [backend/README.md](backend/README.md) and
[frontend/README.md](frontend/README.md).

## Checks

Run these before opening a pull request. CI runs the same ones.

From `backend/`:

    uv run ruff check .
    uv run ruff format --check .
    uv run mypy
    uv run pytest

From `frontend/`:

    npm run lint
    npm run build
    npm test

## Workflow

- Never push to `main`. Open a pull request from a feature branch instead.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for PR titles
  (`feat:`, `fix:`, `docs:`, `chore:`, ...). PRs are squash-merged, so the title
  becomes the commit message.
- Add or update tests with a change in behaviour.
- A text shown on the page needs an English and a Persian version.
- CI must pass before a pull request can be merged.
