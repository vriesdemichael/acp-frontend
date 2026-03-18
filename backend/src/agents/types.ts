export type AgentStatus = 'active' | 'unavailable'

export interface AgentSummary {
  id: string
  name: string
  status: AgentStatus
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface SessionSummary {
  id: string
  title: string
  updatedAt: string
  agentId: string
}

export interface SessionDetails extends SessionSummary {
  messages: SessionMessage[]
}

export interface SessionAdapter {
  readonly agentId: string
  readonly agentName: string
  newSession(mcpServers?: Record<string, unknown>): Promise<string>
  sendMessage(sessionId: string, text: string): Promise<void>
  closeSession(sessionId: string): void
  listSessions(): SessionSummary[]
  getSession(sessionId: string): SessionDetails | null
}
