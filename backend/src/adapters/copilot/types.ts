import type { CopilotProcess } from './process.js'
import type {
  InitializeResponse,
  McpServer,
  PromptResponse,
  SessionNotification,
} from '@agentclientprotocol/sdk'
import type { SessionMessage, SessionProjectContext } from '../../agents/types.js'
import type { CopilotSessionClient } from './process.js'

export interface SessionState {
  id: string
  createdAt: Date
  updatedAt: Date
  title: string
  project: SessionProjectContext | null
  agentProcess: CopilotProcess
  acpClient: CopilotSessionClient
  acpSessionId: string
  initializeResponse: InitializeResponse
  /** mcpServers injected at session creation — forwarded on the first ACP run. */
  mcpServers: McpServer[]
  firstMessageSent: boolean
  pendingEvents: SessionNotification[]
  lastPromptResponse: PromptResponse | null
  forwardUpdate: ((notification: SessionNotification) => void) | null
  messages: SessionMessage[]
}
