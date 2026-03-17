---
name: read-adr
description: Read all ADR files, classify relevance, and derive a definition of done for branch and PR readiness.
license: MIT
compatibility: universal
metadata:
  domain: adr
  role: reader
---

# Goal
Provide ADR context for a task and produce an explicit Definition of Done (DoD).

# ADR discovery
- Look in `./docs/decisions/` first.
- If missing, search for `ADR`, `Architecture Decision Record`, or `decisions`.
- If no ADR exists, immediately report that the repository has no ADR.

# Handoff conventions (portable)
- If no ADR exists and downstream work requires ADR governance, signal handoff to `create-adr-structure`.
- If ADR exists but lacks clear DoD and caller requires PR readiness gating, signal handoff to `update-adr` (or demand user-defined DoD first).
- Prefer native subagent/handoff tooling where available; otherwise return explicit next-skill recommendation in plain output.

# Execution requirements
1. Read all ADR files.
2. Prefer parallel subagent/research execution where available.
3. For each ADR, determine:
   - still relevant or superseded/deprecated/rejected
   - relation to the query
   - always-relevant project constraints
   - development-workflow relevance
   - DoD constraints for branch/PR lifecycle

# Output format
Provide:
1. ADRs specifically relevant to the query
2. ADRs always relevant for the project
3. Definition of Done in this structure:

## Rules for PRs
### You may open a PR when:
- ...

### A PR is ready for human review when:
- ...

### A PR may be merged, auto-merged or auto-rebased when:
- ...

If the ADRs do not define a clear DoD, explicitly report that.
