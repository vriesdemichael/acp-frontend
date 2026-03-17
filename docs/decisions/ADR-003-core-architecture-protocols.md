---
number: ADR-003
title: Core Architecture Protocols
status: accepted
date: 2026-03-17
---

# ADR-003: Core Architecture Protocols

## Status

Accepted

## Rationale

The application must communicate with local CLI agents and expose a real-time streaming interface to a browser UI. Three industry-standard protocols define the integration surface, and the middleware must be built by hand rather than using existing wrappers, to retain full control over the translation layer.

## Decision

The application is built around three protocols, all implemented from scratch:

1. **ACP (Agent Client Protocol)** — REST HTTP between the Node.js backend and each local CLI agent subprocess. The official ACP TypeScript SDK is used.
   - Agent subprocesses expose a local HTTP server; the Node.js backend communicates with them over loopback HTTP.
   - Streaming responses and tool executions are received from agents via ACP's SSE or async REST patterns.
   - If an agent requires permission, the backend intercepts and forwards to the frontend before responding.

2. **AG-UI (Agent-User Interaction Protocol)** — the backend translates ACP `session/update` payloads into AG-UI Server-Sent Events (SSE) for the browser.
   - `TEXT_MESSAGE_CONTENT` maps to streaming text.
   - `TOOL_CALL_START` and `TOOL_CALL_RESULT` map to agent tool executions.
   - The `@copilotkit/react-core` hooks are used on the frontend to consume AG-UI events.

3. **MCP (Model Context Protocol)** — a global `mcp.json` configuration managed by the frontend or middleware.
   - When a new agent session is started via `session/new`, the backend injects the `mcpServers` object into the initialization parameters so all agents share the same tool access.

Existing wrappers (Toad, AionUi) are **not used**. Middleware and frontend are built in-house.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Toad | Existing wrapper; would remove control over the protocol integration layer |
| AionUi | Same as Toad |
| stdio/JSON-RPC for ACP | HTTP is the standard ACP transport; REST over loopback is simpler, better tooled, and aligns with the official ACP TypeScript SDK |
| WebSockets instead of SSE | SSE is sufficient for unidirectional server-to-client streaming and simpler to implement |
| Long-polling | Too inefficient for real-time streaming |

## Agent Instructions

- The ACP layer must use **REST HTTP** via the official ACP TypeScript SDK. Do not implement a stdio/JSON-RPC transport for ACP.
- SSE is the **only** permitted transport from backend to frontend for streaming events.
- MCP `mcpServers` injection must happen at `session/new` time for every agent session, without exception.
- Do not introduce any third-party ACP/AG-UI wrapper library without a new ADR.
