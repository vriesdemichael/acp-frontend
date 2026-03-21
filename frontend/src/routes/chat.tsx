import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChatComposer } from '../components/chat/ChatComposer.js'
import { ChatHeader } from '../components/chat/ChatHeader.js'
import {
  ProjectContextSwitcher,
  type ProjectPathSuggestion,
} from '../components/chat/ProjectContextSwitcher.js'
import { SessionList } from '../components/chat/SessionList.js'
import { ChatTranscript } from '../components/chat/ChatTranscript.js'
import { useAgUiChat } from '../hooks/useAgUiChat.js'
import {
  ProjectWorkspacePanel,
  type ProjectTreeEntry,
} from '../components/chat/ProjectWorkspacePanel.js'

interface ProjectDiffResult {
  status: 'ok' | 'git_not_found'
  diff: string
  message?: string
}

export function ChatPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [workspaceMode, setWorkspaceMode] = useState<'chat' | 'files' | 'diff'>('chat')
  const navigate = useNavigate({ from: '/chat' })
  const search = useSearch({ from: '/chat' })
  const sessionId = search.session ?? null
  const agentId = search.agent ?? null
  const projectId = search.project ?? null
  const handleAgentSelected = useCallback(
    (nextAgentId: string) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, agent: nextAgentId }),
      })
    },
    [navigate]
  )

  const handleProjectSelected = useCallback(
    (nextProjectId: string | null) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, project: nextProjectId ?? undefined }),
      })
    },
    [navigate]
  )

  const handleSessionCreated = useCallback(
    (nextSessionId: string) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, session: nextSessionId }),
      })
    },
    [navigate]
  )

  const handleSessionSelected = useCallback(
    (nextSessionId: string | null) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, session: nextSessionId ?? undefined }),
      })
    },
    [navigate]
  )

  const {
    addProject,
    agentId: activeAgentId,
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
    selectProject,
    selectSession,
    sendMessage,
    setProjectVisibility,
    sessionId: activeSessionId,
    sessions,
    startNewSession,
    thinking,
  } = useAgUiChat({
    sessionId,
    agentId,
    projectId,
    onAgentSelected: handleAgentSelected,
    onProjectSelected: handleProjectSelected,
    onSessionCreated: handleSessionCreated,
    onSessionSelected: handleSessionSelected,
  })
  const [input, setInput] = useState('')
  const [tree, setTree] = useState<ProjectTreeEntry[]>([])
  const [treePath, setTreePath] = useState<string | null>(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [diffResult, setDiffResult] = useState<ProjectDiffResult | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<string[]>([])
  const [selectedEntryPath, setSelectedEntryPath] = useState<string | null>(null)
  const activeAgentName = useMemo(
    () => selectedAgent?.name ?? 'the selected agent',
    [selectedAgent]
  )
  const activeSessionTitle = useMemo(
    () => sessions.find((session) => session.id === activeSessionId)?.title ?? null,
    [activeSessionId, sessions]
  )

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

  useEffect(() => {
    setExpandedPaths([])
    setSelectedEntryPath(null)
    void loadTree(null)
  }, [loadTree, selectedProject?.id])

  useEffect(() => {
    if (workspaceMode !== 'diff' || !selectedProject) {
      return
    }

    let cancelled = false
    setDiffLoading(true)
    setDiffError(null)

    void fetch(`/api/projects/${encodeURIComponent(selectedProject.id)}/diff`)
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? `Diff request failed with status ${response.status}`)
        }

        return (await response.json()) as ProjectDiffResult
      })
      .then((result) => {
        if (!cancelled) {
          setDiffResult(result)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDiffResult(null)
          setDiffError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDiffLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedProject, workspaceMode])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !ready) return

    try {
      await sendMessage(text)
      setInput('')
    } catch {
      // Error state is already surfaced by the hook.
    }
  }

  const suggestProjectPaths = useCallback(
    async (path: string): Promise<ProjectPathSuggestion[]> => {
      const response = await fetch(
        `/api/projects/path-suggestions?path=${encodeURIComponent(path)}`
      )

      if (!response.ok) {
        throw new Error(`Path suggestions request failed with status ${response.status}`)
      }

      return (await response.json()) as ProjectPathSuggestion[]
    },
    []
  )

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#05070b] text-slate-100">
      <div className="mx-auto flex h-full w-full max-w-[1800px] flex-col overflow-hidden">
        <ChatHeader
          agentName={selectedAgent?.name ?? null}
          errorMessage={errorMessage}
          onToggleSidebar={() => setMobileSidebarOpen(true)}
          project={selectedProject}
          sessionTitle={activeSessionTitle}
          ready={ready}
          thinking={thinking}
        />

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[19rem_minmax(0,1fr)]">
          <SessionList
            agents={agents}
            sessions={sessions}
            visibleProjectIds={visibleProjectIds}
            selectedAgentId={activeAgentId}
            selectedProjectId={selectedProject?.id ?? null}
            activeSessionId={activeSessionId}
            creatingSession={creatingSession}
            mobileOpen={mobileSidebarOpen}
            onCreate={startNewSession}
            onMobileOpenChange={setMobileSidebarOpen}
            onSelect={selectSession}
            projectSwitcher={
              <ProjectContextSwitcher
                projects={projects}
                selectedProjectId={selectedProject?.id ?? null}
                visibleProjectIds={visibleProjectIds}
                onProjectSelect={selectProject}
                onProjectVisibilityChange={setProjectVisibility}
                onAddProject={addProject}
                onRemoveProject={removeProject}
                onSuggestProjectPaths={suggestProjectPaths}
              />
            }
            settingsLink={
              <Link
                to="/settings"
                className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Settings
              </Link>
            }
          />

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#070b12]">
            <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5 sm:px-5">
              <WorkspaceToggleButton
                label="Files"
                active={workspaceMode === 'files'}
                onClick={() =>
                  setWorkspaceMode((current) => (current === 'files' ? 'chat' : 'files'))
                }
              />
              <WorkspaceToggleButton
                label="Diff"
                active={workspaceMode === 'diff'}
                onClick={() =>
                  setWorkspaceMode((current) => (current === 'diff' ? 'chat' : 'diff'))
                }
              />
            </div>

            {workspaceMode === 'chat' ? (
              <ChatTranscript
                activeAgentName={activeAgentName}
                messages={messages}
                hasSession={activeSessionId !== null}
                loading={loading}
                ready={ready}
                thinking={thinking}
                errorMessage={errorMessage}
              />
            ) : workspaceMode === 'files' ? (
              <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
                <ProjectWorkspacePanel
                  projects={projects}
                  selectedProjectId={selectedProject?.id ?? null}
                  onProjectSelect={selectProject}
                  onAddProject={addProject}
                  onSuggestProjectPaths={suggestProjectPaths}
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
                  layout="explorer"
                  variant="embedded"
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
                  {diffLoading ? (
                    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-100 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
                        Diff
                      </p>
                      <p className="mt-3 text-base font-medium text-slate-50">
                        Loading project diff...
                      </p>
                    </section>
                  ) : diffError ? (
                    <section className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-100 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
                        Diff
                      </p>
                      <p className="mt-3 text-base font-medium text-slate-50">{diffError}</p>
                    </section>
                  ) : diffResult?.status === 'git_not_found' ? (
                    <section className="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 px-5 py-8 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Diff
                      </p>
                      <h2 className="mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">
                        Git not available
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                        {diffResult.message ??
                          'Git was not found on PATH for this backend process.'}
                      </p>
                    </section>
                  ) : diffResult?.diff ? (
                    <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-sm">
                      <div className="border-b border-white/8 px-5 py-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Working Tree Diff
                      </div>
                      <pre className="overflow-x-auto px-5 py-5 text-xs leading-6 text-slate-200">
                        <code>{diffResult.diff}</code>
                      </pre>
                    </section>
                  ) : (
                    <section className="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 px-5 py-8 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Diff
                      </p>
                      <h2 className="mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">
                        Working tree is clean
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                        No unstaged or staged changes are currently shown for this project.
                      </p>
                    </section>
                  )}
                </div>
              </div>
            )}

            <ChatComposer
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              disabled={!ready}
              canSubmit={ready && input.trim().length > 0}
              helperText={
                activeSessionId
                  ? 'Streaming responses appear in the workspace as the agent thinks and replies.'
                  : 'Choose a project context and start a new session before sending a message.'
              }
            />
          </section>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_42%)]" />
    </main>
  )
}

function WorkspaceToggleButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition',
        active
          ? 'border-teal-500/35 bg-teal-500/10 text-teal-200'
          : 'border-white/10 bg-slate-900/70 text-slate-300 hover:bg-slate-800',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
