---
number: ADR-004
title: Supported AI Agent Integrations
status: accepted
date: 2026-03-17
---

# ADR-004: Supported AI Agent Integrations

## Status

Accepted

## Rationale

The application orchestrates local CLI-based AI coding agents. An explicit list of supported agents is required to scope the ACP adapter implementations and clarify the authentication model.

## Decision

The following agents are in scope:

| Agent | Status |
|---|---|
| GitHub Copilot (chat / CLI) | Required |
| Gemini CLI | Required |
| OpenAI Codex | Required |
| Claude Code | Required |
| opencode | Optional |

**Authentication model:** agents authenticate by inheriting the existing local CLI login state of the host machine (e.g. the user has previously run `copilot login`, `gemini login`, etc.). The spawned ACP subprocess inherits this state. No new API keys or paid credentials are required at runtime beyond what the user already has through their existing CLI tool subscriptions.


## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Requiring separate API keys | Breaks the "inherit existing CLI auth" model; adds unnecessary credential management |

## Agent Instructions

- Each supported agent requires its own ACP adapter implementation in `backend/`.
- No agent adapter may introduce a new authentication mechanism without a new ADR.
- opencode integration may be deferred; it must not block delivery of the required agents.
- Do not add new agent integrations beyond this list without a new or updated ADR.
