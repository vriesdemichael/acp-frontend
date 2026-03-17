# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the acp-frontend project.

## What is an ADR?

An ADR captures a significant architectural or engineering decision, including its context, rationale, decision, rejected alternatives, and instructions for agents implementing work in this repository.

## File Format

All ADRs are written in **Markdown** (`.md`).

## Naming Convention

```
ADR-NNN-short-title.md
```

- `NNN` is a zero-padded sequential number (e.g. `001`, `002`)
- `short-title` is a lowercase kebab-case slug describing the decision
- Example: `ADR-001-project-foundation.md`

## Required Fields

Every ADR file must contain the following YAML frontmatter and Markdown sections.

### YAML Frontmatter

```yaml
---
number: ADR-NNN
title: <Human-readable title>
status: <proposed | accepted | rejected | superseded | deprecated>
date: YYYY-MM-DD
---
```

### Markdown Sections

| Section | Description |
|---|---|
| `## Status` | Current status and, if superseded, reference to superseding ADR |
| `## Rationale` | Why this decision was needed |
| `## Decision` | Explicit constraints and choices made |
| `## Rejected Alternatives` | What was considered and why it was not chosen |
| `## Agent Instructions` | Machine-readable rules for AI agents implementing work |

## Validation

Run the ADR validator to check all records conform to the required structure:

```bash
node docs/decisions/validate-adrs.mjs
```

This script checks that:

- Each `.md` file (excluding `README.md`) has the required YAML frontmatter fields
- Each file contains all required Markdown section headings
- ADR numbers are sequential and unique
- Status values are valid

## ADR Status Lifecycle

```
proposed → accepted → deprecated
         ↘ superseded (by ADR-NNN)
         → rejected
```

## Adding a New ADR

1. Copy the template below
2. Use the next sequential number
3. Fill in all required fields
4. Run the validator: `node docs/decisions/validate-adrs.mjs`
5. Submit via a PR following the git conventions described in ADR-001

## ADR Template

```markdown
---
number: ADR-NNN
title: Short Decision Title
status: proposed
date: YYYY-MM-DD
---

# ADR-NNN: Short Decision Title

## Status

Proposed

## Rationale

<!-- Why is this decision needed? What problem does it solve? -->

## Decision

<!-- What was decided? State explicit constraints and choices. -->

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| <!-- Option --> | <!-- Reason --> |

## Agent Instructions

<!-- Rules agents must follow when implementing work affected by this ADR. -->
```
