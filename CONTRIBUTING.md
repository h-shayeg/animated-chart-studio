# Contributing

Thanks for your interest in Animated Chart Studio!

## Development setup

You need Git, [uv](https://docs.astral.sh/uv/) and Python 3.12.

    git clone git@github.com:h-shayeg/animated-chart-studio.git
    cd animated-chart-studio/backend
    uv sync

## Checks

Run these from `backend/` before opening a pull request:

    uv run ruff check .
    uv run ruff format --check .
    uv run mypy
    uv run pytest

## Workflow

- Never push to `main`. Open a pull request from a feature branch instead.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for PR titles
  (`feat:`, `fix:`, `docs:`, `chore:`, ...). PRs are squash-merged, so the title
  becomes the commit message.
- CI must pass before a pull request can be merged.
