---
number: ADR-022
title: History Source Discovery and Source-Aware Provider Settings
status: accepted
date: 2026-03-27
updated: 2026-03-30
---

# ADR-022: History Source Discovery and Source-Aware Provider Settings

## Status

Accepted — refines ADR-020 for multi-source history discovery. Updated 2026-03-30 to consolidate four separate Copilot backend records into one logical `copilot` backend and to introduce separate path-hint fields for VS Code workspace storage roots and CLI session directories.

## Rationale

The initial history provider pattern in ADR-020 assumed that each provider could be represented by one default path plus an optional single-path override. That assumption does not hold for GitHub Copilot and VS Code.

Copilot history is split across distinct products and storage layers:

- Copilot CLI stores session data in CLI-owned directories such as `~/.copilot/session-state/` and `~/.copilot/history-session-state/`.
- VS Code Copilot Chat stores recent chat history in VS Code workspace storage databases such as `state.vscdb` under `Code/User/workspaceStorage/...`.
- VS Code Copilot Chat may also use adjacent extension-owned resources such as `GitHub.copilot-chat/...`.
- In WSL and other remote-development setups, the backend may need to inspect both Linux-local paths and host-side Windows paths mounted under `/mnt/...`.

Treating all of that as one provider path hides useful state, makes discovery brittle, and gives the frontend no way to explain what was found, what was missing, and which sources are actually being parsed. The current provider settings are therefore too coarse for real-world Copilot history recovery.

An earlier implementation split Copilot into four separate top-level backends: `copilot-cli-wsl`, `copilot-cli-host`, `copilot-vscode-host`, `copilot-vscode-wsl`. This over-fragmented the user-facing model. VS Code Copilot Chat is a history-only enrichment source, not a live ACP target. The distinction between WSL and Host CLI runtimes is an internal implementation detail, not a meaningful product distinction for users.

A single `historyPathHints` field was initially used for the unified `copilot` backend, with implicit prefix-based routing: paths starting with `/mnt/` were treated as Host CLI roots, other absolute paths as WSL CLI roots, and all paths were also used as VS Code workspace storage roots. This implicit routing was confusing and undocumented. Two separate fields are now used instead.

## Decision

### One logical `copilot` backend

The user-facing backend id for all GitHub Copilot integration is `copilot`. There is one backend card in settings, one live adapter, and one history provider.

Internally, the history provider scans all discoverable sources — CLI session directories (WSL and Host paths), VS Code workspaceStorage (Linux and mounted host) — and presents them as discovered source descriptors. VS Code is strictly a history-only enrichment source and is never used as a live ACP target.

### Two separate path-hint fields for the `copilot` backend

The `BackendDefinitionRecord` for `copilot` uses two separate optional fields:

- `historyPathHints` — VS Code workspace storage root directories to search for Copilot Chat history. Passed to the VS Code source readers.
- `cliHistoryPathHints` — CLI session-state directories to search for Copilot CLI history. WSL paths start with `/` (but not `/mnt/`); Windows-mounted host paths start with `/mnt/`. Passed to the CLI source readers.

When both are empty the backend uses default auto-discovered paths for both sources.

The settings UI for the `copilot` backend shows two distinct labeled textareas — "VS Code Workspace Storage Roots" and "CLI Session Directories" — with inline help text explaining the expected path format for each. Other backends continue to show a single generic "History Path Hints" textarea.

### Migration

When an existing `backends.json` config file contains the old split Copilot records (`copilot-cli-wsl`, `copilot-cli-host`, `copilot-vscode-host`, `copilot-vscode-wsl`), the backend automatically migrates them on first read:

- All `historyPathHints` from legacy records are merged into both `historyPathHints` (VS Code roots) and `cliHistoryPathHints` (absolute paths, which are also CLI candidates).
- The CLI command and args from whichever legacy backend had them are preserved.
- The merged record is written as id `copilot`.
- Non-Copilot user-added backends are left unchanged.

### VS Code as history-only source

VS Code Copilot Chat is confirmed to write its chat transcripts independently of the Copilot CLI session-state directory. It is useful as a secondary history source when CLI sessions are not present. It must never be registered as a live backend or used as an ACP process target.

### CLI > VS Code deduplication

When the same session id appears in both CLI sources and VS Code sources, the CLI record takes precedence. Otherwise all sessions from both sources are shown.

### Provider families vs discovered sources

History ingestion distinguishes between a high-level provider family and one or more concrete discovered sources.

- A provider family represents an external product or integration, such as `copilot`, `gemini_cli`, or `opencode`.
- A discovered source represents one concrete readable or unreadable location, such as a CLI session directory, a VS Code workspace database, or an extension resource folder.

The backend must discover zero or more sources per provider family before parsing sessions.

### Source descriptor contract

The backend exposes source discovery results through a structured descriptor type shared with the frontend.

Each descriptor must include at least:

- stable source id
- provider family id
- source kind
- absolute path
- platform or environment classification
- access status (`readable`, `missing`, `permission_error`, `invalid`, or equivalent)
- signal status (`contains_history`, `empty`, `unknown`, or equivalent)

Descriptors may additionally include metadata such as `lastModifiedMs`, inferred session count, parse warnings, and whether the path was auto-discovered or manually supplied.

### Multi-path discovery

Providers must perform best-effort discovery across multiple default roots instead of assuming a single canonical path.

For the `copilot` provider, discovery must consider all of the following classes when they are accessible from the current runtime environment:

- Linux-local CLI session directories (`~/.copilot/session-state/`, `~/.copilot/history-session-state/`)
- Host-side CLI session directories reachable from WSL via `/mnt/<drive>/Users/.../...`
- Linux-local VS Code user data and workspace storage
- Windows-host VS Code user data reachable from WSL via `/mnt/<drive>/Users/.../AppData/Roaming/Code/User/...`
- Adjacent Copilot extension resources associated with discovered workspace storage entries
- Remote-development related locations when the current environment can see them

Discovery is synchronous and non-fatal. Missing or unreadable paths must be reported in source descriptors when possible, but must not cause provider failure.

### Parser routing by source kind

Parsing is selected by discovered source kind, not only by provider family.

Examples:

- a VS Code `state.vscdb` source uses the VS Code workspace-storage parser
- a Copilot CLI `events.jsonl` source uses the CLI event-log parser
- an extension resource directory uses a resource-specific parser when supported

This allows one provider family to aggregate sessions from multiple storage schemas without collapsing them into a single path-specific code path.

### Settings and frontend visualization

The frontend must present source discovery as an inspectable list rather than a minimal provider-path form.

The provider settings experience must show, per provider family:

- discovered sources
- source kind and path
- readability or error state
- whether history-like data was detected
- any relevant metadata that helps the user understand coverage

Manual configuration remains supported, but as additional search roots or explicit source hints rather than a single required path field.

### Remote host awareness

When the backend runs inside WSL or another environment that can access a host filesystem through mounted paths, discovery must treat those mounted host paths as first-class candidates.

In particular, WSL-based discovery for VS Code history must not assume that the only relevant files live inside the Linux home directory. Host-side Windows VS Code storage reachable through `/mnt/...` is part of the supported search space.

## Rejected Alternatives

| Alternative                                                        | Reason Rejected                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Keep one path per provider                                         | Copilot and VS Code history are genuinely multi-source; one path cannot represent the available data accurately     |
| Hide discovery details from the frontend                           | Users need to see what was found and why a provider appears incomplete or empty                                     |
| Treat mounted Windows paths as out of scope when running in WSL    | Recent VS Code chat history may live on the host side even when the repo and backend run in WSL                     |
| Create a separate provider for every physical path type            | Over-fragments the model; provider families should stay product-oriented while parsers remain source-kind-specific  |
| Keep four separate Copilot backends as top-level user-facing ids   | VS Code is history-only, not a live target; WSL vs Host CLI is an internal detail; one backend is simpler for users |
| One combined `historyPathHints` field with implicit prefix routing | CLI roots and VS Code roots need different hint types; implicit routing is confusing and undocumented to users      |

## Agent Instructions

- The user-facing backend id for GitHub Copilot is `copilot`. Do not introduce new `copilot-*` split backends.
- Do not model `copilot_vscode` as a live backend. It is always history-only enrichment.
- When reading existing config files, apply migration logic for legacy `copilot-cli-wsl`, `copilot-cli-host`, `copilot-vscode-host`, `copilot-vscode-wsl` records.
- Do not model `copilot_vscode` as a single filesystem path. Always treat it as a discovery-driven, multi-source provider family.
- When adding or changing history settings APIs, expose discovered source descriptors to the frontend rather than only returning provider-level booleans.
- Prefer manual overrides as additional search roots or source hints; do not require users to replace auto-discovery with one absolute path.
- In WSL-aware code, include mounted host paths under `/mnt/...` in the discovery strategy for VS Code history when those paths are accessible.
- Missing or unreadable candidate paths must never throw out the whole provider; report them as source status instead.
- Add tests that cover at least one Linux-local discovery case and one mounted-host discovery case for Copilot or VS Code history.
- When deduplicating sessions found in both CLI and VS Code sources, CLI takes precedence over VS Code for the same session id.
- The `copilot` backend uses two separate path-hint fields: `historyPathHints` for VS Code workspace storage roots and `cliHistoryPathHints` for CLI session-state directories. Do not conflate them into a single field. Do not add routing logic that inspects path prefixes to determine hint type — use the dedicated field instead.
