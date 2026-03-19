import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChatComposer } from '../components/chat/ChatComposer.js'
import { ChatHeader } from '../components/chat/ChatHeader.js'
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

  const {
    agents,
    activeAgents,
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
    sessionId: activeSessionId,
    sessions,
    startNewSession,
    thinking,
  } = useAgUiChat({
    sessionId,
    projectId,
    onProjectSelected,
    onSessionCreated,
    onSessionSelected,
  })
  const [input, setInput] = useState('')
  const [tree, setTree] = useState<ProjectTreeEntry[]>([])
  const [treePath, setTreePath] = useState<string | null>(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<string[]>([])
  const [selectedEntryPath, setSelectedEntryPath] = useState<string | null>(null)

  // Derive the name of the agent that owns the current session for transcript display
  const activeAgentName = useMemo(() => {
    const currentSession = sessions.find((s) => s.id === activeSessionId)
    const agent = agents.find((a) => a.id === currentSession?.agentId)
    return agent?.name ?? 'the agent'
  }, [activeSessionId, agents, sessions])

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

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col">
        <ChatHeader
          errorMessage={errorMessage}
          project={selectedProject}
          sessionId={activeSessionId}
          ready={ready}
          thinking={thinking}
        />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_18rem]">
          <SessionList
            agents={agents}
            sessions={
              selectedProject
                ? sessions.filter((session) => session.project?.id === selectedProject.id)
                : sessions
            }
            activeSessionId={activeSessionId}
            creatingSession={creatingSession}
            onCreate={startNewSession}
            onSelect={selectSession}
          />

          <section className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden bg-[#070b12] xl:border-x xl:border-white/8">
            <ChatTranscript
              activeAgentName={activeAgentName}
              messages={messages}
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
            />
          </section>

          <ProjectWorkspacePanel
            projects={projects}
            selectedProjectId={selectedProject?.id ?? null}
            onProjectSelect={selectProject}
            activeAgentCount={activeAgents.length}
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
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_42%)]" />
    </main>
  )
}
