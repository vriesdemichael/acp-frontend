import type {
  InitializeResponse,
  McpServer,
  PromptResponse,
  SessionNotification,
} from '@agentclientprotocol/sdk'
import type {
  BackendEndpointSupport,
  ModelState,
  SessionMessage,
  SessionProjectContext,
} from '../../agents/types.js'
import type { AcpSessionClient, StdioAcpProcess } from './process.js'

export interface GenericSessionState {
  id: string
  createdAt: Date
  updatedAt: Date
  title: string
  project: SessionProjectContext | null
  agentProcess: StdioAcpProcess
  acpClient: AcpSessionClient
  acpSessionId: string
  initializeResponse: InitializeResponse
  mcpServers: McpServer[]
  firstMessageSent: boolean
  pendingEvents: SessionNotification[]
  lastPromptResponse: PromptResponse | null
  forwardUpdate: ((notification: SessionNotification) => void) | null
  messages: SessionMessage[]
  /** Current model state for this session, if the agent supports model selection. */
  modelState: ModelState | null
}

export interface GenericAcpCapabilityProbeResult {
  initialized: boolean
  endpointSupport: BackendEndpointSupport
  raw?: unknown
}

export interface GenericProcessHandlers {
  onExit: (code: number | null) => void
  onSessionUpdate: (notification: SessionNotification) => void
}
