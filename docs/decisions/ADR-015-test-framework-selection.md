---
number: ADR-015
title: Test Framework Selection
status: accepted
date: 2026-03-18
---

# ADR-015: Test Framework Selection

## Status

Accepted — fulfils the deferred framework decision in ADR-006.

## Rationale

ADR-006 mandates unit, integration, and E2E tests but explicitly deferred the framework choice. No test framework may be introduced before this decision is recorded. This ADR selects frameworks for all three categories.

## Decision

| Category              | Framework                                     |
| --------------------- | --------------------------------------------- |
| Unit + integration    | **Vitest**                                    |
| React component tests | **@testing-library/react** (on top of Vitest) |
| E2E                   | **Playwright**                                |
| Coverage provider     | **V8** (via Vitest's built-in coverage)       |

**Vitest** — uses the same Vite transform pipeline already present in the project (ADR-013), requiring zero additional build configuration. ESM-native, fast watch mode, and Jest-compatible API for a low migration cost if needed. Built-in V8 coverage satisfies the Codecov upload requirement in ADR-005 (≥ 85% patch coverage).

**@testing-library/react** — idiomatic React component testing without a real browser; pairs naturally with Vitest's jsdom/happy-dom environment. Encourages testing from the user's perspective rather than implementation details.

**Playwright** — industry-standard E2E framework with first-class TypeScript support. Its `webServer` option integrates cleanly with the Vite dev server (ADR-013), starting the app automatically before test runs. Covers the browser-level user flows required by ADR-006.

Playwright's newer agentic tooling is also adopted for this repository. The official `init-agents` flow supports both `--loop=opencode` and `--loop=vscode`, which makes it a suitable cross-editor entry point for browser automation, planning, generation, and healing. This repository standardizes on those generated definitions rather than ad hoc editor-only setup.

Storybook is selected as the deterministic visual review surface for agent-driven frontend work. Agents should prefer Storybook stories and Playwright component tests for isolated UI states before relying on full-page E2E flows.

The intended UI iteration loop is:

1. implement or update the feature
2. add or update a Storybook story that isolates the relevant state
3. use Playwright to open the Storybook target on desktop and mobile viewports
4. inspect the rendered UI, screenshots, DOM, and browser diagnostics
5. critique the result against a visual rubric and the user's stated taste/direction
6. patch the UI
7. re-run the Playwright review loop until the result is acceptable
8. keep a smaller number of integrated app-level Playwright checks for regression coverage

**V8 coverage** — native Node.js/V8 instrumentation, no Babel transform required; lower overhead than Istanbul/nyc. Outputs standard LCOV reports consumed by Codecov (ADR-005).

## Rejected Alternatives

| Alternative           | Reason Rejected                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Jest                  | Requires additional Vite/ESM transform setup; duplicates configuration already present for Vitest; slower than Vitest for this stack |
| Mocha + Chai          | More manual wiring; no built-in coverage; no first-class Vite integration                                                            |
| Cypress               | Heavier than Playwright; Playwright preferred for superior TypeScript DX and Vite integration                                        |
| Istanbul/nyc coverage | Requires Babel instrumentation; V8 coverage is lower-overhead and natively supported by Vitest                                       |

## Agent Instructions

- Use **Vitest** for all unit and integration tests. Do not introduce Jest or Mocha.
- Use **@testing-library/react** for React component tests within the Vitest environment.
- Use **Playwright** for all E2E tests. Configure the `webServer` option to start the Vite dev server before E2E runs.
- For agentic Playwright workflows, generate and maintain official Playwright agent definitions for both **OpenCode** and **VS Code**. Do not ship OpenCode-only agent setup.
- Prefer Storybook-backed or component-level Playwright entry points for deterministic UI states when adding visual validation.
- For new or changed user-facing UI, create or update a Storybook story before doing visual refinement whenever the state can be isolated.
- Storybook states for UI review should cover the most relevant variants available for the surface, such as empty, loading, error, thinking/streaming, dense content, and mobile/narrow layouts.
- When refining UI, agents should use Playwright as an observation loop: open the story, inspect screenshots/DOM/console, apply fixes, and re-check on desktop and mobile.
- Agents should not treat Playwright as an automatic design oracle; they must use the user's stated preferences and a visual rubric that includes spacing rhythm, hierarchy, overflow/wrapping, contrast/focus visibility, responsive behavior, alignment consistency, and obvious regressions.
- If the user says they dislike how a feature looks, the default response is to create or update the relevant Storybook target and iterate with Playwright until the UI better matches the requested direction.
- Prefer Storybook-first visual iteration for design discussion; use full app Playwright flows after that for integrated behavior and regression coverage.
- Configure Vitest with the **V8 coverage provider** and output LCOV reports for Codecov upload (ADR-005).
- Do not introduce any additional test framework without a new ADR.
- All new code must include unit tests per ADR-006. New user-facing flows must include integration or E2E tests.
