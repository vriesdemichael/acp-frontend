---
number: ADR-006
title: Testing Strategy
status: accepted
date: 2026-03-17
---

# ADR-006: Testing Strategy

## Status

Accepted

## Rationale

Given the complexity of the protocol translation layer (ACP → AG-UI → SSE) and the HITL interaction model, correctness guarantees require more than unit tests alone. All three test categories are mandatory. The specific test framework is not yet decided and will be addressed in a separate ADR.

## Decision

All three test categories are **mandatory** for this project:

- **Unit tests** — cover business logic, utilities, and pure functions in isolation.
- **Integration tests** — cover internal protocol boundaries, e.g. the ACP↔AG-UI translation layer, MCP injection, and subprocess communication.
- **E2E tests** — cover browser-level user flows from the UI through to agent response.

**TypeScript type checking** is treated as a test gate and is enforced in fast CI checks (see ADR-005).

The **test framework(s)** for each category are **deferred** to a subsequent ADR. No framework may be introduced before that decision is recorded.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Unit tests only | Protocol translation and HITL flows require integration and E2E coverage to catch regressions |
| Skipping E2E | Browser-level flows are the primary user interface; they must be tested |

## Agent Instructions

- New code must include unit tests. Do not merge features without corresponding unit test coverage.
- New user-facing flows must include integration and/or E2E tests.
- Do not introduce any test framework (Jest, Vitest, Playwright, etc.) without an accepted ADR approving it.
- TypeScript type checking must pass before any PR is considered complete (see ADR-009).
