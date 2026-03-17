import type { CopilotProcess } from './process.js'

export interface SessionState {
  id: string
  createdAt: Date
  agentProcess: CopilotProcess
  /** mcpServers injected at session creation — forwarded on the first ACP run. */
  mcpServers: Record<string, unknown>
  firstMessageSent: boolean
}
