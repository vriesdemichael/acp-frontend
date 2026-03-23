---
number: ADR-021
title: UI Session State Persistence via localStorage
status: accepted
date: 2026-03-22
---

# ADR-021: UI Session State Persistence via localStorage

## Status

Accepted

## Rationale

The chat workspace involves several pieces of selection state — current agent, current project, current session, and the set of projects visible in the session rail — that should survive a page reload without requiring the user to re-select them. Without persistence, every reload drops the user back to the bootstrap default selection.

Server-side session persistence is out of scope for a personal-use local tool (there is no user account). `localStorage` is the simplest available mechanism that works across page reloads within the same browser origin.

The keys used for persistence must be stable and documented. Ad-hoc key naming without a convention creates collisions and makes it impossible to reason about what state lives in storage.

## Decision

### Storage medium

`localStorage` (via `window.localStorage`) is the sole persistence mechanism for UI selection state. No cookies, no `sessionStorage`, no IndexedDB, no server-side state.

### Key convention

All keys are namespaced under `acp.chat.` to avoid collisions with other tools served from the same origin.

| Key                         | Type            | Description                                              |
| --------------------------- | --------------- | -------------------------------------------------------- |
| `acp.chat.agent`            | `string`        | ID of the most recently selected agent                   |
| `acp.chat.project`          | `string`        | ID of the most recently selected project                 |
| `acp.chat.session`          | `string`        | ID of the most recently active session                   |
| `acp.chat.visible-projects` | `JSON string[]` | Ordered array of project IDs visible in the session rail |

### Read semantics

On mount, `useAgUiChat` reads each key from localStorage as the initial state value. If a key is absent or its value is empty/unparseable, the hook falls back to the bootstrap default (e.g. the first active agent, the first available project).

`acp.chat.visible-projects` is parsed as a JSON array of strings. Any parse error or non-array value is treated as an empty array, and the hook defaults to showing all available projects.

### Write semantics

Each key is written via a `useEffect` that runs whenever the corresponding state value changes. Writes are synchronous (`localStorage.setItem`). When a value becomes `null` or an empty array, the key is removed (`localStorage.removeItem`) rather than stored as an empty value.

### Bootstrap priority

During bootstrap, `useAgUiChat` resolves the initial selection in this order of preference:

1. URL route parameters (passed as props: `sessionId`, `agentId`, `projectId`)
2. localStorage-persisted values (read on mount)
3. Backend-derived defaults (first active agent, first available project, most recent matching session)

### Stale state handling

Persisted IDs are validated at read time against the live backend data. An agent ID that no longer exists (or is no longer active) is silently discarded and replaced by the backend default. A project ID that is no longer available is similarly discarded. A session ID that no longer exists is silently ignored and the hook starts with no active session.

`acp.chat.visible-projects` is filtered at read time to remove any project IDs that are not present in the current project list.

### SSR / non-browser environments

All localStorage access is guarded by `typeof window !== 'undefined'`. In test environments and SSR contexts, reads return `null`/`[]` and writes are no-ops.

## Rejected Alternatives

| Alternative                                      | Reason Rejected                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `sessionStorage`                                 | Does not survive tab close/reopen; users expect selection to persist across restarts           |
| URL-only state                                   | URL becomes very long; agent and project are secondary context that should not clutter the URL |
| Server-side user preferences                     | No user account model; adds backend complexity for a personal-use tool                         |
| Global Zustand / Jotai store without persistence | Loses state on reload; the store would still need a persistence adapter                        |
| Unnamespaced keys (e.g. `agent`, `session`)      | Risk of collision with other tools or future features sharing the same origin                  |

## Agent Instructions

- All localStorage keys used by the chat workspace must follow the `acp.chat.<name>` naming convention.
- Never read or write localStorage outside of `useAgUiChat` without documenting the key in this ADR.
- All localStorage access must be guarded with `typeof window !== 'undefined'` checks.
- Persisted IDs must be validated against live backend data on every bootstrap; never use a persisted ID without confirming it still exists and is valid.
- Store removal (`localStorage.removeItem`) is preferred over storing empty/null values.
- Do not expand localStorage usage to cover message content, session transcripts, or structured blocks — these are either fetched from the backend or ephemeral (see ADR-019).
- When adding a new persisted key, update this ADR's key table before opening a PR.
