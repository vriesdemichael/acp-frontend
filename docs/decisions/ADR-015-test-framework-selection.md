---
number: ADR-015
title: Test Framework Selection
status: accepted
date: 2026-03-17
---

# ADR-015: Test Framework Selection

## Status

Accepted — fulfils the deferred framework decision in ADR-006.

## Rationale

ADR-006 mandates unit, integration, and E2E tests but explicitly deferred the framework choice. No test framework may be introduced before this decision is recorded. This ADR selects frameworks for all three categories.

## Decision

| Category | Framework |
|---|---|
| Unit + integration | **Vitest** |
| React component tests | **@testing-library/react** (on top of Vitest) |
| E2E | **Playwright** |
| Coverage provider | **V8** (via Vitest's built-in coverage) |

**Vitest** — uses the same Vite transform pipeline already present in the project (ADR-013), requiring zero additional build configuration. ESM-native, fast watch mode, and Jest-compatible API for a low migration cost if needed. Built-in V8 coverage satisfies the Codecov upload requirement in ADR-005 (≥ 85% patch coverage).

**@testing-library/react** — idiomatic React component testing without a real browser; pairs naturally with Vitest's jsdom/happy-dom environment. Encourages testing from the user's perspective rather than implementation details.

**Playwright** — industry-standard E2E framework with first-class TypeScript support. Its `webServer` option integrates cleanly with the Vite dev server (ADR-013), starting the app automatically before test runs. Covers the browser-level user flows required by ADR-006.

**V8 coverage** — native Node.js/V8 instrumentation, no Babel transform required; lower overhead than Istanbul/nyc. Outputs standard LCOV reports consumed by Codecov (ADR-005).

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Jest | Requires additional Vite/ESM transform setup; duplicates configuration already present for Vitest; slower than Vitest for this stack |
| Mocha + Chai | More manual wiring; no built-in coverage; no first-class Vite integration |
| Cypress | Heavier than Playwright; Playwright preferred for superior TypeScript DX and Vite integration |
| Istanbul/nyc coverage | Requires Babel instrumentation; V8 coverage is lower-overhead and natively supported by Vitest |

## Agent Instructions

- Use **Vitest** for all unit and integration tests. Do not introduce Jest or Mocha.
- Use **@testing-library/react** for React component tests within the Vitest environment.
- Use **Playwright** for all E2E tests. Configure the `webServer` option to start the Vite dev server before E2E runs.
- Configure Vitest with the **V8 coverage provider** and output LCOV reports for Codecov upload (ADR-005).
- Do not introduce any additional test framework without a new ADR.
- All new code must include unit tests per ADR-006. New user-facing flows must include integration or E2E tests.
