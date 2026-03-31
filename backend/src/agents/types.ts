import type { McpServer } from '@agentclientprotocol/sdk'
import type { EventEmitter } from 'node:events'

export type AgentStatus = 'active' | 'disabled' | 'detected' | 'unavailable'

export interface AgentSummary {
  id: string
  name: string
  status: AgentStatus
  command: string | null
  /**
   * True when the agent is active (running) and can accept a new session with a
   * conversation handoff. Any active agent qualifies — no ACP capability negotiation required.
   */
  canResume: boolean
  /**
   * True when the agent is active and supports ACP `session/load`, allowing a
   * history session to be resumed as the *original* live session rather than
   * creating a new one with a handoff transcript.
   */
  canLoad: boolean
}

/** A selectable model advertised by an agent via ACP `session/new` or `session/load`. */
export interface ModelInfo {
  modelId: string
  name: string
  description?: string | null
}

/**
 * Current model selection state for a live session.
 * Populated from the ACP `NewSessionResponse` / `LoadSessionResponse` `models` field.
 * Null when the agent does not advertise model selection.
 */
export interface ModelState {
  availableModels: ModelInfo[]
  currentModelId: string
}

export type HistoryCapability =
  | 'text'
  | 'markdown'
  | 'reasoning'
  | 'tool_calls'
  | 'skills'
  | 'subagents'
  | 'attachments'
  | 'rich_media'
  | 'file_operations'
  | 'patches'
  | 'compaction'
  | 'truncation'

export type HistorySourceAccessStatus = 'readable' | 'missing' | 'permission_error' | 'invalid'

export type HistorySourceSignalStatus = 'contains_history' | 'empty' | 'unknown'

export type HistorySourceKind =
  | 'cli_session_dir'
  | 'cli_history_dir'
  | 'vscode_workspace_db'
  | 'vscode_chat_sessions'
  | 'vscode_chat_editing_sessions'
  | 'vscode_extension_resources'
  | 'gemini_tmp_dir'
  | 'opencode_db'

export type HistorySourcePlatform = 'linux' | 'mounted_host' | 'windows' | 'unknown'

export interface HistorySourceDescriptor {
  id: string
  backendId: string
  providerId: string
  kind: HistorySourceKind
  path: string
  platform: HistorySourcePlatform
  access: HistorySourceAccessStatus
  signal: HistorySourceSignalStatus
  discoveredBy: 'auto' | 'manual'
  lastModifiedMs?: number
  sessionCount?: number
  warnings?: string[]
}

export interface HistorySourceDiscoverySummary {
  family: string
  readable: number
  missing: number
  invalid: number
  containsHistory: number
}

export interface HistorySupport {
  source: 'none' | 'derived' | 'native'
  supported: HistoryCapability[]
  discoveredSources: HistorySourceDescriptor[]
  discoverySummary?: HistorySourceDiscoverySummary[]
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
  historyPathHints: string[]
  /** CLI session-state directory hints. Only used by the `copilot` backend. */
  cliHistoryPathHints: string[]
  detectedCommand: string | null
  usesCustomCommand: boolean
  endpointSupport: BackendEndpointSupport
  historySupport: HistorySupport
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
  structuredBlocks?: StructuredBlock[]
  turnInfo?: TurnInfo
}

export interface TurnPatchSummary {
  hash: string
  nextHash?: string
  files: string[]
  additions?: number
  deletions?: number
}

export interface TurnInfo {
  providerId?: string
  modelId?: string
  mode?: string
  startedAtMs?: number
  completedAtMs?: number
  durationMs?: number
  modifiedFiles?: string[]
  patches?: TurnPatchSummary[]
}

export interface ToolCallBlock {
  kind: 'tool_call'
  payload: {
    callId: string
    toolName: string
    args?: unknown
    result?: string
    done: boolean
  }
}

export interface ReasoningBlock {
  kind: 'reasoning'
  payload: {
    title?: string
    text: string
  }
}

export interface SkillInvocationBlock {
  kind: 'skill_invocation'
  payload: {
    callId: string
    skillName: string
    status: 'running' | 'completed' | 'error'
    result?: string
  }
}

export interface SubagentInvocationBlock {
  kind: 'subagent_invocation'
  payload: {
    callId: string
    agentName: string
    status: 'running' | 'completed' | 'error'
    prompt?: string
    result?: string
    sessionId?: string
  }
}

export interface AttachmentBlock {
  kind: 'attachment'
  payload: {
    mime: string
    filename: string
    url: string
  }
}

export interface FileOperationBlock {
  kind: 'file_operation'
  payload: {
    path: string
    operation: 'create' | 'edit' | 'delete' | 'reference'
    source?: string
  }
}

export interface ModelSwitchBlock {
  kind: 'model_switch'
  payload: {
    fromModelId?: string
    toModelId: string
  }
}

export interface ApprovalNoticeBlock {
  kind: 'approval_notice'
  payload: {
    title: string
    message?: string
    state: 'pending' | 'approved' | 'rejected'
  }
}

export interface CompactionNoticeBlock {
  kind: 'compaction_notice'
  payload: {
    auto: boolean
    overflow: boolean
  }
}

export interface TruncationNoticeBlock {
  kind: 'truncation_notice'
  payload: {
    tokenLimit?: number
    tokensRemoved?: number
    messagesRemoved?: number
  }
}

export type StructuredBlock =
  | ToolCallBlock
  | ReasoningBlock
  | SkillInvocationBlock
  | SubagentInvocationBlock
  | AttachmentBlock
  | FileOperationBlock
  | ModelSwitchBlock
  | ApprovalNoticeBlock
  | CompactionNoticeBlock
  | TruncationNoticeBlock

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
  /** Current model selection state; null when the agent does not support model selection. */
  modelState: ModelState | null
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
  /**
   * Load an existing session by its original agent-side session ID (e.g. opencode DB UUID).
   * Returns the new internal frontend session ID. Only available on adapters that wrap an
   * ACP agent that advertises the `loadSession` capability.
   */
  loadSession?(
    acpSessionId: string,
    project: SessionProjectContext | null,
    mcpServers?: McpServer[]
  ): Promise<string>
  sendMessage(sessionId: string, text: string): Promise<void>
  /**
   * Send a structured handoff prompt containing prior conversation history.
   * Uses an EmbeddedResource content block so the agent receives the transcript
   * as a proper context resource rather than a bare text prompt.
   */
  sendHandoff(sessionId: string, messages: SessionMessage[]): Promise<void>
  closeSession(sessionId: string): void
  listSessions(): SessionSummary[]
  getSession(sessionId: string): SessionDetails | null
  /**
   * Switch the model for an active session via ACP `session/set_model`.
   * Optional — only implemented by adapters whose agent advertises model selection.
   */
  setSessionModel?(sessionId: string, modelId: string): Promise<void>
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
