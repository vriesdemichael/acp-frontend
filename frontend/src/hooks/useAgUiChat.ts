import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EventType } from '@ag-ui/core'
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
  /** True when the agent supports ACP session/load (resume as the original session). */
  canLoad: boolean
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

interface UseAgUiChatOptions {
  sessionId: string | null
  projectId: string | null
  onSessionCreated: (sessionId: string) => void
  onSessionSelected: (sessionId: string) => void
  onSessionCleared: () => void
  onProjectSelected: (projectId: string | null) => void
}

export function useAgUiChat({
  sessionId,
  projectId,
  onSessionCreated,
  onSessionSelected,
  onSessionCleared,
  onProjectSelected,
}: UseAgUiChatOptions) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const sessionsRef = useRef<SessionSummary[]>([])
  const setSessionsAndRef = useCallback((nextSessions: SessionSummary[]) => {
    sessionsRef.current = nextSessions
    setSessions(nextSessions)
  }, [])
  const [messages, setMessagesRaw] = useState<ChatMessage[]>([])
  const messagesRef = useRef<ChatMessage[]>([])
  // Wraps the raw setter so that messagesRef always stays in sync.
  // Used wherever we need to snapshot messages in a callback without stale-closure issues.
  const setMessages = useCallback(
    (next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      if (typeof next === 'function') {
        setMessagesRaw((prev) => {
          const resolved = next(prev)
          messagesRef.current = resolved
          return resolved
        })
      } else {
        messagesRef.current = next
        setMessagesRaw(next)
      }
    },
    []
  )
  const [thinking, setThinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoadingSessionId, setHistoryLoadingSessionId] = useState<string | null>(null)
  const [streamReconnecting, setStreamReconnecting] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [modelState, setModelState] = useState<ModelState | null>(null)
  const activeSessionRef = useRef<string | null>(sessionId)
  const routeSessionRef = useRef<string | null>(sessionId)
  // Stable refs so the one-shot bootstrap effect can call the latest version of
  // these callbacks without listing them (and their transitive deps) in the dep
  // array, which would cause the effect to re-run mid-flight and cancel itself.
  const createSessionRef = useRef<typeof createSession | null>(null)
  const loadSessionRef = useRef<typeof loadSession | null>(null)

  useEffect(() => {
    setCurrentProjectId(projectId)
  }, [projectId])

  const selectedProject = useMemo(
    () => projects.find((candidate) => candidate.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  )
  const availableProjects = useMemo(
    () => projects.filter((candidate) => candidate.status === 'available'),
    [projects]
  )
  const activeAgents = useMemo(
    () => agents.filter((candidate) => candidate.status === 'active'),
    [agents]
  )
  const currentSession = useMemo(
    () => sessions.find((s) => s.id === currentSessionId) ?? null,
    [sessions, currentSessionId]
  )
  const currentSessionAgent = useMemo(
    () => (currentSession ? (agents.find((a) => a.id === currentSession.agentId) ?? null) : null),
    [agents, currentSession]
  )
  const ready = useMemo(
    () =>
      currentSessionId !== null &&
      currentSession?.source === 'live' &&
      currentSessionAgent?.status === 'active' &&
      selectedProject?.status === 'available' &&
      !creatingSession,
    [creatingSession, currentSessionId, currentSession, currentSessionAgent, selectedProject]
  )

  const fetchJson = useCallback(async <T>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init)
    if (!response.ok) {
      throw new Error(`${url} failed with status ${response.status}`)
    }

    return (await response.json()) as T
  }, [])

  const refreshSessions = useCallback(async () => {
    try {
      const nextSessions = await fetchJson<SessionSummary[]>('/api/sessions')
      setSessionsAndRef(nextSessions)
      return nextSessions
    } catch (error) {
      console.error('[useAgUiChat] session list failed:', error)
      setErrorMessage(
        (current) =>
          current ?? 'Unable to load session history right now. Reload or try again in a moment.'
      )
      return []
    }
  }, [fetchJson, setSessionsAndRef])

  const refreshProjects = useCallback(async () => {
    try {
      const nextProjects = await fetchJson<ProjectSummary[]>('/api/projects')
      setProjects(nextProjects)
      return nextProjects
    } catch (error) {
      console.error('[useAgUiChat] project list failed:', error)
      setErrorMessage(
        (current) =>
          current ?? 'Unable to load projects right now. Reload or try again in a moment.'
      )
      return []
    }
  }, [fetchJson])

  const loadSession = useCallback(
    async (nextSessionId: string, syncRoute = true) => {
      setHistoryLoadingSessionId(nextSessionId)
      try {
        const knownSession = sessionsRef.current.find((s) => s.id === nextSessionId)
        const agentParam = knownSession?.agentId
          ? `?agentId=${encodeURIComponent(knownSession.agentId)}`
          : ''
        const session = await fetchJson<SessionDetails>(
          `/api/sessions/${encodeURIComponent(nextSessionId)}${agentParam}`
        )

        if (activeSessionRef.current !== nextSessionId) {
          return null
        }

        setMessages(session.messages)
        setModelState(session.modelState ?? null)

        setCurrentSessionId(nextSessionId)
        setCurrentProjectId(session.project?.id ?? null)

        if (syncRoute && session.project?.id !== projectId) {
          onProjectSelected(session.project?.id ?? null)
        }

        if (syncRoute && sessionId !== nextSessionId) {
          onSessionSelected(nextSessionId)
        }

        return session
      } catch (error) {
        console.error('[useAgUiChat] session load failed:', error)
        setMessages([])
        setErrorMessage(
          'Unable to load that session right now. Pick another one or create a new chat.'
        )
        return null
      } finally {
        setHistoryLoadingSessionId((current) => (current === nextSessionId ? null : current))
      }
    },
    [fetchJson, onProjectSelected, onSessionSelected, projectId, sessionId, setMessages]
  )

  useEffect(() => {
    if (sessionId === routeSessionRef.current) {
      return
    }

    routeSessionRef.current = sessionId

    if (!sessionId) {
      activeSessionRef.current = null
      setCurrentSessionId(null)
      setMessages([])
      setThinking(false)
      return
    }

    if (sessionId === activeSessionRef.current) {
      return
    }

    activeSessionRef.current = sessionId
    setCurrentSessionId(sessionId)
    setErrorMessage(null)
    setThinking(false)
    void loadSession(sessionId, false)
  }, [loadSession, sessionId, setMessages])

  const createSession = useCallback(
    async (agentId: string, nextProjectId?: string) => {
      const effectiveProjectId = nextProjectId ?? currentProjectId ?? projectId

      if (!agentId) {
        setErrorMessage('Select an available agent before starting a new chat.')
        return null
      }

      if (!effectiveProjectId) {
        setErrorMessage('Select an available project before starting a new chat.')
        return null
      }

      setCreatingSession(true)
      setThinking(false)

      try {
        const session = await fetchJson<SessionDetails>('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, projectId: effectiveProjectId }),
        })

        activeSessionRef.current = session.id
        setCurrentSessionId(session.id)
        setMessages(session.messages)
        setCurrentProjectId(session.project?.id ?? effectiveProjectId)
        onSessionCreated(session.id)

        if (session.project?.id !== projectId) {
          onProjectSelected(session.project?.id ?? effectiveProjectId)
        }

        void refreshSessions()
        return session.id
      } catch (error) {
        console.error('[useAgUiChat] session create failed:', error)
        setErrorMessage(
          'Unable to start a chat session right now. Reload or try again in a moment.'
        )
        return null
      } finally {
        setCreatingSession(false)
      }
    },
    [
      currentProjectId,
      fetchJson,
      onProjectSelected,
      onSessionCreated,
      projectId,
      refreshSessions,
      setMessages,
    ]
  )

  // Keep refs in sync so the one-shot bootstrap effect always calls the latest
  // version without having them in its dependency array.
  createSessionRef.current = createSession
  loadSessionRef.current = loadSession

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const [nextAgents, nextProjects, nextSessions] = await Promise.all([
          fetchJson<AgentSummary[]>('/api/agents'),
          fetchJson<ProjectSummary[]>('/api/projects'),
          fetchJson<SessionSummary[]>('/api/sessions'),
        ])

        if (cancelled) return

        setAgents(nextAgents)
        setProjects(nextProjects)
        setSessionsAndRef(nextSessions)

        const nextActiveAgents = nextAgents.filter((candidate) => candidate.status === 'active')
        const nextActiveAgentIds = new Set(nextActiveAgents.map((agent) => agent.id))

        const availableProjectIds = new Set(
          nextProjects
            .filter((project) => project.status === 'available')
            .map((project) => project.id)
        )
        const preferredProjectId =
          projectId && availableProjectIds.has(projectId)
            ? projectId
            : currentProjectId && availableProjectIds.has(currentProjectId)
              ? currentProjectId
              : (nextSessions.find(
                  (session) => session.project && availableProjectIds.has(session.project.id)
                )?.project?.id ??
                nextProjects.find((project) => project.status === 'available')?.id ??
                null)

        setCurrentProjectId(preferredProjectId)

        if (preferredProjectId !== projectId) {
          onProjectSelected(preferredProjectId)
        }

        const preferredSession =
          (sessionId && nextSessions.find((session) => session.id === sessionId)) ??
          nextSessions.find(
            (session) =>
              session.project?.id === preferredProjectId && nextActiveAgentIds.has(session.agentId)
          ) ??
          null

        if (preferredSession) {
          activeSessionRef.current = preferredSession.id
          setCurrentSessionId(preferredSession.id)
          // End the amber loading banner now — loadSession will show the
          // history-shimmer pill for the session-fetch phase.
          setLoading(false)
          await loadSessionRef.current!(
            preferredSession.id,
            sessionId !== preferredSession.id || preferredSession.project?.id !== projectId
          )
          return
        }

        activeSessionRef.current = null
        setCurrentSessionId(null)

        if (sessionId !== null) {
          onSessionCleared()
        }

        if (!preferredProjectId) {
          setMessages([])
          setErrorMessage(
            'No projects are currently available. Check the generated workspace config and try again.'
          )
          return
        }

        if (nextActiveAgents.length === 0) {
          setMessages([])
          setErrorMessage(
            'No agents are currently available. Start an adapter and reload to continue.'
          )
          return
        }

        if (cancelled) return
        setMessages([])
      } catch (error) {
        console.error('[useAgUiChat] bootstrap failed:', error)
        setErrorMessage('Unable to load chat data right now. Reload or try again in a moment.')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!currentSessionId || currentSession?.source !== 'live') {
      setStreamReconnecting(false)
      return
    }

    activeSessionRef.current = currentSessionId
    setStreamReconnecting(false)
    const sse = new EventSource(`/api/stream?sessionId=${encodeURIComponent(currentSessionId)}`)

    sse.onopen = () => {
      if (activeSessionRef.current !== currentSessionId) return
      setStreamReconnecting(false)
    }

    sse.addEventListener(EventType.RUN_STARTED, () => {
      setStreamReconnecting(false)
      setThinking(true)
    })

    sse.addEventListener(EventType.TEXT_MESSAGE_START, (event: MessageEvent<string>) => {
      if (activeSessionRef.current !== currentSessionId) return

      const { messageId } = JSON.parse(event.data) as { messageId: string }
      setMessages((current) =>
        current.some((message) => message.id === messageId)
          ? current
          : [...current, { id: messageId, role: 'assistant', content: '', structuredBlocks: [] }]
      )
    })

    sse.addEventListener(EventType.TEXT_MESSAGE_CONTENT, (event: MessageEvent<string>) => {
      if (activeSessionRef.current !== currentSessionId) return
      setStreamReconnecting(false)

      const { messageId, delta } = JSON.parse(event.data) as { messageId: string; delta: string }

      setMessages((current) => {
        let found = false
        const nextMessages = current.map((message) => {
          if (message.id !== messageId) return message

          found = true
          return { ...message, content: message.content + delta }
        })

        return found
          ? nextMessages
          : [
              ...nextMessages,
              { id: messageId, role: 'assistant', content: delta, structuredBlocks: [] },
            ]
      })
    })

    sse.addEventListener(EventType.CUSTOM, (event: MessageEvent<string>) => {
      if (activeSessionRef.current !== currentSessionId) return
      setStreamReconnecting(false)

      const customEvent = JSON.parse(event.data) as {
        name?: string
        value?: Record<string, unknown>
      }

      if (customEvent.name !== 'a2ui:tool_call') {
        return
      }

      const payload = customEvent.value ?? {}
      const callId = typeof payload['callId'] === 'string' ? payload['callId'] : null
      const toolName = typeof payload['toolName'] === 'string' ? payload['toolName'] : null
      const done = payload['done'] === true
      if (!callId || !toolName) {
        return
      }

      setMessages((current) => {
        const nextMessages = [...current]
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
          return nextMessages
        }

        return [...nextMessages, mergedMessage]
      })
    })

    const finishRun = () => {
      if (activeSessionRef.current !== currentSessionId) return
      setThinking(false)
      void refreshSessions()
    }

    sse.addEventListener(EventType.RUN_FINISHED, finishRun)
    sse.addEventListener(EventType.RUN_ERROR, finishRun)

    sse.onerror = () => {
      if (activeSessionRef.current !== currentSessionId) return
      setThinking(false)
      setStreamReconnecting(true)
    }

    return () => {
      sse.close()
    }
  }, [currentSession?.source, currentSessionId, refreshSessions, setMessages])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!currentSessionId) return

      // Find which agent owns the current session so we can pass agentId in the payload
      const currentSession = sessions.find((s) => s.id === currentSessionId)
      const agentId = currentSession?.agentId ?? null

      setErrorMessage(null)
      setMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: 'user', content: text },
      ])

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
        console.error('[useAgUiChat] message send failed:', error)
        setErrorMessage('Message failed to send. Check the agent connection and try again.')
        throw error
      }
    },
    [currentSessionId, refreshSessions, sessions, setMessages]
  )

  const selectSession = useCallback(
    async (nextSessionId: string) => {
      if (nextSessionId === currentSessionId) return
      activeSessionRef.current = nextSessionId
      setCurrentSessionId(nextSessionId)
      setErrorMessage(null)
      setThinking(false)
      await loadSession(nextSessionId, true)
    },
    [currentSessionId, loadSession]
  )

  const selectProject = useCallback(
    async (nextProjectId: string) => {
      if (nextProjectId === currentProjectId) {
        return
      }

      const candidate = projects.find((project) => project.id === nextProjectId)
      if (!candidate || candidate.status !== 'available') {
        return
      }

      setErrorMessage(null)
      setMessages([])
      setThinking(false)
      setCurrentProjectId(nextProjectId)
      onProjectSelected(nextProjectId)

      // Pick the first active agent for the new project session
      const firstActive = agents.find((agent) => agent.status === 'active')
      if (!firstActive) {
        return
      }

      activeSessionRef.current = null
      setCurrentSessionId(null)
      await createSession(firstActive.id, nextProjectId)
    },
    [agents, createSession, currentProjectId, onProjectSelected, projects, setMessages]
  )

  const startNewSession = useCallback(
    async (agentId: string) => {
      setErrorMessage(null)
      await createSession(agentId)
    },
    [createSession]
  )

  const resumeSession = useCallback(
    async (agentId: string) => {
      if (!currentSessionId) return
      setErrorMessage(null)
      setThinking(false)
      setStreamReconnecting(false)
      setCreatingSession(true)

      // Snapshot messages before the async call — we'll prepend them to the new session
      // so the transcript shows the full prior conversation immediately.
      const priorMessages = messagesRef.current

      try {
        // Pass sourceAgentId so the backend can disambiguate cross-provider session lookups
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
        activeSessionRef.current = session.id
        setCurrentSessionId(session.id)
        // Prepend the source conversation so the transcript is continuous.
        // The new session's own messages (the context-handoff exchange) are appended after.
        setMessages([...priorMessages, ...session.messages])
        setCurrentProjectId(session.project?.id ?? null)
        onSessionCreated(session.id)
        if (session.project?.id !== projectId) {
          onProjectSelected(session.project?.id ?? null)
        }
        void refreshSessions()
      } catch (error) {
        console.error('[useAgUiChat] session resume failed:', error)
        setErrorMessage('Unable to continue this conversation right now. Try again in a moment.')
      } finally {
        setCreatingSession(false)
      }
    },
    [
      currentSession?.agentId,
      currentSessionId,
      fetchJson,
      onProjectSelected,
      onSessionCreated,
      projectId,
      refreshSessions,
      setMessages,
    ]
  )

  /**
   * Load a history session as a live session via ACP `session/load`.
   * This resumes the *original* session in the agent rather than creating a
   * new session with a handoff.  Only supported by agents that advertise the
   * `loadSession` capability (e.g. opencode).
   */
  const loadHistorySession = useCallback(
    async (agentId: string) => {
      if (!currentSessionId) return
      setErrorMessage(null)
      setThinking(false)
      setStreamReconnecting(false)
      setCreatingSession(true)

      // Snapshot messages before the async call — we'll prepend them to the
      // loaded session so the transcript shows the full prior conversation.
      const priorMessages = messagesRef.current

      try {
        const session = await fetchJson<SessionDetails>(
          `/api/sessions/${encodeURIComponent(currentSessionId)}/load`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId }),
          }
        )
        activeSessionRef.current = session.id
        setCurrentSessionId(session.id)
        // Optimistically upsert the new live session into the sessions list so
        // that currentSession immediately resolves to source:'live'.  Without
        // this, there is a race: if refreshSessions resolves before React
        // commits the setCurrentSessionId update above, currentSession would
        // still look up the old history ID and find source:'history', sending
        // the UI back into history mode.
        setSessionsAndRef([
          ...sessionsRef.current.filter((s) => s.id !== session.id),
          {
            id: session.id,
            title: session.title,
            updatedAt: session.updatedAt,
            agentId: session.agentId,
            project: session.project,
            source: session.source,
          },
        ])
        // Prepend the history messages so the transcript is continuous.
        setMessages([...priorMessages, ...session.messages])
        setModelState(session.modelState ?? null)
        setCurrentProjectId(session.project?.id ?? null)
        onSessionCreated(session.id)
        if (session.project?.id !== projectId) {
          onProjectSelected(session.project?.id ?? null)
        }
        void refreshSessions()
      } catch (error) {
        console.error('[useAgUiChat] session load failed:', error)
        setErrorMessage('Unable to load this session right now. Try again in a moment.')
      } finally {
        setCreatingSession(false)
      }
    },
    [
      currentSessionId,
      fetchJson,
      onProjectSelected,
      onSessionCreated,
      projectId,
      refreshSessions,
      sessionsRef,
      setMessages,
      setSessionsAndRef,
    ]
  )

  const addProject = useCallback(
    async (name: string, path: string) => {
      const project = await fetchJson<ProjectSummary>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path }),
      })

      const nextProjects = await refreshProjects()
      const resolvedProject =
        nextProjects.find((candidate) => candidate.id === project.id) ?? project
      setCurrentProjectId(resolvedProject.id)
      onProjectSelected(resolvedProject.id)
      return resolvedProject
    },
    [fetchJson, onProjectSelected, refreshProjects]
  )

  const removeProjectById = useCallback(
    async (projectIdToRemove: string) => {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectIdToRemove)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`/api/projects/${projectIdToRemove} failed with status ${response.status}`)
      }

      const nextProjects = await refreshProjects()
      if (currentProjectId === projectIdToRemove) {
        const fallbackProject =
          nextProjects.find((project) => project.status === 'available') ?? null
        activeSessionRef.current = null
        setCurrentProjectId(fallbackProject?.id ?? null)
        setCurrentSessionId(null)
        setMessages([])
        setThinking(false)
        onSessionCleared()
        onProjectSelected(fallbackProject?.id ?? null)
      }
    },
    [currentProjectId, onProjectSelected, onSessionCleared, refreshProjects, setMessages]
  )

  const suggestProjectPaths = useCallback(
    async (path: string) => {
      return fetchJson<ProjectPathSuggestion[]>(
        `/api/projects/path-suggestions?path=${encodeURIComponent(path)}`
      )
    },
    [fetchJson]
  )

  const setSessionModel = useCallback(
    async (newModelId: string) => {
      if (!currentSessionId) return
      await fetchJson(`/api/sessions/${encodeURIComponent(currentSessionId)}/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: newModelId }),
      })
      setModelState((prev) => (prev ? { ...prev, currentModelId: newModelId } : prev))
    },
    [currentSessionId, fetchJson]
  )

  return {
    activeAgents,
    agents,
    creatingSession,
    errorMessage,
    historyLoading: historyLoadingSessionId !== null,
    loading,
    messages,
    modelState,
    projects,
    ready,
    selectedProject,
    selectProject,
    selectSession,
    sendMessage,
    sessionId: currentSessionId,
    currentSession,
    sessions,
    startNewSession,
    resumeSession,
    loadHistorySession,
    setSessionModel,
    streamReconnecting,
    thinking,
    availableProjects,
    addProject,
    removeProject: removeProjectById,
    suggestProjectPaths,
  }
}

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

export function buildSendMessagePayload(message: string, agentId: string | null) {
  return {
    ...(agentId ? { agentId } : {}),
    message,
  }
}
