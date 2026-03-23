---
number: ADR-019
title: A2UI Structured Rendering on Top of AG-UI
status: accepted
date: 2026-03-22
---

# ADR-019: A2UI Structured Rendering on Top of AG-UI

## Status

Accepted

## Rationale

The existing AG-UI integration forwards all assistant output as plain `TEXT_MESSAGE_CONTENT` events, which the frontend renders as raw text. Tool calls are tracked via `TOOL_CALL_START` / `TOOL_CALL_RESULT` events in the backend translator but are currently swallowed on the frontend — no tool activity UI is shown to the user. A structured rendering layer on top of AG-UI would allow the chat UI to surface tool activity, plans, and other structured assistant output as dedicated application components rather than prose.

Adding this layer requires decisions about the event channel, the payload schema, the component registry boundary, fallback behaviour, and persistence — all of which must be stable before components can be built against them.

## Decision

### Event channel

Structured assistant payloads are carried as AG-UI `CUSTOM` events (`EventType.CUSTOM`, shape `{ type: 'CUSTOM', name: string, value: unknown }`). This reuses the existing SSE transport without breaking the existing text-message pipeline.

Two named CUSTOM event subtypes are defined for this initial pass:

- `a2ui:tool_call` — emitted by `StreamTranslator` when it processes a `tool_call` or `tool_call_update` ACP update; carries the tool name, call id, current argument snapshot, and result when available.
- `a2ui:message_block` — reserved for future structured prose blocks; not emitted in the initial implementation.

### Payload schema

```ts
interface A2UIToolCallPayload {
  callId: string
  toolName: string
  args?: unknown // streaming JSON snapshot; may be partial
  result?: string // set when tool_call_update is processed
  done: boolean
}
```

The `callId` field links `tool_call` and `tool_call_update` events to the same card.

### ChatMessage extension

`ChatMessage` is extended with an optional field:

```ts
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  structuredBlocks?: StructuredBlock[]
}

type StructuredBlock = { kind: 'tool_call'; payload: A2UIToolCallPayload }
```

`structuredBlocks` is populated by the SSE handler in `useAgUiChat.ts` when it receives `a2ui:*` CUSTOM events. A CUSTOM event that arrives before the corresponding TEXT_MESSAGE_START may create a synthetic assistant message to host the block.

### Renderer

A new `StructuredAssistantMessage` React component renders `structuredBlocks` when present. It is backed by an explicit component registry (a plain `Record<StructuredBlock['kind'], React.ComponentType<...>>`). Unrecognised `kind` values are ignored silently. Any renderer that throws is caught by a React error boundary and falls back to `null` (the block is hidden rather than crashing the conversation).

### ChatTranscript integration

`ChatTranscript` checks `message.structuredBlocks?.length` alongside `message.content`. If both are present, structured blocks are rendered above the plain text content for that message bubble. If only `structuredBlocks` is present and `content` is empty, the bubble is rendered without a text section.

### Feature flag

A module-level constant `ENABLE_A2UI` in `frontend/src/config/features.ts` gates all structured rendering. When `false`, CUSTOM events are ignored and `StructuredAssistantMessage` is never instantiated. The constant defaults to `true` but can be set to `false` to disable the feature without removing code. No environment-variable plumbing is required — the flag is a source-level boolean.

### Persistence and replay

`structuredBlocks` are not persisted to the session store. On session reload, only `content` (plain text) is restored. Tool call cards are therefore only visible during an active streaming run, not on replay. This is acceptable for the initial pass; persistence may be added in a follow-up issue.

### First-wave supported widgets

Only one widget type ships in the initial implementation: **tool call card** — shows tool name, a streaming argument view, and the result once available.

Explicitly out of scope for the initial pass:

- Plans or checklists
- File/diff summary cards
- Approval/interrupt panels
- Arbitrary HTML or uncontrolled component injection

### Backend changes

`StreamTranslator.onSessionUpdate` is updated to emit a `CUSTOM` event with `name: 'a2ui:tool_call'` in addition to the existing `TOOL_CALL_START` / `TOOL_CALL_RESULT` AG-UI events when processing `tool_call` and `tool_call_update` ACP updates.

## Rejected Alternatives

| Alternative                                                             | Reason Rejected                                                                                    |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Separate SSE event stream for A2UI payloads                             | Requires a second `EventSource` connection and complicates session lifecycle management            |
| Embed structured payloads inside `TEXT_MESSAGE_CONTENT` as JSON strings | Brittle; breaks plain-text rendering and requires regex parsing of content                         |
| Ship a full A2UI runtime/DSL                                            | Excessive complexity for a personal-use tool; a constrained registry is sufficient                 |
| Persist `structuredBlocks` to the session store                         | Adds schema migration complexity; tool call cards are ephemeral by nature; deferred to a follow-up |
| Use a feature-flag environment variable (VITE\_\*)                      | No existing env-var infrastructure in the project; source-level constant is simpler and sufficient |

## Agent Instructions

- All structured payloads must travel as AG-UI `CUSTOM` events; no new SSE event types or endpoints may be introduced without a new ADR.
- The `ENABLE_A2UI` constant in `frontend/src/config/features.ts` must gate all structured rendering; never read it inside `StreamTranslator` (backend is always allowed to emit CUSTOM events).
- The component registry must be a plain `Record<kind, ComponentType>` — no dynamic imports, no eval, no arbitrary component injection.
- Every renderer must be wrapped by a React error boundary that falls back to `null` on throw.
- `structuredBlocks` must not be required for any existing consumer of `ChatMessage`; it is always optional.
- Unit tests must cover: plain text message rendered normally, valid `tool_call` block rendered, malformed CUSTOM event ignored without crash, `ENABLE_A2UI = false` causes CUSTOM events to be ignored.
- `StreamTranslator` must continue to emit `TOOL_CALL_START` / `TOOL_CALL_RESULT` in addition to `a2ui:tool_call` CUSTOM events (do not replace, only add).
- Do not persist `structuredBlocks`; session reload restores only `content`.

### toolName resolution in StreamTranslator

`StreamTranslator` maintains a `toolCallNames: Map<string, string>` that records the `toolCallId → toolName` mapping when a `tool_call` ACP update is processed. When a subsequent `tool_call_update` arrives, the resolved name is looked up from this map and included in the emitted `a2ui:tool_call` CUSTOM event. The map is cleared in `onRunFinish()` to prevent unbounded growth across runs. Never derive `toolName` by re-parsing the original `tool_call` update from `tool_call_update` — the update does not carry the title.

### upsertBlock merge semantics

The `upsertBlock` helper in `useAgUiChat.ts` must **merge** payloads when a block with the same `callId` already exists: spread the existing payload first, then overlay the incoming payload. This ensures that fields set on the initial `tool_call` event (e.g. `toolName`, `args`) are not overwritten by the follow-up `tool_call_update` event which carries only `result` and `done`. Never replace an existing block wholesale.

### Run-scoped block attachment

When a CUSTOM event arrives and there is no assistant message to attach to yet, the handler must find the most recent **user** message first, then search for an assistant message strictly **after** that user message. This prevents the block from being attached to an assistant message from a previous run. If no such assistant message exists, a synthetic assistant message (id `a2ui-<callId>`) is created and appended to the transcript. React keys for rendered blocks must use `${block.kind}-${block.payload.callId}` — never array indices.
