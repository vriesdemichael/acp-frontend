---
number: ADR-014
title: Backend HTTP Server Framework
status: accepted
date: 2026-03-17
---

# ADR-014: Backend HTTP Server Framework

## Status

Accepted

## Rationale

The Node.js backend (ADR-002) must expose REST endpoints for the frontend and stream AG-UI Server-Sent Events (SSE) to the browser (ADR-003). An HTTP server framework must be chosen before any backend routes can be built. No framework may be introduced without an accepted ADR (per ADR-006 principles applied to all architectural components).

## Decision

**Hono** is used as the HTTP server framework for the Node.js backend, running via `@hono/node-server`.

Key reasons:

- **First-class SSE streaming** — Hono's built-in `streamSSE()` helper directly supports the AG-UI SSE transport required by ADR-003, with no manual `res.write()` plumbing.
- **TypeScript-first DX** — typed routes and typed middleware with no additional configuration; aligns with the TypeScript-only constraint in ADR-002.
- **Minimal surface area** — no heavy abstractions or opinionated project structure; easier to reason about and test routes in isolation.
- **Native Node.js adapter** — `@hono/node-server` wraps the standard Node.js `http` module, keeping the runtime dependency on Node.js only (ADR-002).
- **Testability** — Hono apps can be tested with `app.request()` in unit/integration tests without starting a real HTTP server, fitting the Vitest-based test setup (ADR-015).

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Express | Battle-tested but requires manual SSE implementation (`res.write` / `res.flush`), weaker TypeScript ergonomics, no built-in SSE helper |
| Fastify | Solid option but more configuration overhead for SSE streaming; less ergonomic TS route typing |
| FastAPI (Python) | Would supersede ADR-002 (Node.js runtime) and introduce a language boundary between frontend TypeScript types and backend; incompatible with the ACP TypeScript SDK (ADR-003) |

## Agent Instructions

- Use `hono` and `@hono/node-server` for all backend HTTP route definitions and the server entry point.
- Use Hono's `streamSSE()` helper for all SSE endpoints — do not implement SSE manually via `res.write`.
- Do not introduce any other HTTP server framework alongside or instead of Hono without a new ADR.
- Keep route handlers thin; delegate business logic to separate modules so routes remain independently testable via `app.request()`.
