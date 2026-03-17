---
number: ADR-010
title: Documentation and Publishing Strategy
status: accepted
date: 2026-03-17
---

# ADR-010: Documentation and Publishing Strategy

## Status

Accepted

## Rationale

The application is distributable and requires end-user documentation that stays in sync with releases. A versioned publishing approach ensures users can always view docs matching the version they are running.

## Decision

- Documentation is published to **GitHub Pages**.
- **Mike** is used for versioned documentation, enabling multiple doc versions to coexist on GitHub Pages.
- Publication is automated as part of the **Release Please** release flow — new docs are published on each release.
- **ADRs** are included in the documentation site in Markdown format, but they are **excluded from the main navigation** (they are available via direct link or a separate section, not the primary nav).
- Target audience: **end users**. Content covers:
  - UI feature guides
  - High-level architecture overview (without implementation detail)
- Implementation internals, API references, and developer guides are not in scope for the public docs site.
- Detailed content structure and navigation design are deferred to a subsequent issue/ADR.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Single unversioned docs site | Users on older versions would see docs for a newer version |
| Manual publishing | Error-prone; automated publishing in the release flow is more reliable |
| Including ADRs in main nav | ADRs are governance documents, not end-user content; they should not clutter end-user navigation |

## Agent Instructions

- Documentation publishing must be wired into the Release Please release workflow — do not create a separate manual publish step.
- Mike must be configured to tag doc versions matching the release version.
- ADR Markdown files must be included in the docs build but placed outside the primary navigation structure.
- Do not add developer-internal API documentation to the public docs site without a new ADR.
