import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChatComposer } from '../components/chat/ChatComposer.js'
import { ChatDiffView } from '../components/chat/ChatDiffView.js'
import { ChatHeader } from '../components/chat/ChatHeader.js'
import { ProjectContextSwitcher } from '../components/chat/ProjectContextSwitcher.js'
import { SessionList } from '../components/chat/SessionList.js'
import { ChatTranscript } from '../components/chat/ChatTranscript.js'
import { useAgUiChat } from '../hooks/useAgUiChat.js'
import {
  ProjectWorkspacePanel,
  type ProjectTreeEntry,
} from '../components/chat/ProjectWorkspacePanel.js'

type WorkspaceView = 'chat' | 'files' | 'diff'

interface ProjectDiffResponse {
  status: 'ok' | 'git_not_found' | 'error'
  diff: string
  message?: string
}

export function ChatPage() {
  const navigate = useNavigate({ from: '/chat' })
  const search = useSearch({ from: '/chat' })
  const sessionId = search.session ?? null
  const projectId = search.project ?? null

  const onProjectSelected = useCallback(
    (nextProjectId: string | null) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, project: nextProjectId ?? undefined }),
      })
    },
    [navigate]
  )

  const onSessionCreated = useCallback(
    (nextSessionId: string) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, session: nextSessionId }),
      })
    },
    [navigate]
  )

  const onSessionSelected = useCallback(
    (nextSessionId: string) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, session: nextSessionId }),
      })
    },
    [navigate]
  )

  const onSessionCleared = useCallback(() => {
    void navigate({
      to: '/chat',
      search: (current) => ({ ...current, session: undefined }),
    })
  }, [navigate])

  const {
    addProject,
    agents,
    activeAgents,
    availableProjects,
    creatingSession,
    currentSession,
    errorMessage,
    historyLoading,
    loading,
    loadHistorySession,
    messages,
    projects,
    ready,
    removeProject,
    resumeSession,
    selectedProject,
    selectProject,
    selectSession,
    sendMessage,
    sessionId: activeSessionId,
    sessions,
    startNewSession,
    streamReconnecting,
    suggestProjectPaths,
    thinking,
  } = useAgUiChat({
    sessionId,
    projectId,
    onProjectSelected,
    onSessionCreated,
    onSessionSelected,
    onSessionCleared,
  })

  const [input, setInput] = useState('')
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('chat')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [projectManagerOpen, setProjectManagerOpen] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [tree, setTree] = useState<ProjectTreeEntry[]>([])
  const [treePath, setTreePath] = useState<string | null>(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<string[]>([])
  const [selectedEntryPath, setSelectedEntryPath] = useState<string | null>(null)
  const [visibleProjectIds, setVisibleProjectIds] = useState<string[]>([])
  const [diffState, setDiffState] = useState<
    'loading' | 'error' | 'git_not_found' | 'empty' | 'ready'
  >('empty')
  const [diffValue, setDiffValue] = useState('')
  const [diffMessage, setDiffMessage] = useState<string | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  )
  const isHistorySession = currentSession?.source === 'history'
  // For history sessions: all active agents (any can receive a handoff).
  // For live sessions: all active agents except the current one (switch-agent).
  const resumableAgents = useMemo(
    () =>
      agents.filter(
        (agent) => agent.canResume && (isHistorySession || agent.id !== currentSession?.agentId)
      ),
    [agents, currentSession?.agentId, isHistorySession]
  )

  // Primary resume agent: same agent as the history session AND supports session/load.
  const resumeAgent = useMemo(() => {
    if (!isHistorySession) return undefined
    return resumableAgents.find((agent) => agent.id === currentSession?.agentId && agent.canLoad)
  }, [isHistorySession, resumableAgents, currentSession?.agentId])

  // Fork agents: all resumable agents except the primary resume agent.
  const forkAgents = useMemo(() => {
    if (!isHistorySession) return []
    return resumableAgents.filter((agent) => agent.id !== resumeAgent?.id)
  }, [isHistorySession, resumableAgents, resumeAgent])
  const activeAgentName = useMemo(() => {
    const agent = agents.find((candidate) => candidate.id === activeSession?.agentId)
    return agent?.name ?? 'the agent'
  }, [activeSession, agents])
  const filteredSessions = useMemo(() => {
    const visibleProjectSet = new Set(visibleProjectIds)
    return sessions.filter(
      (session) =>
        !session.project ||
        visibleProjectSet.size === 0 ||
        visibleProjectSet.has(session.project.id)
    )
  }, [sessions, visibleProjectIds])

  const getParentTreePath = useCallback((path: string): string | null => {
    const lastSlash = path.lastIndexOf('/')
    return lastSlash >= 0 ? path.slice(0, lastSlash) : null
  }, [])

  const loadTree = useCallback(
    async (nextPath: string | null = null) => {
      if (!selectedProject) {
        setTree([])
        setTreePath(null)
        return
      }

      setTreeLoading(true)
      setTreeError(null)

      try {
        const query = nextPath ? `?path=${encodeURIComponent(nextPath)}` : ''
        const response = await fetch(
          `/api/projects/${encodeURIComponent(selectedProject.id)}/tree${query}`
        )
        if (!response.ok) {
          throw new Error(`Explorer request failed with status ${response.status}`)
        }

        const nextTree = (await response.json()) as ProjectTreeEntry[]
        setTree(nextTree)
        setTreePath(nextPath)
      } catch (error) {
        console.error('[ChatPage] project tree load failed:', error)
        setTree([])
        setTreeError('Unable to load the folder explorer right now. Try another project or reload.')
      } finally {
        setTreeLoading(false)
      }
    },
    [selectedProject]
  )

  const loadDiff = useCallback(async () => {
    if (!selectedProject) {
      setDiffState('empty')
      setDiffValue('')
      setDiffMessage('Choose a project to inspect the working tree.')
      return
    }

    setDiffState('loading')
    setDiffValue('')
    setDiffMessage(null)

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedProject.id)}/diff`)
      if (!response.ok) {
        throw new Error(`Diff request failed with status ${response.status}`)
      }

      const payload = (await response.json()) as ProjectDiffResponse
      setDiffValue(payload.diff)
      setDiffMessage(payload.message ?? null)

      if (payload.status === 'git_not_found') {
        setDiffState('git_not_found')
        return
      }

      if (payload.status === 'error') {
        setDiffState('error')
        return
      }

      setDiffState(payload.diff.trim().length > 0 ? 'ready' : 'empty')
    } catch (error) {
      console.error('[ChatPage] project diff load failed:', error)
      setDiffState('error')
      setDiffValue('')
      setDiffMessage('Unable to load the current project diff right now.')
    }
  }, [selectedProject])

  useEffect(() => {
    setExpandedPaths([])
    setSelectedEntryPath(null)
    void loadTree(null)
  }, [loadTree, selectedProject?.id])

  useEffect(() => {
    const nextVisible = availableProjects.map((project) => project.id)
    setVisibleProjectIds((current) => {
      if (current.length === 0) {
        return nextVisible
      }

      const filtered = current.filter((projectId) => nextVisible.includes(projectId))
      const added = nextVisible.filter((projectId) => !current.includes(projectId))
      const merged = [...filtered, ...added]
      return merged.length > 0 ? merged : nextVisible
    })
  }, [availableProjects])

  useEffect(() => {
    if (workspaceView === 'diff') {
      void loadDiff()
    }
  }, [loadDiff, workspaceView])

  const handleResume = async (agentId: string) => {
    setResuming(true)
    try {
      // When the user picks the same agent that originally created this history
      // session and that agent supports ACP session/load, use it to resume the
      // real session instead of creating a new one with a handoff transcript.
      const isSameAgent = agentId === currentSession?.agentId
      const sessionAgent = agents.find((a) => a.id === agentId)
      const supportsLoad = isSameAgent && (sessionAgent?.canLoad ?? false)

      if (isHistorySession && supportsLoad) {
        await loadHistorySession(agentId)
      } else {
        await resumeSession(agentId)
      }
    } finally {
      setResuming(false)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !ready) return

    try {
      await sendMessage(text)
      setInput('')
      setWorkspaceView('chat')
    } catch {
      // Error state is already surfaced by the hook.
    }
  }

  const handleProjectSelect = async (nextProjectId: string) => {
    setProjectManagerOpen(false)
    await selectProject(nextProjectId)
  }

  const toggleProjectVisibility = (projectIdToToggle: string, visible: boolean) => {
    setVisibleProjectIds((current) => {
      if (visible) {
        return current.includes(projectIdToToggle) ? current : [...current, projectIdToToggle]
      }

      const next = current.filter((projectIdValue) => projectIdValue !== projectIdToToggle)
      return next.length > 0 ? next : current
    })
  }

  const handleSessionSelect = async (nextSessionId: string) => {
    setDrawerOpen(false)
    setWorkspaceView('chat')
    await selectSession(nextSessionId)
  }

  const openProjectManager = () => {
    setDrawerOpen(false)
    setProjectManagerOpen(true)
  }

  const activeViewLabel =
    workspaceView === 'diff' ? 'Diff' : workspaceView === 'files' ? 'Files' : 'Chat'

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#05070b] text-slate-100">
      <div className="flex h-full min-h-0 w-full flex-col">
        <ChatHeader
          activeAgentName={activeAgentName}
          errorMessage={errorMessage}
          project={selectedProject}
          sessionId={activeSessionId}
          ready={ready}
          thinking={thinking}
          title={activeSession?.title ?? null}
          isHistorySession={isHistorySession}
        />

        <div className="flex items-center justify-between border-b border-white/8 bg-slate-950/78 px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg text-slate-100 transition hover:border-white/15 hover:bg-slate-900"
          >
            ≡
          </button>

          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-medium text-slate-100">
              {selectedProject?.name ?? 'Workspace'}
            </p>
            <p className="truncate text-xs text-slate-400">{activeViewLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWorkspaceView('files')}
              className={buildSurfaceTabClassName(workspaceView === 'files')}
            >
              Files
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('diff')}
              className={buildSurfaceTabClassName(workspaceView === 'diff')}
            >
              Diff
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[1fr]">
          <aside className="hidden min-h-0 overflow-hidden lg:flex">
            <div className="flex min-h-0 w-full flex-col">
              <SessionList
                agents={agents}
                sessions={filteredSessions}
                selectedProjectId={selectedProject?.id ?? null}
                activeSessionId={activeSessionId}
                creatingSession={creatingSession}
                loading={loading}
                onCreate={startNewSession}
                onSelect={handleSessionSelect}
              />

              <div className="border-r border-t border-white/8 bg-slate-950/84 p-4 text-slate-100">
                <ProjectContextSwitcher
                  projects={projects}
                  selectedProjectId={selectedProject?.id ?? null}
                  visibleProjectIds={visibleProjectIds}
                  open={projectManagerOpen}
                  onOpenChange={setProjectManagerOpen}
                  onProjectSelect={handleProjectSelect}
                  onProjectVisibilityChange={toggleProjectVisibility}
                  onAddProject={addProject}
                  onRemoveProject={removeProject}
                  onSuggestProjectPaths={suggestProjectPaths}
                />

                <Link
                  to="/settings"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/75 text-sm font-medium text-slate-200 transition hover:border-white/15 hover:bg-slate-900"
                >
                  Settings
                </Link>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#070b12] lg:border-x lg:border-white/8">
            <div className="hidden items-center justify-between border-b border-white/8 bg-slate-950/72 px-6 py-3 lg:flex">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Workspace view
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Keep the conversation central while switching files and diff in place.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceView('chat')}
                  className={buildSurfaceTabClassName(workspaceView === 'chat')}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceView('files')}
                  className={buildSurfaceTabClassName(workspaceView === 'files')}
                >
                  Files
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceView('diff')}
                  className={buildSurfaceTabClassName(workspaceView === 'diff')}
                >
                  Diff
                </button>
              </div>
            </div>

            {workspaceView === 'chat' ? (
              <ChatTranscript
                activeAgentName={activeAgentName}
                canManageProjects
                canStartSession={activeAgents.length > 0 && availableProjects.length > 0}
                hasAnyProject={projects.length > 0}
                hasAvailableAgent={activeAgents.length > 0}
                hasAvailableProject={availableProjects.length > 0}
                messages={messages}
                projectPath={selectedProject?.path ?? null}
                sessionId={activeSessionId}
                hasSession={activeSessionId !== null}
                loading={loading}
                onOpenProjectManager={openProjectManager}
                onStartSession={() => {
                  const firstAgent = activeAgents[0]
                  if (firstAgent) {
                    void startNewSession(firstAgent.id)
                  }
                }}
                ready={ready}
                streamReconnecting={streamReconnecting}
                thinking={thinking}
                errorMessage={errorMessage}
                historyLoading={historyLoading}
              />
            ) : workspaceView === 'diff' ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                <div className="mx-auto max-w-5xl">
                  <ChatDiffView state={diffState} diff={diffValue} message={diffMessage} />
                </div>
              </div>
            ) : (
              <ProjectWorkspacePanel
                projects={projects}
                selectedProjectId={selectedProject?.id ?? null}
                onProjectSelect={handleProjectSelect}
                activeAgentCount={activeAgents.length}
                showProjectPicker={false}
                tree={tree}
                treePath={treePath}
                treeLoading={treeLoading}
                treeError={treeError}
                expandedPaths={expandedPaths}
                onToggleFolder={async (path) => {
                  const collapsing = expandedPaths.includes(path)

                  setExpandedPaths((current) =>
                    collapsing ? current.filter((item) => item !== path) : [path]
                  )

                  await loadTree(collapsing ? getParentTreePath(path) : path)
                }}
                selectedEntryPath={selectedEntryPath}
                onSelectEntry={setSelectedEntryPath}
              />
            )}

            <ChatComposer
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              disabled={!ready}
              canSubmit={ready && input.trim().length > 0}
              isHistorySession={isHistorySession}
              historyLoading={historyLoading}
              resumeAgent={resumeAgent}
              forkAgents={forkAgents}
              onResume={handleResume}
              onFork={handleResume}
              resumableAgents={resumableAgents}
              resuming={resuming}
              helperText={
                ready
                  ? 'The composer stays available while you inspect files or diff so the conversation never loses context.'
                  : undefined
              }
            />
          </section>
        </div>
      </div>

      {drawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          />
          <aside
            data-testid="chat-session-drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(26rem,92vw)] flex-col border-r border-white/10 bg-[#050912] shadow-[0_18px_80px_rgba(2,6,23,0.6)] lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  New Session
                </p>
                <p className="mt-1 text-sm text-slate-300">Navigation and project controls</p>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg text-slate-100"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <SessionList
                agents={agents}
                sessions={filteredSessions}
                selectedProjectId={selectedProject?.id ?? null}
                activeSessionId={activeSessionId}
                creatingSession={creatingSession}
                loading={loading}
                onCreate={async (agentId) => {
                  setDrawerOpen(false)
                  await startNewSession(agentId)
                }}
                onSelect={handleSessionSelect}
              />
            </div>

            <div className="border-t border-white/8 p-4">
              <button
                type="button"
                aria-label="Open project manager"
                onClick={openProjectManager}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/75 text-sm font-medium text-slate-100 transition hover:border-white/15 hover:bg-slate-900"
              >
                Open project manager
              </button>

              <Link
                to="/settings"
                onClick={() => setDrawerOpen(false)}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/55 text-sm font-medium text-slate-300 transition hover:border-white/15 hover:bg-slate-900"
              >
                Settings
              </Link>
            </div>
          </aside>
        </>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_42%)]" />
    </main>
  )
}

function buildSurfaceTabClassName(active: boolean): string {
  return [
    'inline-flex h-10 items-center justify-center rounded-xl border px-3.5 text-sm font-medium transition',
    active
      ? 'border-teal-500/30 bg-teal-500/12 text-teal-100'
      : 'border-white/10 bg-slate-900/55 text-slate-300 hover:border-white/15 hover:bg-slate-900/85 hover:text-slate-100',
  ].join(' ')
}
