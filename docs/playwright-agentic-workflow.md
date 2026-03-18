# Playwright Agentic Workflow

This repository supports an agentic visual loop using Storybook and Playwright for both OpenCode and VS Code.

## What is installed

- Storybook for deterministic component states
- Playwright E2E config against Storybook
- Playwright component testing config for chat surfaces
- Playwright agent definitions for:
  - OpenCode via `opencode.json` and `.opencode/prompts/`
  - VS Code / GitHub Copilot via `.github/agents/` and `.vscode/mcp.json`

## Local commands

```bash
pnpm storybook
```

```bash
pnpm test:e2e
```

```bash
pnpm test:ct
```

## Recommended agent loop

1. Open or run Storybook
2. Use Playwright planner/generator/healer agents to define or refine tests
3. Validate visual states in Storybook first
4. Add a smaller number of integrated app-level Playwright flows later

## Agent initialization

Playwright agent definitions were generated for two loops:

```bash
pnpm dlx playwright init-agents --loop=opencode
pnpm dlx playwright init-agents --loop=vscode
```

Regenerate them after Playwright upgrades.

## VS Code note

Playwright documents the agentic VS Code workflow behind:

```bash
npx playwright init-agents --loop=vscode
```

VS Code v1.105 or newer is required for the full agent experience.

## OpenCode note

OpenCode agent prompts and MCP wiring live in:

- `opencode.json`
- `.opencode/prompts/`

## Seed and specs

- `seed.spec.ts` is the bootstrap file for Playwright agents
- `specs/` stores human-readable Playwright plans

## Current scope

Initial component/story coverage exists for the main chat surfaces:

- `ChatHeader`
- `ChatTranscript`
- `SessionList`
- `ChatComposer`
- `ChatSidePanel`

Initial Playwright checks cover desktop and mobile snapshots/assertions against those surfaces.
