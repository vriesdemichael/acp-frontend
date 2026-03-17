---
number: ADR-002
title: Language and Runtime Stack
status: accepted
date: 2026-03-17
---

# ADR-002: Language and Runtime Stack

## Status

Accepted

## Rationale

The project requires a shared language that works across both the browser frontend and a Node.js backend, with strong typing to support the complex protocol translation work (ACP, AG-UI, MCP).

## Decision

- **TypeScript** is used throughout — both `frontend/` and `backend/`.
- **Node.js** is the backend runtime.
- **React** is the frontend UI library, served as a Vite SPA (see ADR-013).
- **Tailwind CSS** is the styling framework.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| JavaScript (no TypeScript) | TypeScript is required; type safety is a first-class concern given protocol boundary complexity |
| Alternative backend runtimes (Deno, Bun) | Node.js chosen for ecosystem maturity and compatibility with local CLI tool spawning |
| CSS modules / styled-components | Tailwind CSS chosen for utility-first consistency |

## Agent Instructions

- All source files must be TypeScript (`.ts` / `.tsx`). Plain `.js` files are not permitted in `frontend/` or `backend/`.
- TypeScript type checking must pass as part of the fast CI checks (see ADR-005).
