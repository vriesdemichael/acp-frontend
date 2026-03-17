---
number: ADR-013
title: Frontend Framework and Routing
status: accepted
date: 2026-03-17
---

# ADR-013: Frontend Framework and Routing

## Status

Accepted — supersedes the deferred meta-framework note in ADR-002.

## Rationale

The frontend is a local web application backed by a persistent Node.js process that holds agent connections and streams SSE. It has no need for server-side rendering, server functions, or deployment infrastructure. The highest priority is fast developer feedback for an agentic workflow, minimal ceremony, and full compatibility with the CopilotKit/AG-UI React hooks layer.

## Decision

- The frontend is a **Vite + React SPA** (Single Page Application).
- **TanStack Router** is used for client-side routing.
- No meta-framework (Next.js, Remix, TanStack Start) is used.

Rationale per choice:

**Vite:** fastest HMR in class; no SSR pipeline to reason about; standard setup for React SPAs.

**No meta-framework:** the backend is a separate persistent Node.js process that owns all agent session state, ACP connections, and SSE streaming. Meta-framework server functions and loaders are designed for stateless request/response — they are structurally incompatible with a process that maintains live subprocess connections between requests. SSR and server components provide no benefit for a local-only app with no SEO or deployment requirements.

**TanStack Router:** type-safe, file-based routing optional, excellent DX, no framework lock-in. Application routing needs are straightforward (chat view, MCP config panel, agent selector).

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Next.js (App Router) | SSR and Server Components are unused overhead; API routes are redundant given the dedicated Node.js backend; Vercel deployment is explicitly out of scope |
| TanStack Start | Server functions are stateless by design — incompatible with a backend that must maintain live ACP subprocess connections and SSE streams across requests |
| Remix | Strong SSR/form focus unused here; meta-framework overhead not justified |
| React Router (v7) | TanStack Router preferred for superior type safety; React Router is a valid fallback if compatibility issues arise |

## Agent Instructions

- The frontend must be scaffolded as a Vite + React SPA. Do not introduce a meta-framework without a new ADR.
- Use TanStack Router for all client-side routing. Do not use React Router or Next.js routing conventions.
- All frontend–backend communication goes through the persistent Node.js backend (REST or SSE). Do not co-locate server logic in the frontend build.
