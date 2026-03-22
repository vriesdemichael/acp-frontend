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
  project: SessionProjectContext | null
  source: 'live' | 'history'
}

export interface SessionDetails extends SessionSummary {
  messages: SessionMessage[]
}

export interface SessionProjectContext {
  id: string
  name: string
  path: string
}

export interface SessionAdapter {
  readonly agentId: string
  readonly agentName: string
  readonly events: EventEmitter
  getEndpointSupport(): BackendEndpointSupport
  ownsSession(sessionId: string): boolean
  newSession(project: SessionProjectContext | null, mcpServers?: McpServer[]): Promise<string>
  sendMessage(sessionId: string, text: string): Promise<void>
  closeSession(sessionId: string): void
  listSessions(): SessionSummary[]
  getSession(sessionId: string): SessionDetails | null
}

export type RegistryErrorCode =
  | 'unknown_backend'
  | 'agent_unavailable'
  | 'session_not_found'
  | 'agent_mismatch'

export class RegistryError extends Error {
  constructor(
    public readonly code: RegistryErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'RegistryError'
  }
}
