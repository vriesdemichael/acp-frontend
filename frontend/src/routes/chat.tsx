import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
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

export function ChatPage() {
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
    selectAgent,
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
          agentId={activeAgentId}
          agents={agents}
          errorMessage={errorMessage}
          onAgentSelect={selectAgent}
          project={selectedProject}
          sessionTitle={activeSessionTitle}
          ready={ready}
          thinking={thinking}
        />

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_18rem]">
          <SessionList
            agents={agents}
            sessions={sessions}
            visibleProjectIds={visibleProjectIds}
            selectedAgentId={activeAgentId}
            selectedProjectId={selectedProject?.id ?? null}
            activeSessionId={activeSessionId}
            creatingSession={creatingSession}
            onCreate={startNewSession}
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
          />

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#070b12] xl:border-x xl:border-white/8">
            <ChatTranscript
              activeAgentName={activeAgentName}
              messages={messages}
              hasSession={activeSessionId !== null}
              loading={loading}
              ready={ready}
              thinking={thinking}
              errorMessage={errorMessage}
            />

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
          />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_42%)]" />
    </main>
  )
}
