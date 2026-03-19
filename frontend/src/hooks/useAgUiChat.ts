import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EventType } from '@ag-ui/core'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface AgentSummary {
  id: string
  name: string
  status: 'active' | 'disabled' | 'detected' | 'unavailable'
  command: string | null
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
}

interface SessionDetails extends SessionSummary {
  messages: ChatMessage[]
}

interface UseAgUiChatOptions {
  sessionId: string | null
  projectId: string | null
  onSessionCreated: (sessionId: string) => void
  onSessionSelected: (sessionId: string) => void
  onProjectSelected: (projectId: string | null) => void
}

export function useAgUiChat({
  sessionId,
  projectId,
  onSessionCreated,
  onSessionSelected,
  onProjectSelected,
}: UseAgUiChatOptions) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const activeSessionRef = useRef<string | null>(sessionId)
  const didBootstrapRef = useRef(false)
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
  const ready = useMemo(
    () => currentSessionId !== null && selectedProject?.status === 'available' && !creatingSession,
    [creatingSession, currentSessionId, selectedProject]
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
      setSessions(nextSessions)
      return nextSessions
    } catch (error) {
      console.error('[useAgUiChat] session list failed:', error)
      setErrorMessage(
        (current) =>
          current ?? 'Unable to load session history right now. Reload or try again in a moment.'
      )
      return []
    }
  }, [fetchJson])

  const loadSession = useCallback(
    async (nextSessionId: string, syncRoute = true) => {
      try {
        const session = await fetchJson<SessionDetails>(
          `/api/sessions/${encodeURIComponent(nextSessionId)}`
        )

        if (activeSessionRef.current !== nextSessionId) {
          return null
        }

        setMessages(session.messages)

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
      }
    },
    [fetchJson, onProjectSelected, onSessionSelected, projectId, sessionId]
  )

  useEffect(() => {
    if (!sessionId) return
    if (sessionId === currentSessionId) {
      activeSessionRef.current = sessionId
      return
    }

    activeSessionRef.current = sessionId
    setCurrentSessionId(sessionId)
    setErrorMessage(null)
    setThinking(false)
    void loadSession(sessionId, false)
  }, [currentSessionId, loadSession, sessionId])

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
    [currentProjectId, fetchJson, onProjectSelected, onSessionCreated, projectId, refreshSessions]
  )

  // Keep refs in sync so the one-shot bootstrap effect always calls the latest
  // version without having them in its dependency array.
  createSessionRef.current = createSession
  loadSessionRef.current = loadSession

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (didBootstrapRef.current) return
      didBootstrapRef.current = true
      setLoading(true)
      setErrorMessage(null)

      try {
        const [nextAgents, nextProjects, nextSessions] = await Promise.all([
          fetchJson<AgentSummary[]>('/api/agents'),
          fetchJson<ProjectSummary[]>('/api/projects'),
          fetchJson<SessionSummary[]>('/api/sessions'),
        ])

        setAgents(nextAgents)
        setProjects(nextProjects)
        setSessions(nextSessions)

        if (cancelled) return

        const nextActiveAgents = nextAgents.filter((candidate) => candidate.status === 'active')
        if (nextActiveAgents.length === 0) {
          setErrorMessage(
            'No agents are currently available. Start an adapter and reload to continue.'
          )
          setMessages([])
          return
        }

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
              nextActiveAgents.some((agent) => agent.id === session.agentId) &&
              session.project?.id === preferredProjectId
          ) ??
          null

        if (preferredSession) {
          activeSessionRef.current = preferredSession.id
          setCurrentSessionId(preferredSession.id)
          await loadSessionRef.current!(preferredSession.id, false)
          return
        }

        if (!preferredProjectId) {
          setMessages([])
          setErrorMessage(
            'No projects are currently available. Check the generated workspace config and try again.'
          )
          return
        }

        if (cancelled) return
        // Pick the first active agent for the automatic bootstrap session
        await createSessionRef.current!(nextActiveAgents[0]!.id)
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
    if (!currentSessionId) return

    activeSessionRef.current = currentSessionId
    const sse = new EventSource(`/api/stream?sessionId=${encodeURIComponent(currentSessionId)}`)

    sse.addEventListener(EventType.RUN_STARTED, () => {
      setThinking(true)
    })

    sse.addEventListener(EventType.TEXT_MESSAGE_START, (event: MessageEvent<string>) => {
      if (activeSessionRef.current !== currentSessionId) return

      const { messageId } = JSON.parse(event.data) as { messageId: string }
      setMessages((current) =>
        current.some((message) => message.id === messageId)
          ? current
          : [...current, { id: messageId, role: 'assistant', content: '' }]
      )
    })

    sse.addEventListener(EventType.TEXT_MESSAGE_CONTENT, (event: MessageEvent<string>) => {
      if (activeSessionRef.current !== currentSessionId) return

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
          : [...nextMessages, { id: messageId, role: 'assistant', content: delta }]
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
      setErrorMessage((current) => current ?? 'The live chat stream disconnected unexpectedly.')
    }

    return () => {
      sse.close()
    }
  }, [currentSessionId, refreshSessions])

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
    [currentSessionId, refreshSessions, sessions]
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
    [agents, createSession, currentProjectId, onProjectSelected, projects]
  )

  const startNewSession = useCallback(
    async (agentId: string) => {
      setErrorMessage(null)
      await createSession(agentId)
    },
    [createSession]
  )

  return {
    activeAgents,
    agents,
    creatingSession,
    errorMessage,
    loading,
    messages,
    projects,
    ready,
    selectedProject,
    selectProject,
    selectSession,
    sendMessage,
    sessionId: currentSessionId,
    sessions,
    startNewSession,
    thinking,
    availableProjects,
  }
}

export function buildSendMessagePayload(message: string, agentId: string | null) {
  return {
    ...(agentId ? { agentId } : {}),
    message,
  }
}
