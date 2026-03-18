---
number: ADR-003
title: Core Architecture Protocols
status: accepted
date: 2026-03-18
---

# ADR-003: Core Architecture Protocols

## Status

Accepted

## Rationale

The application must communicate with local CLI agents and expose a real-time streaming interface to a browser UI. During implementation, the repository mistakenly treated IBM/BeeAI's `acp-sdk` HTTP client model as if it were the Agent Client Protocol targeted by this project. That introduced incorrect assumptions about transport, session startup, and available TypeScript tooling. The ADR must state the correct protocol shape so future work does not continue on the wrong foundation.

## Decision

The application is built around three protocols, all implemented from scratch:

1. **ACP (Agent Client Protocol)** — the project targets the ACP standard published at `agentclientprotocol.com`, using JSON-RPC 2.0.
   - For local agents, ACP communication is over **stdio** using newline-delimited JSON-RPC messages.
   - The correct TypeScript dependency is **`@agentclientprotocol/sdk`**, not IBM/BeeAI's unrelated `acp-sdk` package.
   - The backend must launch local CLI agents as subprocesses and communicate over `stdin`/`stdout` via the SDK's stdio stream primitives.
   - Do **not** assume the agent exposes a loopback HTTP server, prints a port number, or streams ACP events over HTTP/SSE.
   - If an agent requires permission, the backend handles ACP permission requests and forwards them to the frontend before replying.

2. **AG-UI (Agent-User Interaction Protocol)** — the backend translates ACP `session/update` notifications into AG-UI Server-Sent Events (SSE) for the browser.
   - `TEXT_MESSAGE_CONTENT` maps to streaming text.
   - `TOOL_CALL_START` and `TOOL_CALL_RESULT` map to agent tool executions.
   - The `@copilotkit/react-core` hooks are used on the frontend to consume AG-UI events.

3. **MCP (Model Context Protocol)** — a global `mcp.json` configuration managed by the frontend or middleware.
   - When a new ACP session is started, the backend converts `mcp.json` into the ACP `mcpServers` array shape and passes it in `session/new` so all agents share the same tool access.

Existing wrappers (Toad, AionUi) are **not used**. Middleware and frontend are built in-house.

## Rejected Alternatives

| Alternative                                | Reason Rejected                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Toad                                       | Existing wrapper; would remove control over the protocol integration layer                                                  |
| AionUi                                     | Same as Toad                                                                                                                |
| IBM/BeeAI `acp-sdk` HTTP client            | It is not the ACP standard used by this project; its `baseUrl`/HTTP model conflicts with ACP stdio JSON-RPC local transport |
| Loopback HTTP as the default ACP transport | ACP defines stdio for local agents; streamable HTTP is still draft and must not be assumed                                  |
| WebSockets instead of SSE                  | SSE is sufficient for unidirectional server-to-client streaming and simpler to implement                                    |
| Long-polling                               | Too inefficient for real-time streaming                                                                                     |

## Agent Instructions

- The ACP layer must use the official **`@agentclientprotocol/sdk`** package and its stdio JSON-RPC transport for local agents.
- Do not use IBM/BeeAI `acp-sdk`, `baseUrl`-driven ACP clients, or port-discovery startup logic for ACP integrations.
- SSE is the **only** permitted transport from backend to frontend for streaming events.
- MCP `mcpServers` injection must happen at `session/new` time for every agent session, without exception.
- Do not introduce any third-party ACP/AG-UI wrapper library without a new ADR.
