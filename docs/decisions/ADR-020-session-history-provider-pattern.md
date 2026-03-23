---
number: ADR-020
title: Session History Provider Pattern
status: accepted
date: 2026-03-22
---

# ADR-020: Session History Provider Pattern

## Status

Accepted

## Rationale

The agent registry tracks only live in-memory sessions (those created through the ACP API within the current process lifetime). Users of Gemini CLI, GitHub Copilot CLI, and OpenCode accumulate large conversation histories in those tools' native storage formats that would otherwise be invisible in the session list. Surfacing that history alongside live sessions makes the UI genuinely useful as a conversation dashboard rather than just a chat launcher.

Adding each new history source as ad-hoc code in the registry would couple unrelated concerns and make it hard to add or remove providers. A provider pattern with a stable interface, a central aggregator, and deduplication logic isolates each reader from the others and from the registry.

## Decision

### Provider interface

A history session provider is a plain object conforming to:

```ts
interface HistorySessionProvider {
  id: string
  readSessions: (knownProjects: SessionProjectContext[]) => SessionSummary[]
}
```

- `id` is a stable string identifier used for logging and debugging only.
- `readSessions` receives the list of known projects (id, name, path) and returns zero or more `SessionSummary` objects. It must not throw — any I/O error must be caught internally and result in an empty return.
- `readSessions` is synchronous. Providers that require async I/O must perform it at module initialisation or use `execSync`; no provider may return a Promise.

### Registered providers (in order)

1. **`gemini-cli`** — reads `~/.gemini/tmp/<project-dir>/chats/*.json`. Matches sessions to projects via the per-directory `.project_root` file. Falls back gracefully when `GEMINI_TMP_DIR` does not exist.
2. **`copilot`** — reads `~/.copilot/session-state/<workspace-dir>/workspace.yaml` and `events.jsonl`. Matches via the `cwd` field. Falls back gracefully when `COPILOT_SESSION_STATE_DIR` does not exist.
3. **`opencode`** — reads `~/.local/share/opencode/opencode.db` via `execSync sqlite3`. Falls back gracefully when the db is absent or `sqlite3` is not in `PATH`.

### Path overrides

Each provider honours a corresponding environment variable to override its default path:

- `GEMINI_TMP_DIR` — overrides `~/.gemini/tmp`
- `COPILOT_SESSION_STATE_DIR` — overrides `~/.copilot/session-state`
- `OPENCODE_DB_PATH` — overrides `~/.local/share/opencode/opencode.db`

These overrides exist primarily for testing; production code should rely on the defaults.

### Aggregation and deduplication

`listHistorySessions(knownProjects)` calls every registered provider in order and flat-maps the results. `mergeSessions(liveSessions, historySessions)` merges live registry sessions with history sessions, deduplicates by session `id`, and sorts descending by `updatedAt`.

Deduplication semantics (`shouldReplace`):

1. A `live` source always beats a `history` source for the same `id`.
2. Among sessions from the same source, the one with the later `updatedAt` wins.
3. If `updatedAt` is equal, the one with the longer `title` wins (a heuristic for completeness).

### Session `source` field

`SessionSummary` carries a `source: 'live' | 'history'` field. History sessions use `source: 'history'`; live sessions use `source: 'live'`. The frontend may use this to visually distinguish history entries (e.g. a "CLI" badge).

### Read-only history sessions

History sessions are read-only. They cannot be resumed — no message may be sent to a history session. The frontend must guard against sending messages to sessions with `source === 'history'` and reflect this in the `ready` predicate.

## Rejected Alternatives

| Alternative                                          | Reason Rejected                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Embed history reading directly in the agent registry | Couples unrelated concerns; makes it hard to add or disable individual providers                                               |
| Async provider interface                             | Complicates the aggregator and the call site in the route handler; all existing providers can complete their I/O synchronously |
| Single generic filesystem-scanning provider          | Cannot handle the schema diversity across Gemini, Copilot, and OpenCode storage formats                                        |
| Persisting history sessions to the ACP session store | History sessions are ephemeral reflections of external tool state; storing them would create stale duplicates                  |

## Agent Instructions

- All history provider modules live in `backend/src/history/`. The aggregator is `backend/src/history/index.ts`.
- Every provider must implement `HistorySessionProvider` and be registered in the `HISTORY_SESSION_PROVIDERS` array in `index.ts`.
- `readSessions` must never throw. Wrap all I/O in try/catch and return `[]` on any error.
- `readSessions` must be synchronous. Do not introduce async providers without a new ADR.
- Honour the environment-variable path override in every provider (for test isolation).
- Do not add new providers without a corresponding unit test that covers the happy path and at least one error/missing-path case.
- History sessions must carry `source: 'history'`. Never set `source: 'live'` on a history session.
- The frontend `ready` predicate must remain false when `currentSession.source === 'history'`; do not allow message sends to history sessions.
