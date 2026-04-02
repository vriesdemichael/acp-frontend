---
number: ADR-023
title: acpx as the Live Agent Session Layer
status: accepted
date: 2026-04-02
---

# ADR-023: acpx as the Live Agent Session Layer

## Status

Accepted — supersedes the in-process adapter model in ADR-003 and the per-agent adapter requirement in ADR-004.
Supersedes the React + TanStack Router decision in ADR-013.
Refines ADR-020 and ADR-022 (history providers are unchanged; config schema changes in Phase 3).

## Rationale

The current architecture has four coupled concerns that evolved from different assumptions:

1. **Live session management** — the backend spawns agents as ACP subprocesses via `StdioAcpProcess`, manages sessions in `AgentRegistry`, and translates ACP SDK callbacks into AG-UI SSE events through `StreamTranslator`.
2. **History reading** — three filesystem readers (gemini, copilot, opencode) are registered as `HistorySessionProvider` instances and merged with live sessions in `AgentRegistry.listSessions()`.
3. **Agent handoff/continuation** — a custom `buildHandoffPrompt` helper injects prior context into a new session prompt.
4. **Provider config** — `backends.json` conflates live agent command/args, history path hints, and enabled flags into a single record per agent.

Several problems emerged from this design:

- Implementing each new agent (Codex, Claude Code, opencode) required a dedicated ACP adapter in `backend/src/adapters/`. Issues #13, #14, #15 tracked this work but stalled because ACP stdio support across agents is inconsistent.
- `@ag-ui/core` is only used for 9 string constants (`EventType` enum). `@copilotkit/react-core` has zero actual imports anywhere in the frontend — it is dead code. Both packages add dependency weight with no functional benefit.
- `useAgUiChat.ts` is 971 lines of React hooks. The `messagesRef`/`sessionsRef` pattern is a workaround for stale closures inherent to React's hook model. Svelte 5 runes eliminate this class of workaround entirely.
- The frontend bundle includes React (~350 kB) for a single-route local application with no SSR, SEO, or deployment requirements.

**acpx** (`openclaw/acpx`) is a headless ACP CLI client that already ships adapters for all required agents: Copilot, Gemini CLI, OpenAI Codex, Claude Code, opencode, and more. It manages persistent session state in `~/.acpx/sessions/`, sessions scoped by `(agentCommand, cwd, optionalName)`. Its `--format json` flag outputs raw ACP NDJSON for automation. Delegating live session management to acpx eliminates the need for per-agent adapter implementations in this repository.

acpx does **not** replace the FS history readers. The `sessions history` command stores only lightweight turn previews. Full transcripts still require the native FS readers defined in ADR-020 and ADR-022.

## Decision

### 1. acpx as live session manager

All live agent session management is delegated to **acpx** via subprocess.

- Starting a session: `acpx <agentCommand> sessions new [--cwd <path>] [--name <name>]`
- Listing sessions: `acpx <agentCommand> sessions list`
- Sending a prompt and streaming the response: `acpx --format json <agentCommand> prompt "<text>"`
- Continuing from a prior session: `acpx sessions new --from <acpxSessionId>` then stream a prompt

The backend maintains a thin mapping: frontend session UUID → acpx session scope `(agentCommand, cwd, name)`.

### 2. NDJSON streaming via `--format json`

`acpx --format json` outputs raw ACP NDJSON lines on stdout. The backend reads these line-by-line and feeds them into a simplified `StreamTranslator` that maps ACP event types to SSE events using local string constants (no `@ag-ui/core` dependency).

SSE remains the only permitted transport from backend to browser (unchanged from ADR-003).

### 3. Local event-name constants replace `@ag-ui/core`

A small local `stream-events.ts` file defines the 9 string constants previously sourced from `@ag-ui/core`'s `EventType` enum. `@ag-ui/core` is removed from all dependencies.

### 4. Config split

`backends.json` is split into two separate config concerns:

- **acpx config** (`.acpxrc.json` / `~/.acpx/config.json`) — manages live agent commands, args, and credentials. This is acpx's own config; the backend reads it via `acpx config show`.
- **`history-sources.json`** — FS reader path hints only, replacing the `historyPathHints`, `cliHistoryPathHints`, `commandCandidates`, and `command`/`args` fields in `BackendDefinitionRecord`.

The existing history providers (gemini, copilot, opencode) and their interfaces defined in ADR-020 and ADR-022 are unchanged.

### 5. Svelte 5 replaces React

The frontend is migrated from React + TanStack Router to **Svelte 5**.

- `useAgUiChat.ts` (971 lines) maps 1:1 to a Svelte store + `$effect` blocks. Svelte 5 runes eliminate the `messagesRef`/`sessionsRef` stale-closure workarounds.
- All components in `frontend/src/components/` are rewritten as `.svelte` files.
- TanStack Router is removed. The application has two routes (`/chat`, `/settings`); a minimal Svelte-native router (or hash-based routing) is sufficient.
- `react-markdown` + `react-syntax-highlighter` are replaced with framework-agnostic alternatives (`marked` + `@shikijs/markdown-it` or equivalent).
- SSE handling uses the plain `EventSource` DOM API unchanged — it is framework-agnostic.

**Removed packages:** `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@tanstack/react-router`, `@tanstack/router-vite-plugin`, `@copilotkit/react-core`, `@ag-ui/core`, `@testing-library/react`, `@testing-library/jest-dom`, `@storybook/react`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `react-markdown`, `react-syntax-highlighter`.

**Added packages:** `svelte@5`, `@sveltejs/vite-plugin-svelte`.

**Kept unchanged:** Vite, Tailwind CSS, Hono, Vitest, Playwright.

### 6. Playwright tests are preserved unchanged

All existing Playwright tests interact with the DOM through the browser — they are framework-agnostic and must pass without modification after the Svelte 5 migration.

### 7. ACP adapter directory is deleted

`backend/src/adapters/` is deleted in its entirety after the acpx migration is complete. `@agentclientprotocol/sdk` is removed if no longer imported.

## Rejected Alternatives

| Alternative                                         | Reason Rejected                                                                                                                                                             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continue building per-agent ACP adapters in-process | acpx already ships adapters for all required agents; issues #13, #14, #15 stalled; duplicating this work is wasteful                                                        |
| Datastar for server-driven UI                       | Text accumulation, markdown rendering, and client-side session state are client concerns; pushing them server-side via Datastar tightly couples Hono to UI styles/HTML      |
| Vue 3 instead of Svelte 5                           | Svelte 5 runes map more directly to the existing `useRef`-heavy React hook pattern; smaller bundle; no virtual DOM overhead                                                 |
| Keep React, drop only CopilotKit                    | CopilotKit removal alone does not solve the 971-line hook stale-closure problem or the bundle size; Svelte 5 addresses both                                                 |
| Keep `@ag-ui/core` for the 9 constants              | No benefit over a 9-line local constants file; removes an unnecessary package                                                                                               |
| acpx replacing FS history readers                   | acpx `sessions history` stores only lightweight previews; full transcripts require native FS readers (Gemini JSON, Copilot YAML/jsonl, opencode.db)                         |
| SvelteKit instead of plain Svelte 5                 | SvelteKit meta-framework overhead is unjustified for a local-only app with no SSR/deployment requirements — same reason TanStack Start and Next.js were rejected in ADR-013 |

## Agent Instructions

- All live agent session management must go through acpx subprocess calls. Do not re-implement in-process ACP adapters.
- `acpx --format json` NDJSON stdout is the only source for live streaming. Do not use the `@agentclientprotocol/sdk` stdio adapter for new sessions.
- The `@ag-ui/core` package must not be imported anywhere. Use the local `stream-events.ts` constants file.
- The `@copilotkit/react-core` package must not be imported or listed as a dependency.
- The frontend must be Svelte 5. Do not introduce React, Vue, or any other component framework without a new ADR.
- Do not use SvelteKit. The frontend is a Vite + Svelte 5 SPA only.
- TanStack Router must not be used. Routing must be handled with a minimal Svelte-native solution.
- History providers (gemini, copilot, opencode) defined in ADR-020 and ADR-022 remain in place unchanged. Do not remove or replace them.
- `history-sources.json` is the only config file for FS reader path hints. Do not read `command`, `args`, or `commandCandidates` fields from any config file for live agent sessions.
- All Playwright tests must pass without modification after the Svelte 5 migration.
- Do not delete `backend/src/adapters/` until all acpx session manager tests pass and the adapters directory is confirmed empty of active code paths.
- Do not add any agent integration beyond those already supported by acpx without a new ADR.
