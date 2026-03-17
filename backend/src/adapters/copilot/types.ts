import type { CopilotProcess } from './process.js'

export interface SessionState {
  id: string
  createdAt: Date
  agentProcess: CopilotProcess
  /** mcpServers injected at session creation — forwarded on the first ACP run. */
  mcpServers: Record<string, unknown>
  firstMessageSent: boolean
}

/**
 * AG-UI event types translated from ACP events.
 * See ADR-003 for the full mapping specification.
 */
export type AgUiEventType =
  | 'TEXT_MESSAGE_CONTENT'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_RESULT'
  | 'RUN_STARTED'
  | 'RUN_FINISHED'
  | 'RUN_ERROR'

export interface AgUiEvent {
  type: AgUiEventType
  data: unknown
}
