---
number: ADR-012
title: Project Scope and Network Access Model
status: accepted
date: 2026-03-17
---

# ADR-012: Project Scope and Network Access Model

## Status

Accepted

## Rationale

The application runs locally on the user's machine and may be exposed to personal devices. Explicit constraints are required to prevent accidental exposure to the open internet, which would create security risks for a tool that spawns local CLI agents with access to the host system.

## Decision

- The application is **personal-use only**. Multi-user and multiplayer features are out of scope.
- The application runs **locally** on the user's machine.
- Remote access to personal devices is provided exclusively via **Tailscale**. No other remote access mechanism is used.
- The application must **never be exposed to or accessible from the open internet**. Do not bind to public interfaces, configure port forwarding, or add any feature that enables open-internet access.
- There is no cloud deployment target.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Open internet exposure | Unacceptable security risk: the application spawns local CLI subprocesses that inherit host credentials and filesystem access |
| VPN alternatives to Tailscale | Tailscale is the chosen personal network solution; other VPNs are not in scope |
| Multi-user / shared hosting | Out of scope by design; this is a personal tool |

## Agent Instructions

- Do not implement any feature that exposes the application beyond localhost or Tailscale.
- Do not configure listening interfaces to `0.0.0.0` with public access in mind; localhost (`127.0.0.1`) is the correct default.
- Do not add authentication, session management, or access control designed for multi-user scenarios.
- If a task or feature would imply open-internet or multi-user access, raise this with the user before proceeding — do not implement it as described.
