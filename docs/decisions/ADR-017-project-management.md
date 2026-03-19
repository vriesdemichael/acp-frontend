---
number: ADR-017
title: Project Management — Config File Format and Add-Project UX
status: accepted
date: 2026-03-19
---

# ADR-017: Project Management — Config File Format and Add-Project UX

## Status

Accepted

## Rationale

Projects are the primary organizational unit in the application: every chat session belongs to a project, the workspace explorer is scoped to a project, and workspace actions (open in editor, reveal in Finder) target a project. Without a way to add new projects through the UI, users are forced to manually edit `.acp/projects.json` on disk and restart the application — an unacceptable workflow for end users.

The backend already has a config file at `.acp/projects.json` (or `$ACP_PROJECTS_CONFIG_PATH`), a `writeProjectConfig()` function, and per-project status derivation (`available | missing | invalid`). What is missing is a mutation endpoint and frontend UX to add projects.

## Decision

### Config file

- Projects are stored in **`.acp/projects.json`** at the project working directory (or the path in `$ACP_PROJECTS_CONFIG_PATH`).
- Schema: `{ "projects": [{ "id": string, "name": string, "path": string }] }`.
- The file is created automatically on first read if absent, pre-populated with the current working directory as the sole project.
- The `id` field is a URL-safe slug derived from the `name` (e.g. `slugifyProjectId("My Project")` → `"my-project"`). IDs must be unique within the config file.
- The `status` field (`available | missing | invalid`) is **computed at read time** from the filesystem and is never stored in the config file.

### Backend API mutations

- **`POST /api/projects`** — adds a new project entry. Request body: `{ name: string, path: string }`. The backend resolves the path to absolute, derives an `id`, appends to the config, persists via `writeProjectConfig()`, and returns the new `ProjectSummary`.
- **`DELETE /api/projects/:id`** — removes a project by ID, persists the change, returns 204.
- No filesystem scanning or discovery endpoint is provided. Users supply the path explicitly.

### Frontend UX — add project

- The **`ProjectWorkspacePanel`** (right sidebar) includes an **"Add project" button** below the project selector.
- Clicking opens an **inline form** (not a modal) with two fields: **Name** (text) and **Path** (text). Path accepts an absolute filesystem path typed or pasted by the user.
- On submit the form calls `POST /api/projects`, refreshes the project list, and auto-selects the newly added project.
- Validation: the path field must be non-empty; the name field defaults to the basename of the path if left blank.
- Error handling: if the backend returns a non-2xx response, an inline error message is shown beneath the form.
- The form can be dismissed with a **Cancel** button or by pressing Escape.

### Frontend UX — project selector

- The existing `<select>` dropdown in `ProjectWorkspacePanel` lists all projects from the backend (including `missing` and `invalid`), with non-available ones shown as disabled options.
- A project with `status === 'missing'` or `status === 'invalid'` shows a warning badge in the panel body.
- No inline delete UI is provided in this iteration; projects are removed by editing the config file directly.

## Rejected Alternatives

| Alternative                                                     | Reason Rejected                                                                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Filesystem scanning / auto-discovery                            | Cannot reliably identify which directories are "projects" without a signal (e.g. `.git`, package file); produces noise |
| Native OS folder picker (`<input type="file" webkitdirectory>`) | Electron-only or requires browser permissions not available in a standard Vite SPA served over localhost               |
| Modal dialog for the add-project form                           | Inline form in the panel is lighter weight and keeps the user's context; no additional library needed                  |
| Storing project `status` in the config file                     | Status depends on current filesystem state; stale stored status would be misleading                                    |
| Using XDG base directories for the config file                  | The existing `.acp/` convention is established and working; changing it would break existing installs                  |
| Providing a delete-project UI in this iteration                 | Rarely needed; manual config file edit is acceptable for removal                                                       |

## Agent Instructions

- Add `POST /api/projects` in `backend/src/routes/projects.ts`. Validate that `path` is an absolute path. Derive `id` using `slugifyProjectId(name)`. Reject with 409 if an entry with the same `id` already exists. Persist via `writeProjectConfig()` and return the new `ProjectSummary` with status computed from the filesystem.
- Add `DELETE /api/projects/:id` in `backend/src/routes/projects.ts`. Return 404 if the id is not found, 204 on success.
- Update `useAgUiChat` to expose an `addProject(name: string, path: string): Promise<ProjectSummary>` function that calls `POST /api/projects` and refreshes the project list.
- Add the "Add project" inline form to `ProjectWorkspacePanel`. The form must include a `name` text input and a `path` text input. The name must default to `basename(path)` when the user leaves it blank. Submit must be disabled while a request is in flight.
- Do not use a modal library; the form renders inline within the panel below the project selector.
- After a successful add, call `onProjectSelect` with the new project's id to auto-select it.
- Add backend integration tests for `POST /api/projects` and `DELETE /api/projects/:id`.
- Add frontend unit tests for the add-project form in `ProjectWorkspacePanel`.
