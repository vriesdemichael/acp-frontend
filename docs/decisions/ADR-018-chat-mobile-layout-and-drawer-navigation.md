---
number: ADR-018
title: Chat Mobile Layout and Drawer Navigation
status: accepted
date: 2026-03-21
---

# ADR-018: Chat Mobile Layout and Drawer Navigation

## Status

Accepted

## Rationale

The chat IA redesign moved the product away from a dashboard-style shell toward a conversation-first layout. On desktop, that means a slim informational header, a dedicated session rail, and workspace tools rendered in the main conversation column. On mobile, the same structure cannot remain permanently visible without consuming most of the viewport and pushing the transcript/composer out of the primary interaction path.

The product direction agreed during the redesign is explicit: mobile navigation should behave more like Gemini, ChatGPT, and OpenCode, where the top bar exposes a hamburger control and the session rail appears as a temporary side drawer. The chat composer must remain part of the main content flow, and files/diff views must not reintroduce a second persistent side panel.

## Decision

- The chat header is **informational only**. It may show session title, project, agent, and connection state, but it must not become the primary location for project management or workspace switching controls.
- On **desktop**, the session rail remains visible as the left column of the chat layout.
- On **mobile and narrow layouts**, the session rail is **closed by default** and opened from a **hamburger button in the top header**.
- The mobile session rail is rendered as a **side drawer with a backdrop**. It overlays the transcript rather than reflowing the entire page into a stacked dashboard.
- The mobile drawer contains the same primary navigation content as the desktop rail:
  - session groups
  - new-session entry
  - project manager entry point
  - settings entry point
- The mobile drawer must be **dismissible** by an explicit close control and by tapping the backdrop.
- The desktop rail and mobile drawer are treated as **separate rendered surfaces**, not a single DOM tree merely hidden by CSS, so interactive controls remain unambiguous for accessibility and tests.
- Files and diff views are rendered in the **main conversation area** on all breakpoints. They must remain mutually exclusive and must not hide the composer.
- The project manager remains a **dedicated modal/view launched from the session rail**, not a permanent inline mobile section and not a header dropdown.

## Rejected Alternatives

| Alternative                                           | Reason Rejected                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Keep the session rail permanently visible on mobile   | Consumes too much vertical and horizontal space; makes the app feel like a cramped dashboard instead of a chat-first tool |
| Stack the session rail above the transcript on mobile | Pushes active conversation and composer too far down the screen; poor fit for repeated chat interactions                  |
| Move project manager and settings into header menus   | Reintroduces header clutter after intentionally simplifying the header                                                    |
| Reintroduce a right-side workspace panel on mobile    | Conflicts with the new conversation-first shell and would hide the composer during files/diff workflows                   |
| Use a bottom tab bar for sessions/files/diff/settings | Does not scale well to grouped sessions and project management actions                                                    |

## Agent Instructions

- Keep the chat header minimal and informational. Do not add project-management or global agent-selection UI back into the header without a new ADR.
- Preserve the desktop left session rail while using a hamburger-triggered drawer for the same navigation on mobile.
- When implementing the mobile drawer, render mobile-only dismiss controls only inside the drawer instance. Do not rely on hidden desktop controls for behavior.
- Use explicit accessible names for navigation controls (for example `Open navigation`, `Close navigation`, and distinct labels for project-management triggers) so route tests and assistive technologies can distinguish them.
- Keep files and diff in the main content column across breakpoints; the composer must remain visible while either tool surface is open.
- For user-facing layout changes in this area, update or add regression coverage and visual review surfaces for both desktop and mobile states.
