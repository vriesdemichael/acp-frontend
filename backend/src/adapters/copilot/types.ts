import type { CopilotProcess } from './process.js'
import type { SessionMessage } from '../../agents/types.js'

export interface SessionState {
  id: string
  createdAt: Date
  updatedAt: Date
  title: string
  agentProcess: CopilotProcess
  /** mcpServers injected at session creation — forwarded on the first ACP run. */
  mcpServers: Record<string, unknown>
  firstMessageSent: boolean
  messages: SessionMessage[]
}
