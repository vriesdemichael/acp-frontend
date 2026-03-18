import type { McpServer } from '@agentclientprotocol/sdk'
import type { EventEmitter } from 'node:events'

export type AgentStatus = 'active' | 'disabled' | 'detected' | 'unavailable'

export interface AgentSummary {
  id: string
  name: string
  status: AgentStatus
  command: string | null
}

export interface BackendEndpointSupport {
  source: 'connection' | 'unknown'
  implemented: string[]
  unknown: string[]
}

export interface BackendSummary extends AgentSummary {
  enabled: boolean
  args: string[]
  defaultArgs: string[]
  detectedCommand: string | null
  usesCustomCommand: boolean
  endpointSupport: BackendEndpointSupport
  lastTestResult: BackendTestResult | null
}

export interface BackendTestResult {
  ok: boolean
  message: string
  testedAt: string
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
  readonly events: EventEmitter
  getEndpointSupport(): BackendEndpointSupport
  newSession(mcpServers?: McpServer[]): Promise<string>
  sendMessage(sessionId: string, text: string): Promise<void>
  closeSession(sessionId: string): void
  listSessions(): SessionSummary[]
  getSession(sessionId: string): SessionDetails | null
}
