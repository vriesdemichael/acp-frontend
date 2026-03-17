---
number: ADR-001
title: Repository Structure and Package Manager
status: accepted
date: 2026-03-17
---

# ADR-001: Repository Structure and Package Manager

## Status

Accepted

## Rationale

The project has a frontend and a backend component. A decision is needed on how to organise them within version control and which package manager to use, to ensure consistent tooling and a single release cycle.

## Decision

- The project lives in a single repository.
- `frontend/` and `backend/` are plain subdirectories of the repository root — not separate pnpm workspace packages.
- **pnpm** is the package manager. A single root `package.json` covers both subdirectories.
- Frontend and backend share one release cycle; there is no independent versioning per subdirectory.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Separate pnpm workspace packages | Frontend and backend share a release cycle; workspace isolation adds complexity without benefit |
| Turborepo / Nx | Orchestration tooling is unnecessary overhead at this scale |
| npm | pnpm chosen for stricter dependency resolution and more efficient disk usage |
| yarn | pnpm preferred; yarn offers no advantage here |

## Agent Instructions

- All package installation and script commands must use `pnpm`.
- Do not create separate `package.json` files in `frontend/` or `backend/` unless this ADR is superseded.
- Do not add monorepo tooling (Turborepo, Nx, pnpm workspaces) without a new ADR.
