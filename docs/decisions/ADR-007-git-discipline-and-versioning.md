---
number: ADR-007
title: Git Discipline and Versioning
status: accepted
date: 2026-03-17
---

# ADR-007: Git Discipline and Versioning

## Status

Accepted

## Rationale

A consistent commit format is needed to enable automated changelog generation and versioning. Branch protection on `main` prevents accidental breakage of the default branch.

## Decision

- **`main` is a protected branch.** No direct pushes are permitted.
- All commit messages must follow the **Conventional Commits** specification (e.g. `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`, `ci:`, `build:`, `perf:`, `style:`, `revert:`).
- **Release Please** is used for automated versioning and changelog generation based on commit history.
- Branch naming convention: `<issue-number>-short-description` (e.g. `42-sse-translation-layer`) is **recommended** but not hard-enforced by tooling.
- Merges into `main` are **rebase fast-forward only**. Merge commits and squash commits are not permitted (see ADR-009 for full merge requirements).

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Manual versioning | Error-prone; Release Please automates this reliably from commit history |
| Squash commits | Loses individual commit context; breaks Release Please changelog generation |
| Merge commits | Creates non-linear history; FF rebase enforces clean linear history |
| Enforced branch naming | Adds friction for small fixes; recommendation is sufficient |

## Agent Instructions

- Every commit message must start with a valid Conventional Commits type followed by a colon and a space.
- Never commit directly to `main`.
- Use the recommended branch naming pattern `<issue-number>-short-description` when creating branches.
- Do not manually edit `CHANGELOG.md` or version fields in `package.json` — Release Please manages these.
