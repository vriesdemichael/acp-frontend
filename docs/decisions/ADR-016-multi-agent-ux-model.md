---
number: ADR-016
title: Multi-Agent UX Model
status: accepted
date: 2026-03-19
---

# ADR-016: Multi-Agent UX Model

## Status

Accepted

## Rationale

The backend already supports multiple simultaneous active agents (see ADR-003, ADR-004). The original frontend UX only ever surfaced one agent at a time via an `AgentSelector` combobox in the chat header. This created a false constraint: users had to manually switch between agents, sessions were grouped by agent backend in the sidebar, and only the "selected" agent could receive new messages. This design did not match the underlying backend capability and prevented natural multi-agent workflows.

## Decision

- **All active agents are shown simultaneously.** There is no global "selected agent" concept. Every agent with `status === 'active'` is available at all times.
- **The session list is flat, sorted descending by `updatedAt`.** Sessions are no longer grouped by agent backend.
- **Each session row shows a colored status dot and the agent name** so the user always knows which backend owns a given chat.
- **Agent status dot colors:**
  - Emerald (with glow) — `status === 'active'`
  - Amber — `status === 'detected'`
  - Slate — any other status (`unavailable`, `missing`, etc.)
- **Sessions from agents with `status === 'disabled'` are hidden.** Sessions from agents with any other non-active status (e.g. `unavailable`, `detected`) remain visible with their status dot shown.
- **"New chat" button behavior:**
  - If exactly one active agent exists: clicking immediately creates a session with that agent.
  - If multiple active agents exist: clicking toggles an inline `role="menu"` popover listing active agents; selecting one creates the session.
  - If no active agents exist: the button is disabled.
- **`AgentSelector` header component is deleted.** The chat header contains only project/session status info — no agent selection UI.
- **`sendMessage` derives the target agent from the current session's `agentId` field.** No explicit agent must be passed by the caller.
- **`ready` (composer enabled) requires:** a current session exists AND its owning agent has `status === 'active'` AND the selected project has `status === 'available'` AND no session creation is in progress.
- **`activeAgents`** (agents with `status === 'active'`) is a first-class derived value exported from `useAgUiChat` and used throughout the UI.
- **`ProjectWorkspacePanel` receives an `activeAgentCount: number` prop** and disables workspace actions (open in editor, reveal in Finder, etc.) when `activeAgentCount === 0`.

## Rejected Alternatives

| Alternative                                        | Reason Rejected                                                                                                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep single selected-agent model, add multi-tab UI | Does not expose the backend's native concurrent-agent capability; users must still manually switch                                                                                      |
| Group sessions by agent in a collapsible tree      | Adds visual complexity; a flat list sorted by recency is simpler and matches chat app conventions                                                                                       |
| Agent selector in a sidebar, not the header        | Header was already removed to reduce clutter; sidebar session list already shows per-session agent identity                                                                             |
| `role="listbox"` for the agent picker popover      | Listbox requires `aria-selected` state management and active-descendant focus handling; the picker is a one-shot action menu, which maps correctly to `role="menu"` / `role="menuitem"` |
| Hiding sessions from unavailable agents            | Unavailable agents may recover; hiding their sessions would be disorienting. Only explicitly `disabled` agents have their sessions removed                                              |

## Agent Instructions

- Never re-introduce a global "selected agent" concept or an `AgentSelector` header control.
- The `useAgUiChat` hook must expose `activeAgents: AgentSummary[]` (filtered to `status === 'active'`).
- `createSession(agentId: string)` and `startNewSession(agentId: string)` must accept an explicit `agentId`; they must never infer it from a global selected-agent state.
- `sendMessage` must derive the target `agentId` from the session record, not from a global selected-agent state.
- `ready` must gate on `currentSessionAgent?.status === 'active'` in addition to the project and session checks.
- The session list must use `useMemo` for `agentById` (a `Map<string, AgentSummary>`), `activeAgents`, and `visibleSessions` to avoid O(n×m) recomputation on every render.
- The "New chat" picker dropdown must use `role="menu"` on the container and `role="menuitem"` on each agent button.
- `ProjectWorkspacePanel` must accept and act on `activeAgentCount: number`; disable workspace controls when count is 0.
