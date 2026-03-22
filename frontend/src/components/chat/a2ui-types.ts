/**
 * A2UI structured block types used by the chat rendering layer.
 *
 * These types define the payload shapes carried via AG-UI CUSTOM events
 * (name: "a2ui:tool_call") and stored as optional structuredBlocks on ChatMessage.
 */

export interface A2UIToolCallPayload {
  /** Stable identifier linking tool_call and tool_call_update events. */
  callId: string
  /** Human-readable tool name (e.g. "bash", "read_file"). */
  toolName: string
  /** Streaming argument snapshot; may be a partial JSON string. */
  args?: unknown
  /** Result text once the tool_call_update is processed. */
  result?: string
  /** True once the tool call has completed (tool_call_update received). */
  done: boolean
}

export type StructuredBlock = { kind: 'tool_call'; payload: A2UIToolCallPayload }
