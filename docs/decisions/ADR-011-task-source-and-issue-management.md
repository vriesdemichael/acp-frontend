---
number: ADR-011
title: Task Source and Issue Management
status: accepted
date: 2026-03-17
---

# ADR-011: Task Source and Issue Management

## Status

Accepted

## Rationale

A single authoritative source of work items is needed to avoid fragmentation across tools. Rules for how agents interact with that source must be explicit to prevent unsolicited changes to the backlog.

## Decision

- **GitHub Issues** are the sole source of work items. No other issue tracker, project board, or planning tool is used.
- Agents **may not create, edit, or close GitHub Issues without explicit user permission** in the current conversation for that specific action.
- Agents **may suggest** creating a new issue when they identify work that falls outside the current task's scope. The suggestion must be presented to the user for approval before any issue is created.
- Agents **may create a new issue** when the user explicitly requests it or approves a suggestion.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Jira / Linear / other trackers | GitHub Issues is sufficient for a personal project; additional tooling adds unnecessary overhead |
| Agents autonomously managing the backlog | Creates unsolicited changes to the backlog; user must retain control |

## Agent Instructions

- Never create, edit, or close a GitHub Issue without explicit user permission granted in the current conversation.
- When you identify work outside the current issue's scope, propose a new issue to the user and wait for approval before creating it.
- All implementation work must be traceable to a GitHub Issue. Do not begin implementation without a linked issue.
- PRs must reference their issue using `closes #<issue-number>` in the description (see ADR-009).
