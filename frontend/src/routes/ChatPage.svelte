<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { createChatStore } from '../store/chatStore.svelte.js'
  import ChatHeader from '../components/chat/ChatHeader.svelte'
  import SessionList from '../components/chat/SessionList.svelte'
  import ChatComposer from '../components/chat/ChatComposer.svelte'
  import ChatDiffView from '../components/chat/ChatDiffView.svelte'
  import ChatTranscript from '../components/chat/ChatTranscript.svelte'
  import ProjectContextSwitcher from '../components/chat/ProjectContextSwitcher.svelte'
  import ProjectWorkspacePanel, {
    type ProjectTreeEntry,
  } from '../components/chat/ProjectWorkspacePanel.svelte'

  type WorkspaceView = 'chat' | 'files' | 'diff'

  interface ProjectDiffResponse {
    status: 'ok' | 'git_not_found' | 'error'
    diff: string
    message?: string
  }

  // ---------------------------------------------------------------------------
  // URL helpers
  // ---------------------------------------------------------------------------

  function getHashParams(): URLSearchParams {
    const hash = window.location.hash
    const queryStart = hash.indexOf('?')
    return queryStart >= 0
      ? new URLSearchParams(hash.slice(queryStart + 1))
      : new URLSearchParams()
  }

  function setHashParam(key: string, value: string | null): void {
    const params = getHashParams()
    if (value === null) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const qs = params.toString()
    window.location.hash = qs ? `/chat?${qs}` : '/chat'
  }

  function readUrlIds() {
    const params = getHashParams()
    const rawSession = params.get('session')
    const rawProject = params.get('project')
    return {
      sessionId: rawSession?.trim() || null,
      projectId: rawProject?.trim() || null,
    }
  }

  // ---------------------------------------------------------------------------
  // Chat store
  // ---------------------------------------------------------------------------

  const { sessionId: initSession, projectId: initProject } = readUrlIds()

  const store = createChatStore({
    sessionId: initSession,
    projectId: initProject,
    onProjectSelected: (nextProjectId) => setHashParam('project', nextProjectId),
    onSessionCreated: (nextSessionId) => setHashParam('session', nextSessionId),
    onSessionSelected: (nextSessionId) => setHashParam('session', nextSessionId),
    onSessionCleared: () => setHashParam('session', null),
  })

  // Propagate URL changes (back/forward navigation) into the store
  function onHashChange() {
    const { sessionId, projectId } = readUrlIds()
    store.syncRouteParams(sessionId, projectId)
  }

  onMount(() => {
    window.addEventListener('hashchange', onHashChange)

    // Normalize blank URL params: if session was whitespace-only, remove it from the hash
    const rawParams = getHashParams()
    const rawSession = rawParams.get('session')
    if (rawSession !== null && rawSession.trim() === '') {
      setHashParam('session', null)
    }

    void store.bootstrap()
    return () => window.removeEventListener('hashchange', onHashChange)
  })

  // Connect / reconnect the SSE stream whenever the active session ID changes.
  // We check source via untrack to avoid re-connecting whenever the sessions list refreshes.
  $effect(() => {
    const sid = store.currentSessionId
    if (!sid) return
    const isHistory = untrack(() => store.currentSession?.source === 'history')
    if (isHistory) return
    return store.connectStream(sid)
  })

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------

  let input = $state('')
  let workspaceView = $state<WorkspaceView>('chat')
  let drawerOpen = $state(false)
  let projectManagerOpen = $state(false)
  let resuming = $state(false)

  // File explorer
  let tree = $state<ProjectTreeEntry[]>([])
  let treePath = $state<string | null>(null)
  let treeLoading = $state(false)
  let treeError = $state<string | null>(null)
  let expandedPaths = $state<string[]>([])
  let selectedEntryPath = $state<string | null>(null)

  // Visible project filter
  let visibleProjectIds = $state<string[]>([])

  // Diff
  let diffState = $state<'loading' | 'error' | 'git_not_found' | 'empty' | 'ready'>('empty')
  let diffValue = $state('')
  let diffMessage = $state<string | null>(null)

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeSession = $derived(
    store.sessions.find((s) => s.id === store.currentSessionId) ?? null
  )

  const isHistorySession = $derived(store.currentSession?.source === 'history')

  const resumableAgents = $derived(
    store.agents.filter(
      (agent) =>
        agent.canResume &&
        (isHistorySession || agent.id !== store.currentSession?.agentId)
    )
  )

  const resumeAgent = $derived(
    isHistorySession
      ? resumableAgents.find(
          (agent) => agent.id === store.currentSession?.agentId && agent.canLoad
        )
      : undefined
  )

  const forkAgents = $derived(
    isHistorySession ? resumableAgents.filter((agent) => agent.id !== resumeAgent?.id) : []
  )

  const activeAgentName = $derived(
    store.agents.find((a) => a.id === activeSession?.agentId)?.name ?? 'the agent'
  )

  const filteredSessions = $derived(
    (() => {
      const visibleSet = new Set(visibleProjectIds)
      return store.sessions.filter(
        (session) =>
          !session.project ||
          visibleSet.size === 0 ||
          visibleSet.has(session.project.id)
      )
    })()
  )

  const activeViewLabel = $derived(
    workspaceView === 'diff' ? 'Diff' : workspaceView === 'files' ? 'Files' : 'Chat'
  )

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Reset tree when selected project changes
  $effect(() => {
    void store.selectedProject?.id // track dependency
    expandedPaths = []
    selectedEntryPath = null
    void loadTree(null)
  })

  // Sync visible project list when available projects change
  $effect(() => {
    const nextVisible = store.availableProjects.map((p) => p.id)
    const current = untrack(() => visibleProjectIds)
    if (current.length === 0) {
      visibleProjectIds = nextVisible
    } else {
      const filtered = current.filter((id) => nextVisible.includes(id))
      const added = nextVisible.filter((id) => !current.includes(id))
      const merged = [...filtered, ...added]
      visibleProjectIds = merged.length > 0 ? merged : nextVisible
    }
  })

  // Load diff when switching to diff view
  $effect(() => {
    if (workspaceView === 'diff') {
      void loadDiff()
    }
  })

  // ---------------------------------------------------------------------------
  // Tree helpers
  // ---------------------------------------------------------------------------

  function getParentTreePath(path: string): string | null {
    const lastSlash = path.lastIndexOf('/')
    return lastSlash >= 0 ? path.slice(0, lastSlash) : null
  }

  async function loadTree(nextPath: string | null = null): Promise<void> {
    if (!store.selectedProject) {
      tree = []
      treePath = null
      return
    }

    treeLoading = true
    treeError = null

    try {
      const query = nextPath ? `?path=${encodeURIComponent(nextPath)}` : ''
      const response = await fetch(
        `/api/projects/${encodeURIComponent(store.selectedProject.id)}/tree${query}`
      )
      if (!response.ok) {
        throw new Error(`Explorer request failed with status ${response.status}`)
      }
      tree = (await response.json()) as ProjectTreeEntry[]
      treePath = nextPath
    } catch (error) {
      console.error('[ChatPage] project tree load failed:', error)
      tree = []
      treeError = 'Unable to load the folder explorer right now. Try another project or reload.'
    } finally {
      treeLoading = false
    }
  }

  async function loadDiff(): Promise<void> {
    if (!store.selectedProject) {
      diffState = 'empty'
      diffValue = ''
      diffMessage = 'Choose a project to inspect the working tree.'
      return
    }

    diffState = 'loading'
    diffValue = ''
    diffMessage = null

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(store.selectedProject.id)}/diff`
      )
      if (!response.ok) {
        throw new Error(`Diff request failed with status ${response.status}`)
      }
      const payload = (await response.json()) as ProjectDiffResponse
      diffValue = payload.diff
      diffMessage = payload.message ?? null

      if (payload.status === 'git_not_found') {
        diffState = 'git_not_found'
        return
      }
      if (payload.status === 'error') {
        diffState = 'error'
        return
      }
      diffState = payload.diff.trim().length > 0 ? 'ready' : 'empty'
    } catch (error) {
      console.error('[ChatPage] project diff load failed:', error)
      diffState = 'error'
      diffValue = ''
      diffMessage = 'Unable to load the current project diff right now.'
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  async function handleResume(agentId: string): Promise<void> {
    resuming = true
    try {
      const isSameAgent = agentId === store.currentSession?.agentId
      const sessionAgent = store.agents.find((a) => a.id === agentId)
      const supportsLoad = isSameAgent && (sessionAgent?.canLoad ?? false)

      if (isHistorySession && supportsLoad) {
        await store.loadHistorySession(agentId)
      } else {
        await store.resumeSession(agentId)
      }
    } finally {
      resuming = false
    }
  }

  async function handleSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault()
    const text = input.trim()
    if (!text || !store.ready) return

    input = ''
    workspaceView = 'chat'
    try {
      await store.sendMessage(text)
    } catch {
      // Error state is already surfaced by the store.
    }
  }

  async function handleProjectSelect(nextProjectId: string): Promise<void> {
    projectManagerOpen = false
    await store.selectProject(nextProjectId)
  }

  function toggleProjectVisibility(projectIdToToggle: string, visible: boolean): void {
    if (visible) {
      if (!visibleProjectIds.includes(projectIdToToggle)) {
        visibleProjectIds = [...visibleProjectIds, projectIdToToggle]
      }
    } else {
      const next = visibleProjectIds.filter((id) => id !== projectIdToToggle)
      if (next.length > 0) visibleProjectIds = next
    }
  }

  async function handleSessionSelect(nextSessionId: string): Promise<void> {
    drawerOpen = false
    workspaceView = 'chat'
    await store.selectSession(nextSessionId)
  }

  function openProjectManager(): void {
    drawerOpen = false
    projectManagerOpen = true
  }

  function buildSurfaceTabClassName(active: boolean): string {
    return [
      'inline-flex h-10 items-center justify-center rounded-xl border px-3.5 text-sm font-medium transition',
      active
        ? 'border-teal-500/30 bg-teal-500/12 text-teal-100'
        : 'border-white/10 bg-slate-900/55 text-slate-300 hover:border-white/15 hover:bg-slate-900/85 hover:text-slate-100',
    ].join(' ')
  }
</script>

<main class="h-[100dvh] overflow-hidden bg-[#05070b] text-slate-100">
  <div class="flex h-full min-h-0 w-full flex-col">
    <ChatHeader
      activeAgentName={activeAgentName}
      errorMessage={store.errorMessage}
      project={store.selectedProject}
      sessionId={store.currentSessionId}
      ready={store.ready}
      thinking={store.thinking}
      title={activeSession?.title ?? null}
      isHistorySession={isHistorySession}
    />

    <!-- Mobile top bar -->
    <div class="flex items-center justify-between border-b border-white/8 bg-slate-950/78 px-4 py-3 lg:hidden">
      <button
        type="button"
        aria-label="Open navigation"
        onclick={() => (drawerOpen = true)}
        class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg text-slate-100 transition hover:border-white/15 hover:bg-slate-900"
      >
        ≡
      </button>

      <div class="min-w-0 text-center">
        <p class="truncate text-sm font-medium text-slate-100">
          {store.selectedProject?.name ?? 'Workspace'}
        </p>
        <p class="truncate text-xs text-slate-400">{activeViewLabel}</p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={() => (workspaceView = 'files')}
          class={buildSurfaceTabClassName(workspaceView === 'files')}
        >
          Files
        </button>
        <button
          type="button"
          onclick={() => (workspaceView = 'diff')}
          class={buildSurfaceTabClassName(workspaceView === 'diff')}
        >
          Diff
        </button>
      </div>
    </div>

    <div class="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[1fr]">
      <!-- Desktop sidebar -->
      <aside class="hidden min-h-0 overflow-hidden lg:flex">
        <div class="flex min-h-0 w-full flex-col">
          <SessionList
            agents={store.agents}
            sessions={filteredSessions}
            selectedProjectId={store.selectedProject?.id ?? null}
          activeSessionId={store.currentSessionId}
          creatingSession={store.creatingSession}
          loading={store.loading}
          onCreate={store.startNewSession}
          onSelect={handleSessionSelect}
        />

          <div class="border-r border-t border-white/8 bg-slate-950/84 p-4 text-slate-100">
            <ProjectContextSwitcher
              projects={store.projects}
              selectedProjectId={store.selectedProject?.id ?? null}
              visibleProjectIds={visibleProjectIds}
              open={projectManagerOpen}
              onOpenChange={(v) => (projectManagerOpen = v)}
              onProjectSelect={handleProjectSelect}
              onProjectVisibilityChange={toggleProjectVisibility}
              onAddProject={store.addProject}
              onRemoveProject={store.removeProject}
              onSuggestProjectPaths={store.suggestProjectPaths}
            />

            <a
              href="/#/settings"
              class="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/75 text-sm font-medium text-slate-200 transition hover:border-white/15 hover:bg-slate-900"
            >
              Settings
            </a>
          </div>
        </div>
      </aside>

      <!-- Main workspace section -->
      <section class="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#070b12] lg:border-x lg:border-white/8">
        <!-- Desktop workspace tabs -->
        <div class="hidden items-center justify-between border-b border-white/8 bg-slate-950/72 px-6 py-3 lg:flex">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Workspace view
            </p>
            <p class="mt-1 text-sm text-slate-300">
              Keep the conversation central while switching files and diff in place.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => (workspaceView = 'chat')}
              class={buildSurfaceTabClassName(workspaceView === 'chat')}
            >
              Chat
            </button>
            <button
              type="button"
              onclick={() => (workspaceView = 'files')}
              class={buildSurfaceTabClassName(workspaceView === 'files')}
            >
              Files
            </button>
            <button
              type="button"
              onclick={() => (workspaceView = 'diff')}
              class={buildSurfaceTabClassName(workspaceView === 'diff')}
            >
              Diff
            </button>
          </div>
        </div>

        {#if workspaceView === 'chat'}
          <ChatTranscript
            activeAgentName={activeAgentName}
            canManageProjects={true}
            canStartSession={store.activeAgents.length > 0 && store.availableProjects.length > 0}
            hasAnyProject={store.projects.length > 0}
            hasAvailableAgent={store.activeAgents.length > 0}
            hasAvailableProject={store.availableProjects.length > 0}
            messages={store.messages}
            projectPath={store.selectedProject?.path ?? null}
            sessionId={store.currentSessionId}
            hasSession={store.currentSessionId !== null}
            loading={store.loading}
            onOpenProjectManager={openProjectManager}
            onStartSession={() => {
              const firstAgent = store.activeAgents[0]
              if (firstAgent) {
                void store.startNewSession(firstAgent.id)
              }
            }}
            ready={store.ready}
            streamReconnecting={store.streamReconnecting}
            thinking={store.thinking}
            errorMessage={store.errorMessage}
            historyLoading={store.historyLoading}
          />
        {:else if workspaceView === 'diff'}
          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div class="mx-auto max-w-5xl">
              <ChatDiffView state={diffState} diff={diffValue} message={diffMessage} />
            </div>
          </div>
        {:else}
          <ProjectWorkspacePanel
            projects={store.projects}
            selectedProjectId={store.selectedProject?.id ?? null}
            onProjectSelect={handleProjectSelect}
            activeAgentCount={store.activeAgents.length}
            showProjectPicker={false}
            tree={tree}
            treePath={treePath}
            treeLoading={treeLoading}
            treeError={treeError}
            expandedPaths={expandedPaths}
            onToggleFolder={async (path) => {
              const collapsing = expandedPaths.includes(path)
              expandedPaths = collapsing
                ? expandedPaths.filter((item) => item !== path)
                : [path]
              await loadTree(collapsing ? getParentTreePath(path) : path)
            }}
            selectedEntryPath={selectedEntryPath}
            onSelectEntry={(p) => (selectedEntryPath = p)}
          />
        {/if}

        <ChatComposer
          value={input}
          onChange={(v) => (input = v)}
          onSubmit={handleSubmit}
          disabled={!store.ready}
          canSubmit={store.ready && input.trim().length > 0}          isHistorySession={isHistorySession}
          historyLoading={store.historyLoading}
          resumeAgent={resumeAgent}
          forkAgents={forkAgents}
          onResume={handleResume}
          onFork={handleResume}
          resumableAgents={resumableAgents}
          resuming={resuming}
          modelState={store.modelState}
          onModelChange={store.setSessionModel}
          helperText={store.ready
            ? 'The composer stays available while you inspect files or diff so the conversation never loses context.'
            : undefined}
        />
      </section>
    </div>
  </div>

  <!-- Mobile drawer -->
  {#if drawerOpen}
    <button
      type="button"
      aria-label="Close navigation"
      onclick={() => (drawerOpen = false)}
      class="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
    ></button>
    <aside
      data-testid="chat-session-drawer"
      class="fixed inset-y-0 left-0 z-50 flex w-[min(26rem,92vw)] flex-col border-r border-white/10 bg-[#050912] shadow-[0_18px_80px_rgba(2,6,23,0.6)] lg:hidden"
    >
      <div class="flex items-center justify-between border-b border-white/8 px-4 py-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            New Session
          </p>
          <p class="mt-1 text-sm text-slate-300">Navigation and project controls</p>
        </div>
        <button
          type="button"
          aria-label="Close navigation"
          onclick={() => (drawerOpen = false)}
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg text-slate-100"
        >
          ×
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <SessionList
          agents={store.agents}
          sessions={filteredSessions}
          selectedProjectId={store.selectedProject?.id ?? null}
          activeSessionId={store.currentSessionId}
          creatingSession={store.creatingSession}
          loading={store.loading}
          onCreate={async (agentId) => {
            drawerOpen = false
            await store.startNewSession(agentId)
          }}
          onSelect={handleSessionSelect}
        />
      </div>

      <div class="border-t border-white/8 p-4">
        <button
          type="button"
          aria-label="Open project manager"
          onclick={openProjectManager}
          class="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/75 text-sm font-medium text-slate-100 transition hover:border-white/15 hover:bg-slate-900"
        >
          Open project manager
        </button>

        <a
          href="/#/settings"
          onclick={() => (drawerOpen = false)}
          class="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/55 text-sm font-medium text-slate-300 transition hover:border-white/15 hover:bg-slate-900"
        >
          Settings
        </a>
      </div>
    </aside>
  {/if}

  <div class="pointer-events-none fixed inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_42%)]"></div>
</main>
