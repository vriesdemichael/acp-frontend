/**
 * chatStore.svelte.ts — Svelte 5 runes port of useAgUiChat.ts
 *
 * Replaces the React hook pattern with a plain module-level reactive store.
 * EventType from @ag-ui/core is replaced by StreamEvent from ../stream-events.js (ADR-023).
 *
 * The stale-closure workaround (messagesRef / sessionsRef) is eliminated because
 * $state variables are always current inside $effect closures in Svelte 5.
 */

import { StreamEvent } from '../stream-events.js'
import type { StructuredBlock } from '../components/chat/a2ui-types.js'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  structuredBlocks?: StructuredBlock[]
  turnInfo?: {
    providerId?: string
    modelId?: string
    mode?: string
    startedAtMs?: number
    completedAtMs?: number
    durationMs?: number
    modifiedFiles?: string[]
    patches?: Array<{
      hash: string
      nextHash?: string
      files: string[]
      additions?: number
      deletions?: number
    }>
  }
}

export interface AgentSummary {
  id: string
  name: string
  status: 'active' | 'disabled' | 'detected' | 'unavailable'
  command: string | null
  /** True when the agent is active and can accept a resume/continuation request. */
  canResume: boolean
}

export interface HistorySourceDescriptor {
  id: string
  backendId: string
  providerId: string
  kind:
    | 'cli_session_dir'
    | 'cli_history_dir'
    | 'vscode_workspace_db'
    | 'vscode_chat_sessions'
    | 'vscode_chat_editing_sessions'
    | 'vscode_extension_resources'
    | 'gemini_tmp_dir'
    | 'opencode_db'
  path: string
  platform: 'linux' | 'mounted_host' | 'windows' | 'unknown'
  access: 'readable' | 'missing' | 'permission_error' | 'invalid'
  signal: 'contains_history' | 'empty' | 'unknown'
  discoveredBy: 'auto' | 'manual'
  lastModifiedMs?: number
  sessionCount?: number
}

export interface ProjectSummary {
  id: string
  name: string
  path: string
  status: 'available' | 'missing' | 'invalid'
}

export interface SessionProjectContext {
  id: string
  name: string
  path: string
}

export interface SessionSummary {
  id: string
  title: string
  updatedAt: string
  agentId: string
  project: SessionProjectContext | null
  source: 'live' | 'history'
}

interface ProjectPathSuggestion {
  name: string
  path: string
}

interface SessionDetails extends SessionSummary {
  messages: ChatMessage[]
  /** Current model selection state; null when the agent does not support model selection. */
  modelState: ModelState | null
}

/** A selectable model advertised by an agent via ACP session creation. */
export interface ModelInfo {
  modelId: string
  name: string
  description?: string | null
}

/** Current model selection state for a live session. */
export interface ModelState {
  availableModels: ModelInfo[]
  currentModelId: string
}

export interface ChatStoreOptions {
  /** Initial session ID from URL (may be null). */
  sessionId: string | null
  /** Initial project ID from URL (may be null). */
  projectId: string | null
  onSessionCreated: (sessionId: string) => void
  onSessionSelected: (sessionId: string) => void
  onSessionCleared: () => void
  onProjectSelected: (projectId: string | null) => void
}

export function buildSendMessagePayload(message: string, agentId: string | null) {
  return {
    ...(agentId ? { agentId } : {}),
    message,
  }
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

export function createChatStore(options: ChatStoreOptions) {
  // -------------------------------------------------------------------------
  // Reactive state (Svelte 5 runes)
  // -------------------------------------------------------------------------
  let currentSessionId = $state<string | null>(options.sessionId)
  let currentProjectId = $state<string | null>(options.projectId)
  let agents = $state<AgentSummary[]>([])
  let projects = $state<ProjectSummary[]>([])
  let sessions = $state<SessionSummary[]>([])
  let messages = $state<ChatMessage[]>([])
  let thinking = $state(false)
  let errorMessage = $state<string | null>(null)
  let loading = $state(true)
  let historyLoadingSessionId = $state<string | null>(null)
  let streamReconnecting = $state(false)
  let creatingSession = $state(false)
  let modelState = $state<ModelState | null>(null)

  // Track last-seen routeSessionId to detect URL-driven changes
  let routeSessionIdSeen: string | null = options.sessionId
  // Tracks the session ID that the SSE listener is attached to
  let activeSessionId: string | null = options.sessionId

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------
  const selectedProject = $derived(
    projects.find((candidate) => candidate.id === currentProjectId) ?? null
  )
  const availableProjects = $derived(
    projects.filter((candidate) => candidate.status === 'available')
  )
  const activeAgents = $derived(agents.filter((candidate) => candidate.status === 'active'))
  const currentSession = $derived(sessions.find((s) => s.id === currentSessionId) ?? null)
  const currentSessionAgent = $derived(
    currentSession ? (agents.find((a) => a.id === currentSession.agentId) ?? null) : null
  )
  const ready = $derived(
    currentSessionId !== null &&
      currentSession?.source === 'live' &&
      currentSessionAgent?.status === 'active' &&
      selectedProject?.status === 'available' &&
      !creatingSession
  )
  const historyLoading = $derived(historyLoadingSessionId !== null)

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)
    if (!response.ok) {
      throw new Error(`${url} failed with status ${response.status}`)
    }
    return (await response.json()) as T
  }

  async function refreshSessions(): Promise<SessionSummary[]> {
    try {
      const nextSessions = await fetchJson<SessionSummary[]>('/api/sessions')
      sessions = nextSessions
      return nextSessions
    } catch (error) {
      console.error('[chatStore] session list failed:', error)
      if (!errorMessage) {
        errorMessage = 'Unable to load session history right now. Reload or try again in a moment.'
      }
      return []
    }
  }

  async function refreshProjects(): Promise<ProjectSummary[]> {
    try {
      const nextProjects = await fetchJson<ProjectSummary[]>('/api/projects')
      projects = nextProjects
      return nextProjects
    } catch (error) {
      console.error('[chatStore] project list failed:', error)
      if (!errorMessage) {
        errorMessage = 'Unable to load projects right now. Reload or try again in a moment.'
      }
      return []
    }
  }

  // -------------------------------------------------------------------------
  // loadSession
  // -------------------------------------------------------------------------
  async function loadSession(
    nextSessionId: string,
    syncRoute = true,
    showLoadingIndicator = true
  ): Promise<SessionDetails | null> {
    if (showLoadingIndicator) historyLoadingSessionId = nextSessionId
    try {
      const session = await fetchJson<SessionDetails>(
        `/api/sessions/${encodeURIComponent(nextSessionId)}`
      )

      if (activeSessionId !== nextSessionId) {
        return null
      }

      messages = session.messages
      modelState = session.modelState ?? null
      currentSessionId = nextSessionId
      currentProjectId = session.project?.id ?? null

      if (syncRoute && session.project?.id !== options.projectId) {
        options.onProjectSelected(session.project?.id ?? null)
      }

      if (syncRoute && options.sessionId !== nextSessionId) {
        options.onSessionSelected(nextSessionId)
      }

      return session
    } catch (error) {
      console.error('[chatStore] session load failed:', error)
      messages = []
      errorMessage = 'Unable to load that session right now. Pick another one or create a new chat.'
      return null
    } finally {
      if (showLoadingIndicator && historyLoadingSessionId === nextSessionId) {
        historyLoadingSessionId = null
      }
    }
  }

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------
  async function createSession(agentId: string, nextProjectId?: string): Promise<string | null> {
    const effectiveProjectId = nextProjectId ?? currentProjectId ?? options.projectId

    if (!agentId) {
      errorMessage = 'Select an available agent before starting a new chat.'
      return null
    }

    if (!effectiveProjectId) {
      errorMessage = 'Select an available project before starting a new chat.'
      return null
    }

    creatingSession = true
    thinking = false

    try {
      const session = await fetchJson<SessionDetails>('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, projectId: effectiveProjectId }),
      })

      activeSessionId = session.id
      currentSessionId = session.id
      messages = session.messages
      currentProjectId = session.project?.id ?? effectiveProjectId
      options.onSessionCreated(session.id)

      if (session.project?.id !== options.projectId) {
        options.onProjectSelected(session.project?.id ?? effectiveProjectId)
      }

      void refreshSessions()
      return session.id
    } catch (error) {
      console.error('[chatStore] session create failed:', error)
      errorMessage = 'Unable to start a chat session right now. Reload or try again in a moment.'
      return null
    } finally {
      creatingSession = false
    }
  }

  // -------------------------------------------------------------------------
  // Bootstrap (called from onMount in consuming component)
  // -------------------------------------------------------------------------
  async function bootstrap() {
    loading = true
    errorMessage = null

    try {
      const [nextAgents, nextProjects, nextSessions] = await Promise.all([
        fetchJson<AgentSummary[]>('/api/agents'),
        fetchJson<ProjectSummary[]>('/api/projects'),
        fetchJson<SessionSummary[]>('/api/sessions'),
      ])

      agents = nextAgents
      projects = nextProjects
      sessions = nextSessions

      const nextActiveAgents = nextAgents.filter((candidate) => candidate.status === 'active')
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const nextActiveAgentIds = new Set(nextActiveAgents.map((agent) => agent.id))

      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const availableProjectIds = new Set(
        nextProjects
          .filter((project) => project.status === 'available')
          .map((project) => project.id)
      )

      const preferredProjectId =
        options.projectId && availableProjectIds.has(options.projectId)
          ? options.projectId
          : currentProjectId && availableProjectIds.has(currentProjectId)
            ? currentProjectId
            : (nextSessions.find(
                (session) => session.project && availableProjectIds.has(session.project.id)
              )?.project?.id ??
              nextProjects.find((project) => project.status === 'available')?.id ??
              null)

      currentProjectId = preferredProjectId

      if (preferredProjectId !== options.projectId) {
        options.onProjectSelected(preferredProjectId)
      }

      const preferredSession =
        (options.sessionId && nextSessions.find((session) => session.id === options.sessionId)) ??
        nextSessions.find(
          (session) =>
            session.project?.id === preferredProjectId && nextActiveAgentIds.has(session.agentId)
        ) ??
        null

      if (preferredSession) {
        activeSessionId = preferredSession.id
        currentSessionId = preferredSession.id
        loading = false
        await loadSession(
          preferredSession.id,
          options.sessionId !== preferredSession.id ||
            preferredSession.project?.id !== options.projectId,
          false // bootstrap already shows its own loading state
        )
        return
      }

      activeSessionId = null
      currentSessionId = null

      if (options.sessionId !== null) {
        options.onSessionCleared()
      }

      if (!preferredProjectId) {
        messages = []
        errorMessage =
          'No projects are currently available. Check the generated workspace config and try again.'
        return
      }

      if (nextActiveAgents.length === 0) {
        messages = []
        errorMessage = 'No agents are currently available. Start an adapter and reload to continue.'
        return
      }

      messages = []
    } catch (error) {
      console.error('[chatStore] bootstrap failed:', error)
      errorMessage = 'Unable to load chat data right now. Reload or try again in a moment.'
    } finally {
      loading = false
    }
  }

  // -------------------------------------------------------------------------
  // Route session change handler (called when URL ?session= param changes)
  // -------------------------------------------------------------------------
  function handleRouteSessionChange(newSessionId: string | null) {
    if (newSessionId === routeSessionIdSeen) return
    routeSessionIdSeen = newSessionId

    if (!newSessionId) {
      activeSessionId = null
      currentSessionId = null
      messages = []
      thinking = false
      return
    }

    if (newSessionId === activeSessionId) return

    activeSessionId = newSessionId
    currentSessionId = newSessionId
    errorMessage = null
    thinking = false
    void loadSession(newSessionId, false)
  }

  /**
   * Called by ChatPage when the URL hash changes (back/forward navigation).
   * Syncs both sessionId and projectId from the new URL params.
   */
  function syncRouteParams(newSessionId: string | null, newProjectId: string | null) {
    handleRouteSessionChange(newSessionId)
    if (newProjectId !== currentProjectId) {
      currentProjectId = newProjectId
    }
  }

  // -------------------------------------------------------------------------
  // SSE stream effect (re-runs when currentSession changes)
  // -------------------------------------------------------------------------
  function connectStream(sessionId: string): () => void {
    activeSessionId = sessionId
    streamReconnecting = false

    const sse = new EventSource(`/api/stream?sessionId=${encodeURIComponent(sessionId)}`)

    sse.onopen = () => {
      if (activeSessionId !== sessionId) return
      streamReconnecting = false
    }

    sse.addEventListener(StreamEvent.RUN_STARTED, () => {
      streamReconnecting = false
      thinking = true
    })

    sse.addEventListener(StreamEvent.TEXT_MESSAGE_START, (event: MessageEvent<string>) => {
      if (activeSessionId !== sessionId) return
      const { messageId } = JSON.parse(event.data) as { messageId: string }
      if (!messages.some((m) => m.id === messageId)) {
        messages = [
          ...messages,
          { id: messageId, role: 'assistant', content: '', structuredBlocks: [] },
        ]
      }
    })

    sse.addEventListener(StreamEvent.TEXT_MESSAGE_CONTENT, (event: MessageEvent<string>) => {
      if (activeSessionId !== sessionId) return
      streamReconnecting = false
      const { messageId, delta } = JSON.parse(event.data) as { messageId: string; delta: string }

      let found = false
      const nextMessages = messages.map((message) => {
        if (message.id !== messageId) return message
        found = true
        return { ...message, content: message.content + delta }
      })

      messages = found
        ? nextMessages
        : [
            ...nextMessages,
            { id: messageId, role: 'assistant', content: delta, structuredBlocks: [] },
          ]
    })

    sse.addEventListener(StreamEvent.CUSTOM, (event: MessageEvent<string>) => {
      if (activeSessionId !== sessionId) return
      streamReconnecting = false

      const customEvent = JSON.parse(event.data) as {
        name?: string
        value?: Record<string, unknown>
      }

      if (customEvent.name !== 'a2ui:tool_call') return

      const payload = customEvent.value ?? {}
      const callId = typeof payload['callId'] === 'string' ? payload['callId'] : null
      const toolName = typeof payload['toolName'] === 'string' ? payload['toolName'] : null
      const done = payload['done'] === true
      if (!callId || !toolName) return

      const nextMessages = [...messages]
      const lastAssistantIndex = [...nextMessages]
        .reverse()
        .findIndex((message) => message.role === 'assistant')
      const targetIndex =
        lastAssistantIndex === -1 ? -1 : nextMessages.length - 1 - lastAssistantIndex

      const fallbackMessage = {
        id: `assistant-tool-${callId}`,
        role: 'assistant' as const,
        content: '',
        structuredBlocks: [] as StructuredBlock[],
      }

      const targetMessage = targetIndex >= 0 ? nextMessages[targetIndex] : fallbackMessage

      const existingBlocks = targetMessage.structuredBlocks ?? []
      const nextBlock: StructuredBlock = {
        kind: 'tool_call',
        payload: {
          callId,
          toolName,
          args: payload['args'],
          result: typeof payload['result'] === 'string' ? payload['result'] : undefined,
          done,
        },
      }

      const mergedBlocks = upsertStructuredBlock(existingBlocks, nextBlock)
      const mergedMessage = { ...targetMessage, structuredBlocks: mergedBlocks }

      if (targetIndex >= 0) {
        nextMessages[targetIndex] = mergedMessage
        messages = nextMessages
      } else {
        messages = [...nextMessages, mergedMessage]
      }
    })

    const finishRun = () => {
      if (activeSessionId !== sessionId) return
      thinking = false
      void refreshSessions()
    }

    sse.addEventListener(StreamEvent.RUN_FINISHED, finishRun)
    sse.addEventListener(StreamEvent.RUN_ERROR, finishRun)

    sse.onerror = () => {
      if (activeSessionId !== sessionId) return
      thinking = false
      streamReconnecting = true
    }

    return () => sse.close()
  }

  // -------------------------------------------------------------------------
  // Public actions
  // -------------------------------------------------------------------------
  async function sendMessage(text: string) {
    if (!currentSessionId) return

    const session = sessions.find((s) => s.id === currentSessionId)
    const agentId = session?.agentId ?? null

    errorMessage = null
    messages = [...messages, { id: `user-${Date.now()}`, role: 'user', content: text }]

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(currentSessionId)}/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildSendMessagePayload(text, agentId)),
        }
      )

      if (!response.ok) {
        throw new Error(`Message send failed with status ${response.status}`)
      }

      void refreshSessions()
    } catch (error) {
      console.error('[chatStore] message send failed:', error)
      errorMessage = 'Message failed to send. Check the agent connection and try again.'
      throw error
    }
  }

  async function selectSession(nextSessionId: string) {
    if (nextSessionId === currentSessionId) return
    activeSessionId = nextSessionId
    currentSessionId = nextSessionId
    errorMessage = null
    thinking = false
    await loadSession(nextSessionId, true)
  }

  async function selectProject(nextProjectId: string) {
    if (nextProjectId === currentProjectId) return

    const candidate = projects.find((project) => project.id === nextProjectId)
    if (!candidate || candidate.status !== 'available') return

    errorMessage = null
    messages = []
    thinking = false
    streamReconnecting = false
    activeSessionId = null
    currentSessionId = null
    currentProjectId = nextProjectId
    options.onSessionCleared()
    options.onProjectSelected(nextProjectId)
  }

  async function startNewSession(agentId: string) {
    errorMessage = null
    await createSession(agentId)
  }

  async function resumeSession(agentId: string) {
    if (!currentSessionId) return
    errorMessage = null
    thinking = false
    streamReconnecting = false
    creatingSession = true

    const priorMessages = [...messages]

    try {
      const sourceAgentId = currentSession?.agentId ?? null
      const session = await fetchJson<SessionDetails>(
        `/api/sessions/${encodeURIComponent(currentSessionId)}/resume`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            ...(sourceAgentId ? { sourceAgentId } : {}),
          }),
        }
      )
      activeSessionId = session.id
      currentSessionId = session.id
      messages = [...priorMessages, ...session.messages]
      currentProjectId = session.project?.id ?? null
      options.onSessionCreated(session.id)
      if (session.project?.id !== options.projectId) {
        options.onProjectSelected(session.project?.id ?? null)
      }
      void refreshSessions()
    } catch (error) {
      console.error('[chatStore] session resume failed:', error)
      errorMessage = 'Unable to continue this conversation right now. Try again in a moment.'
    } finally {
      creatingSession = false
    }
  }

  async function addProject(name: string, path: string): Promise<ProjectSummary> {
    const project = await fetchJson<ProjectSummary>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path }),
    })

    const nextProjects = await refreshProjects()
    const resolvedProject = nextProjects.find((candidate) => candidate.id === project.id) ?? project
    currentProjectId = resolvedProject.id
    options.onProjectSelected(resolvedProject.id)
    return resolvedProject
  }

  async function removeProject(projectIdToRemove: string) {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectIdToRemove)}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`/api/projects/${projectIdToRemove} failed with status ${response.status}`)
    }

    const nextProjects = await refreshProjects()
    if (currentProjectId === projectIdToRemove) {
      const fallbackProject = nextProjects.find((project) => project.status === 'available') ?? null
      activeSessionId = null
      currentProjectId = fallbackProject?.id ?? null
      currentSessionId = null
      messages = []
      thinking = false
      options.onSessionCleared()
      options.onProjectSelected(fallbackProject?.id ?? null)
    }
  }

  async function suggestProjectPaths(path: string): Promise<ProjectPathSuggestion[]> {
    return fetchJson<ProjectPathSuggestion[]>(
      `/api/projects/path-suggestions?path=${encodeURIComponent(path)}`
    )
  }

  async function setSessionModel(newModelId: string) {
    if (!currentSessionId) return
    await fetchJson(`/api/sessions/${encodeURIComponent(currentSessionId)}/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: newModelId }),
    })
    if (modelState) {
      modelState = { ...modelState, currentModelId: newModelId }
    }
  }

  // -------------------------------------------------------------------------
  // Return the store's reactive surface (getters expose $state vars)
  // -------------------------------------------------------------------------
  return {
    // state getters
    get currentSessionId() {
      return currentSessionId
    },
    get currentProjectId() {
      return currentProjectId
    },
    get agents() {
      return agents
    },
    get projects() {
      return projects
    },
    get sessions() {
      return sessions
    },
    get messages() {
      return messages
    },
    get thinking() {
      return thinking
    },
    get errorMessage() {
      return errorMessage
    },
    get loading() {
      return loading
    },
    get streamReconnecting() {
      return streamReconnecting
    },
    get creatingSession() {
      return creatingSession
    },
    get modelState() {
      return modelState
    },
    // derived getters
    get selectedProject() {
      return selectedProject
    },
    get availableProjects() {
      return availableProjects
    },
    get activeAgents() {
      return activeAgents
    },
    get currentSession() {
      return currentSession
    },
    get currentSessionAgent() {
      return currentSessionAgent
    },
    get ready() {
      return ready
    },
    get historyLoading() {
      return historyLoading
    },
    // actions
    bootstrap,
    handleRouteSessionChange,
    syncRouteParams,
    connectStream,
    sendMessage,
    selectSession,
    selectProject,
    startNewSession,
    resumeSession,
    addProject,
    removeProject,
    suggestProjectPaths,
    setSessionModel,
    refreshSessions,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function upsertStructuredBlock(
  blocks: StructuredBlock[],
  nextBlock: StructuredBlock
): StructuredBlock[] {
  const nextId = readStructuredBlockId(nextBlock)
  if (!nextId) {
    return [...blocks, nextBlock]
  }

  const existingIndex = blocks.findIndex((block) => readStructuredBlockId(block) === nextId)
  if (existingIndex === -1) {
    return [...blocks, nextBlock]
  }

  return blocks.map((block, index) => (index === existingIndex ? nextBlock : block))
}

function readStructuredBlockId(block: StructuredBlock): string | null {
  switch (block.kind) {
    case 'tool_call':
      return block.payload.callId
    case 'skill_invocation':
      return block.payload.callId
    case 'subagent_invocation':
      return block.payload.callId
    case 'reasoning':
      return block.payload.text
    default:
      return null
  }
}
