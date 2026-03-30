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

export interface A2UIReasoningPayload {
  title?: string
  text: string
}

export interface A2UISkillInvocationPayload {
  callId: string
  skillName: string
  status: 'running' | 'completed' | 'error'
  result?: string
}

export interface A2UISubagentInvocationPayload {
  callId: string
  agentName: string
  status: 'running' | 'completed' | 'error'
  prompt?: string
  result?: string
  sessionId?: string
}

export interface A2UIAttachmentPayload {
  mime: string
  filename: string
  url: string
}

export interface A2UICompactionNoticePayload {
  auto: boolean
  overflow: boolean
}

export interface A2UIFileOperationPayload {
  path: string
  operation: 'create' | 'edit' | 'delete' | 'reference'
  source?: string
}

export interface A2UIModelSwitchPayload {
  fromModelId?: string
  toModelId: string
}

export interface A2UIApprovalNoticePayload {
  title: string
  message?: string
  state: 'pending' | 'approved' | 'rejected'
}

export interface A2UITruncationNoticePayload {
  tokenLimit?: number
  tokensRemoved?: number
  messagesRemoved?: number
}

export type StructuredBlock =
  | { kind: 'tool_call'; payload: A2UIToolCallPayload }
  | { kind: 'reasoning'; payload: A2UIReasoningPayload }
  | { kind: 'skill_invocation'; payload: A2UISkillInvocationPayload }
  | { kind: 'subagent_invocation'; payload: A2UISubagentInvocationPayload }
  | { kind: 'attachment'; payload: A2UIAttachmentPayload }
  | { kind: 'file_operation'; payload: A2UIFileOperationPayload }
  | { kind: 'model_switch'; payload: A2UIModelSwitchPayload }
  | { kind: 'approval_notice'; payload: A2UIApprovalNoticePayload }
  | { kind: 'compaction_notice'; payload: A2UICompactionNoticePayload }
  | { kind: 'truncation_notice'; payload: A2UITruncationNoticePayload }
