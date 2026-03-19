import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EventType } from '@ag-ui/core'
import { ENABLE_A2UI } from '../config/features.js'
import type { A2UIToolCallPayload, StructuredBlock } from '../components/chat/a2ui-types.js'

const CHAT_AGENT_STORAGE_KEY = 'acp.chat.agent'
const CHAT_PROJECT_STORAGE_KEY = 'acp.chat.project'
const CHAT_SESSION_STORAGE_KEY = 'acp.chat.session'
const CHAT_VISIBLE_PROJECTS_STORAGE_KEY = 'acp.chat.visible-projects'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  structuredBlocks?: StructuredBlock[]
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
  source: 'live' | 'history'
}

interface SessionDetails extends SessionSummary {
  messages: ChatMessage[]
}

interface UseAgUiChatOptions {
  sessionId: string | null
  agentId: string | null
  projectId: string | null
  onSessionCreated: (sessionId: string) => void
  onSessionSelected: (sessionId: string | null) => void
  onAgentSelected: (agentId: string) => void
  onProjectSelected: (projectId: string | null) => void
}

export function useAgUiChat({
  sessionId,
  agentId,
  projectId,
  onSessionCreated,
  onSessionSelected,
  onAgentSelected,
  onProjectSelected,
}: UseAgUiChatOptions) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    () => sessionId ?? readStoredSelection(CHAT_SESSION_STORAGE_KEY)
  )
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(
    () => agentId ?? readStoredSelection(CHAT_AGENT_STORAGE_KEY)
  )
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    () => projectId ?? readStoredSelection(CHAT_PROJECT_STORAGE_KEY)
  )
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [visibleProjectIds, setVisibleProjectIds] = useState<string[]>(() =>
    readStoredSelections(CHAT_VISIBLE_PROJECTS_STORAGE_KEY)
  )
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const activeSessionRef = useRef<string | null>(sessionId)
  const pendingRouteSessionRef = useRef<string | null>(null)
  const didBootstrapRef = useRef(false)
  // Stable ref to the latest loadSession so the bootstrap effect doesn't need it
  // in its dependency array (which would cause infinite re-bootstrap loops).
  const loadSessionRef = useRef<
    ((id: string, syncRoute?: boolean) => Promise<SessionDetails | null>) | null
  >(null)

  useEffect(() => {
    if (agentId) {
      setCurrentAgentId(agentId)
    }
  }, [agentId])

  useEffect(() => {
    if (projectId) {
      setCurrentProjectId(projectId)
    }
  }, [projectId])

  useEffect(() => {
    writeStoredSelection(CHAT_AGENT_STORAGE_KEY, currentAgentId)
  }, [currentAgentId])

  useEffect(() => {
    writeStoredSelection(CHAT_PROJECT_STORAGE_KEY, currentProjectId)
  }, [currentProjectId])

  useEffect(() => {
    writeStoredSelection(CHAT_SESSION_STORAGE_KEY, currentSessionId)
  }, [currentSessionId])

  useEffect(() => {
    writeStoredSelections(CHAT_VISIBLE_PROJECTS_STORAGE_KEY, visibleProjectIds)
  }, [visibleProjectIds])

  const selectedAgent = useMemo(
    () => agents.find((candidate) => candidate.id === currentAgentId) ?? null,
    [agents, currentAgentId]
  )
  const selectedProject = useMemo(
    () => projects.find((candidate) => candidate.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  )
  const availableProjects = useMemo(
    () => projects.filter((candidate) => candidate.status === 'available'),
    [projects]
  )
  const ready = useMemo(
    () =>
      currentSessionId !== null &&
      selectedAgent?.status === 'active' &&
      selectedProject?.status === 'available' &&
      !creatingSession,
    [creatingSession, currentSessionId, selectedAgent, selectedProject]
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
        setCurrentAgentId(session.agentId)
        setCurrentProjectId(session.project?.id ?? null)

        if (syncRoute && session.agentId !== agentId) {
          onAgentSelected(session.agentId)
        }

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
    [
      agentId,
      fetchJson,
      onAgentSelected,
      onProjectSelected,
      onSessionSelected,
      projectId,
      sessionId,
    ]
  )

  // Keep the ref in sync so the bootstrap effect can call the latest version
  // without declaring loadSession as a dependency.
  loadSessionRef.current = loadSession

  useEffect(() => {
    if (!sessionId) return
    if (pendingRouteSessionRef.current && sessionId !== pendingRouteSessionRef.current) {
      return
    }
    if (sessionId === currentSessionId) {
      activeSessionRef.current = sessionId
      pendingRouteSessionRef.current = null
      return
    }

    activeSessionRef.current = sessionId
    pendingRouteSessionRef.current = null
    setCurrentSessionId(sessionId)
    setErrorMessage(null)
    setThinking(false)
    void loadSession(sessionId, false)
  }, [currentSessionId, loadSession, sessionId])

  const createSession = useCallback(
    async (nextAgentId?: string, nextProjectId?: string) => {
      const effectiveAgentId = nextAgentId ?? currentAgentId ?? agentId
      const effectiveProjectId = nextProjectId ?? currentProjectId ?? projectId

      if (!effectiveAgentId) {
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
          body: JSON.stringify({ agentId: effectiveAgentId, projectId: effectiveProjectId }),
        })

        activeSessionRef.current = session.id
        setCurrentSessionId(session.id)
        setMessages(session.messages)
        setCurrentAgentId(session.agentId)
        setCurrentProjectId(session.project?.id ?? effectiveProjectId)
        onSessionCreated(session.id)

        if (session.agentId !== agentId) {
          onAgentSelected(session.agentId)
        }

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
      agentId,
      currentAgentId,
      currentProjectId,
      fetchJson,
      onAgentSelected,
      onProjectSelected,
      onSessionCreated,
      projectId,
      refreshSessions,
    ]
  )

  // Keep refs in sync so the one-shot bootstrap effect always calls the latest
  // version without having them in its dependency array.
  loadSessionRef.current = loadSession

  useEffect(() => {
    let cancelled = false
    let bootstrapCompleted = false

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
        setVisibleProjectIds((current) => {
          const availableIds = new Set(nextProjects.map((project) => project.id))
          const filtered = current.filter((projectId) => availableIds.has(projectId))
          if (filtered.length > 0) {
            return filtered
          }

          return nextProjects.map((project) => project.id)
        })

        if (cancelled) return

        const activeAgents = nextAgents.filter((candidate) => candidate.status === 'active')
        if (activeAgents.length === 0) {
          setErrorMessage(
            'No agents are currently available. Start an adapter and reload to continue.'
          )
          setMessages([])
          return
        }

        const preferredAgentId =
          currentAgentId && activeAgents.some((candidate) => candidate.id === currentAgentId)
            ? currentAgentId
            : activeAgents[0]!.id

        setCurrentAgentId(preferredAgentId)

        if (preferredAgentId !== agentId) {
          onAgentSelected(preferredAgentId)
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
              session.agentId === preferredAgentId && session.project?.id === preferredProjectId
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
          bootstrapCompleted = true
          return
        }

        setMessages([])
        setCurrentSessionId(null)
        activeSessionRef.current = null
        pendingRouteSessionRef.current = null
        onSessionSelected(null)
        bootstrapCompleted = true
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
      if (!bootstrapCompleted) {
        didBootstrapRef.current = false
      }
    }
  }, [
    agentId,
    currentAgentId,
    currentProjectId,
    fetchJson,
    onAgentSelected,
    onProjectSelected,
    onSessionSelected,
    projectId,
    sessionId,
  ])

  useEffect(() => {
    if (!currentSessionId) return

    activeSessionRef.current = currentSessionId
    setErrorMessage(null)
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

    if (ENABLE_A2UI) {
      sse.addEventListener(EventType.CUSTOM, (event: MessageEvent<string>) => {
        if (activeSessionRef.current !== currentSessionId) return

        try {
          const parsed = JSON.parse(event.data) as { name?: string; value?: unknown }
          if (parsed.name !== 'a2ui:tool_call') return

          const payload = parsed.value as A2UIToolCallPayload
          if (!payload?.callId) return

          const block: StructuredBlock = { kind: 'tool_call', payload }

          setMessages((current) => {
            // Find the index of the most recent user message (start of current run)
            const lastUserIdx = current.reduceRight(
              (found, msg, idx) => (found === -1 && msg.role === 'user' ? idx : found),
              -1
            )

            // Only attach to an assistant message that appears after the most recent user message.
            // This prevents accidentally mutating the previous run's assistant message when a
            // tool_call CUSTOM event arrives before TEXT_MESSAGE_START for the new run.
            const searchFrom = lastUserIdx === -1 ? 0 : lastUserIdx + 1
            const lastAssistantIdx = current.reduceRight(
              (found, msg, idx) =>
                found === -1 && idx >= searchFrom && msg.role === 'assistant' ? idx : found,
              -1
            )

            if (lastAssistantIdx === -1) {
              const syntheticId = `a2ui-${payload.callId}`
              const existing = current.find((m) => m.id === syntheticId)
              if (existing) {
                return current.map((m) =>
                  m.id === syntheticId
                    ? { ...m, structuredBlocks: upsertBlock(m.structuredBlocks, block) }
                    : m
                )
              }
              return [
                ...current,
                {
                  id: syntheticId,
                  role: 'assistant',
                  content: '',
                  structuredBlocks: [block],
                },
              ]
            }

            return current.map((m, idx) =>
              idx === lastAssistantIdx
                ? { ...m, structuredBlocks: upsertBlock(m.structuredBlocks, block) }
                : m
            )
          })
        } catch {
          // Malformed CUSTOM event — ignore silently
        }
      })
    }

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
            body: JSON.stringify(buildSendMessagePayload(text, currentAgentId)),
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
    [currentAgentId, currentSessionId, refreshSessions]
  )

  const selectSession = useCallback(
    async (nextSessionId: string) => {
      if (nextSessionId === currentSessionId) return
      pendingRouteSessionRef.current = nextSessionId
      activeSessionRef.current = nextSessionId
      setCurrentSessionId(nextSessionId)
      setErrorMessage(null)
      setThinking(false)
      await loadSession(nextSessionId, true)
    },
    [currentSessionId, loadSession]
  )

  const selectAgent = useCallback(
    (nextAgentId: string) => {
      if (nextAgentId === currentAgentId) {
        return
      }

      const candidate = agents.find((agent) => agent.id === nextAgentId)
      if (!candidate || candidate.status !== 'active') {
        return
      }

      setErrorMessage(null)
      setCurrentAgentId(nextAgentId)
      onAgentSelected(nextAgentId)
    },
    [agents, currentAgentId, onAgentSelected]
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

      const matchingSession = sessions.find(
        (session) => session.project?.id === nextProjectId && session.agentId === currentAgentId
      )

      if (matchingSession) {
        pendingRouteSessionRef.current = matchingSession.id
        activeSessionRef.current = matchingSession.id
        setCurrentSessionId(matchingSession.id)
        await loadSession(matchingSession.id, true)
        return
      }

      activeSessionRef.current = null
      pendingRouteSessionRef.current = null
      setCurrentSessionId(null)
      onSessionSelected(null)
    },
    [
      currentAgentId,
      currentProjectId,
      loadSession,
      onProjectSelected,
      onSessionSelected,
      projects,
      sessions,
    ]
  )

  const addProject = useCallback(
    async (name: string, path: string): Promise<ProjectSummary> => {
      const project = await fetchJson<ProjectSummary>('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path }),
      })

      // Re-fetch the canonical list to pick up backend normalisations and correct ordering
      const refreshed = await fetchJson<ProjectSummary[]>('/api/projects')
      setProjects(refreshed)
      setVisibleProjectIds((current) => {
        const currentSet = new Set(current)
        return refreshed
          .map((project) => project.id)
          .filter((projectId) => currentSet.has(projectId) || projectId === project.id)
      })

      return project
    },
    [fetchJson]
  )

  const removeProject = useCallback(
    async (projectId: string): Promise<void> => {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(`project delete failed with status ${response.status}`)
      }

      const refreshed = await fetchJson<ProjectSummary[]>('/api/projects')
      setProjects(refreshed)
      setVisibleProjectIds((current) => {
        const refreshedIds = new Set(refreshed.map((project) => project.id))
        return current.filter((id) => refreshedIds.has(id))
      })

      if (currentProjectId === projectId) {
        const nextProjectId =
          refreshed.find((project) => project.status === 'available')?.id ?? null
        setCurrentProjectId(nextProjectId)
        onProjectSelected(nextProjectId)
        setMessages([])
        setCurrentSessionId(null)
        activeSessionRef.current = null
        pendingRouteSessionRef.current = null
        onSessionSelected(null)
      }
    },
    [currentProjectId, fetchJson, onProjectSelected, onSessionSelected]
  )

  const startNewSession = useCallback(
    async (nextAgentId: string) => {
      setErrorMessage(null)
      setCurrentAgentId(nextAgentId)
      if (nextAgentId !== agentId) {
        onAgentSelected(nextAgentId)
      }
      await createSession(nextAgentId)
    },
    [agentId, createSession, onAgentSelected]
  )

  const setProjectVisibility = useCallback(
    (projectId: string, visible: boolean) => {
      setVisibleProjectIds((current) => {
        const currentSet = new Set(current)
        if (visible) {
          currentSet.add(projectId)
        } else {
          currentSet.delete(projectId)
        }

        return projects.map((project) => project.id).filter((id) => currentSet.has(id))
      })
    },
    [projects]
  )

  return {
    addProject,
    agentId: currentAgentId,
    agents,
    creatingSession,
    errorMessage,
    loading,
    messages,
    projects,
    removeProject,
    visibleProjectIds,
    ready,
    selectedAgent,
    selectedProject,
    selectAgent,
    selectProject,
    selectSession,
    sendMessage,
    setProjectVisibility,
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

function readStoredSelection(storageKey: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  const value = window.localStorage.getItem(storageKey)?.trim()
  return value ? value : null
}

function writeStoredSelection(storageKey: string, value: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  if (!value) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, value)
}

function readStoredSelections(storageKey: string): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return []
  }

  try {
    const value = window.localStorage.getItem(storageKey)
    if (!value) {
      return []
    }

    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function writeStoredSelections(storageKey: string, values: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  if (values.length === 0) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(values))
}

/**
 * Upsert a StructuredBlock into a blocks array by callId.
 * If a block with the same callId exists, its payload is merged (existing fields
 * are preserved and the incoming payload is overlaid), so partial updates
 * (e.g. only result/done) don't discard earlier fields like toolName or args.
 * If no matching block exists, the new block is appended.
 */
function upsertBlock(
  existing: StructuredBlock[] | undefined,
  block: StructuredBlock
): StructuredBlock[] {
  if (!existing) return [block]
  const idx = existing.findIndex(
    (b) => b.kind === block.kind && b.payload.callId === block.payload.callId
  )
  if (idx === -1) return [...existing, block]
  const next = [...existing]
  next[idx] = { ...block, payload: { ...existing[idx]!.payload, ...block.payload } }
  return next
}
