---
number: ADR-005
title: CI/CD Pipeline Structure
status: accepted
date: 2026-03-17
---

# ADR-005: CI/CD Pipeline Structure

## Status

Accepted

## Rationale

A consistent, ordered CI pipeline is needed to give fast feedback on trivial issues while reserving expensive build-dependent checks for later stages. A required status check ensures no PR can merge without a clean pipeline run.

## Decision

The CI pipeline runs on **GitHub Actions** in the following fixed order:

1. **Fast checks** — lint, TypeScript type check, unit tests. Must not require a build step.
2. **Checkpoint** — explicit gate job between fast and slow stages; fails if fast checks did not pass.
3. **Slow checks** — any step that requires a build: integration tests, E2E tests, build verification.
4. **CI Complete** — a synthetic summary job that succeeds only when all previous stages pass. This job is the **required GitHub status check** for PRs; no PR may merge without it.

**Coverage:** test coverage is uploaded to **Codecov**. The minimum PR patch coverage is **85%**. Codecov enforcement runs as part of slow checks before CI Complete.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Single flat job | No fast-feedback signal; lint failures waste time running expensive checks |
| No required status check | Leaves the door open to merging broken PRs |
| Coverage threshold below 85% | Insufficient guarantee for a project valuing correctness |

## Agent Instructions

- When adding new CI jobs, place them in the correct stage (fast or slow) based on whether they require a build artifact.
- Never move type checking or unit tests to the slow stage.
- The **CI Complete** job must remain a required check — do not remove or rename it without a new ADR.
- Codecov upload and patch coverage enforcement must run before the CI Complete job succeeds.
