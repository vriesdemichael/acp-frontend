---
number: ADR-008
title: Pre-commit Hooks and Code Quality
status: accepted
date: 2026-03-17
---

# ADR-008: Pre-commit Hooks and Code Quality

## Status

Accepted

## Rationale

Fast feedback before a commit reaches CI reduces wasted pipeline time and catches trivial issues locally. The same checks must also run in CI to prevent bypassed hooks from reaching the default branch.

## Decision

- **Husky** manages pre-commit hooks.
- Pre-commit hooks run the **fast checks**: lint, TypeScript type check, and unit tests — identical to the CI fast checks stage (see ADR-005).
- The same fast checks are independently enforced in CI; passing locally does not substitute for CI.
- **Agents are explicitly forbidden from bypassing hooks** using `--no-verify`, `HUSKY=0`, or any equivalent mechanism. Bypassing is only permitted when the user explicitly grants permission in the current conversation for that specific instance.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| lint-staged only (no pre-commit type check) | Type errors on unstaged files would slip through; full type check required |
| CI enforcement only (no local hooks) | Slower feedback loop; local hooks catch issues before they reach CI |
| Allowing routine hook skipping | Defeats the purpose of hooks; creates inconsistency between local and CI |

## Agent Instructions

- Never run `git commit --no-verify` or set `HUSKY=0` unless the user has explicitly granted permission for that specific commit in the current conversation.
- If hooks fail, fix the underlying issue rather than bypassing.
- When setting up the repository for the first time, ensure `pnpm install` triggers Husky installation via a `prepare` script.
