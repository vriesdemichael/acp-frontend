<script lang="ts">
  import { untrack } from 'svelte'
  import type { AgentSummary, SessionSummary } from '../../store/chatStore.svelte.js'

  interface Props {
    agents: AgentSummary[]
    sessions: SessionSummary[]
    selectedProjectId?: string | null
    activeSessionId: string | null
    creatingSession: boolean
    loading?: boolean
    onCreate: (agentId: string) => void | Promise<void>
    onSelect: (sessionId: string) => void | Promise<void>
  }

  const {
    agents,
    sessions,
    selectedProjectId = null,
    activeSessionId,
    creatingSession,
    loading = false,
    onCreate,
    onSelect,
  }: Props = $props()

  let pickerOpen = $state(false)
  let collapsedProjects = $state<string[]>([])

  const agentById = $derived(new Map(agents.map((a) => [a.id, a])))
  const activeAgents = $derived(agents.filter((agent) => agent.status === 'active'))
  const projectGroups = $derived(
    buildProjectGroups({ agentById, sessions, activeSessionId, selectedProjectId })
  )
  const selectedProjectHasSessions = $derived(
    selectedProjectId ? projectGroups.some((group) => group.id === selectedProjectId) : false
  )

  $effect(() => {
    if (!selectedProjectId) return
    const sid = selectedProjectId
    collapsedProjects = untrack(() => collapsedProjects).filter((projectId) => projectId !== sid)
  })

  function handleAgentPick(agentId: string) {
    pickerOpen = false
    void onCreate(agentId)
  }

  function handleNewChat() {
    if (activeAgents.length === 1) {
      void onCreate(activeAgents[0]!.id)
    } else {
      pickerOpen = !pickerOpen
    }
  }

  function toggleCollapsed(id: string) {
    if (collapsedProjects.includes(id)) {
      collapsedProjects = collapsedProjects.filter((p) => p !== id)
    } else {
      collapsedProjects = [...collapsedProjects, id]
    }
  }

  // ---- pure helpers --------------------------------------------------------

  interface ProjectGroup {
    id: string
    name: string
    pathLabel: string
    sessions: SessionSummary[]
  }

  function buildProjectGroups({
    agentById: agMap,
    sessions: sess,
    activeSessionId: activeSid,
    selectedProjectId: selPid,
  }: {
    agentById: Map<string, AgentSummary>
    sessions: SessionSummary[]
    activeSessionId: string | null
    selectedProjectId: string | null
  }): ProjectGroup[] {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const grouped = new Map<string, ProjectGroup>()
    const visibleSessions = sess
      .filter((session) => {
        if (session.source === 'history') return true
        return agMap.get(session.agentId)?.status !== 'disabled'
      })
      .sort((l, r) => r.updatedAt.localeCompare(l.updatedAt))

    for (const session of visibleSessions) {
      const projectId = session.project?.id ?? '__no_project__'
      const group = grouped.get(projectId)
      if (group) {
        group.sessions.push(session)
        continue
      }
      grouped.set(projectId, {
        id: projectId,
        name: session.project?.name ?? 'No project',
        pathLabel: compactProjectPath(session.project?.path ?? 'No project path'),
        sessions: [session],
      })
    }

    return Array.from(grouped.values()).sort((l, r) => {
      const ls = l.id === selPid ? 1 : 0
      const rs = r.id === selPid ? 1 : 0
      if (ls !== rs) return rs - ls
      const la = l.sessions.some((s) => s.id === activeSid) ? 1 : 0
      const ra = r.sessions.some((s) => s.id === activeSid) ? 1 : 0
      if (la !== ra) return ra - la
      return l.name.localeCompare(r.name)
    })
  }

  function compactProjectPath(path: string): string {
    const trimmed = path.trim()
    if (trimmed.length <= 36) return trimmed
    const parts = trimmed.split('/').filter(Boolean)
    if (parts.length <= 3) return trimmed
    return `/${parts[0]}/${parts[1]}/.../${parts.at(-1)}`
  }

  function formatUpdatedAt(updatedAt: string): string {
    const date = new Date(updatedAt)
    if (Number.isNaN(date.valueOf())) return 'just now'
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  function agentStatusLabel(status: AgentSummary['status']): string {
    return status === 'active' ? 'online' : status === 'detected' ? 'detected' : 'offline'
  }

  function agentDotClass(status: AgentSummary['status']): string {
    return status === 'active'
      ? 'h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)] flex-shrink-0'
      : status === 'detected'
        ? 'h-2 w-2 rounded-full bg-amber-400 flex-shrink-0'
        : 'h-2 w-2 rounded-full bg-slate-600 flex-shrink-0'
  }

  function historyProviderLabel(agentId: string): string {
    return agentId === 'copilot'
      ? 'GitHub Copilot history'
      : agentId === 'gemini-cli'
        ? 'Gemini CLI history'
        : agentId === 'opencode'
          ? 'OpenCode history'
          : `${agentId} history`
  }
</script>

<aside
  data-testid={loading ? undefined : 'chat-session-panel'}
  class="flex min-h-[18rem] flex-col border-r border-white/8 bg-slate-950/84 p-4 text-slate-100 shadow-[inset_-1px_0_0_rgba(148,163,184,0.08)] backdrop-blur"
>
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Sessions</p>
      <h2 class="mt-2 font-[family:var(--font-display)] text-[2rem] leading-tight text-slate-50">Chats</h2>
      <p class="mt-2 max-w-[14rem] text-xs leading-5 text-slate-400">
        Grouped by project so you can scan workstreams without losing repo context.
      </p>
    </div>

    <div class="relative">
      <button
        type="button"
        onclick={handleNewChat}
        disabled={creatingSession || activeAgents.length === 0}
        aria-label={activeAgents.length > 1 ? 'New chat — pick agent' : 'New chat'}
        aria-expanded={activeAgents.length > 1 ? pickerOpen : undefined}
        aria-haspopup={activeAgents.length > 1 ? 'menu' : undefined}
        class="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-3.5 text-sm font-semibold text-slate-50 transition hover:border-white/15 hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
      >
        {creatingSession ? 'Opening…' : 'New'}
        {#if activeAgents.length > 1 && !creatingSession}
          <span class="text-slate-400" aria-hidden="true">{pickerOpen ? '▲' : '▼'}</span>
        {/if}
      </button>

      {#if pickerOpen && activeAgents.length > 1}
        <div
          role="menu"
          aria-label="Pick an agent for the new chat"
          class="absolute right-0 top-full z-20 mt-2 w-52 rounded-2xl border border-white/10 bg-slate-900/95 p-1.5 shadow-xl"
        >
          {#each activeAgents as agent (agent.id)}
            <button
              role="menuitem"
              type="button"
              onclick={() => handleAgentPick(agent.id)}
              class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-800"
            >
              <span class={agentDotClass(agent.status)} aria-label={agent.status}></span>
              {agent.name}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="mt-5 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
    {#if selectedProjectId && !selectedProjectHasSessions}
      <div class="rounded-2xl border border-dashed border-teal-500/20 bg-teal-500/5 p-4 text-sm text-slate-300">
        No chats in this project yet. Start a new session to open this workspace with the selected agent.
      </div>
    {/if}

    {#if projectGroups.length === 0}
      {#if loading}
        <div class="flex flex-col gap-2" aria-label="Loading sessions" aria-busy="true">
          {#each [0, 1, 2, 3] as i (i)}
            <div class="animate-pulse rounded-2xl border border-white/8 bg-slate-900/55 px-3.5 py-3.5">
              <div class="mb-2 h-2.5 w-24 rounded-full bg-slate-700/60"></div>
              <div class="h-4 w-40 rounded-full bg-slate-700/40"></div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 p-4 text-sm text-slate-400">
          {activeAgents.length === 0
            ? 'No backends are ready yet. Start an adapter and reload to continue.'
            : 'No chats yet.'}
        </div>
      {/if}
    {:else}
      {#each projectGroups as group (group.id)}
        {@const collapsed = collapsedProjects.includes(group.id)}
        {@const selected = group.id === selectedProjectId}
        <section
          class={`rounded-2xl border px-3.5 py-3.5 ${selected ? 'border-teal-500/30 bg-[linear-gradient(180deg,rgba(10,24,31,0.5),rgba(7,14,22,0.72))]' : 'border-white/8 bg-slate-950/35'}`}
        >
          <button
            type="button"
            onclick={() => toggleCollapsed(group.id)}
            class="flex w-full items-start justify-between gap-3 text-left"
          >
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold text-slate-100">{group.name}</h3>
              <p class="mt-1 truncate text-[11px] text-slate-500">{group.pathLabel}</p>
            </div>
            <div class="flex items-center gap-2">
              {#if selected}
                <span class="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                  Current
                </span>
              {/if}
              <span class="rounded-full border border-white/10 bg-slate-900/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {group.sessions.length}
              </span>
              <span class="text-xs text-slate-500" aria-hidden="true">{collapsed ? '+' : '-'}</span>
            </div>
          </button>

          {#if !collapsed}
            <div class="mt-3 flex flex-col gap-2">
              {#each group.sessions as session (session.id)}
                {@const active = session.id === activeSessionId}
                {@const agent = agentById.get(session.agentId)}
                {@const isHistory = session.source === 'history'}
                <button
                  type="button"
                  onclick={() => void onSelect(session.id)}
                  class={`rounded-2xl border px-3.5 py-3.5 text-left transition ${active ? 'border-teal-500/35 bg-[linear-gradient(180deg,rgba(10,28,34,0.92),rgba(7,19,28,0.96))] shadow-[inset_0_0_0_1px_rgba(45,212,191,0.08)]' : 'border-white/6 bg-slate-950/35 hover:border-white/10 hover:bg-slate-900/60'}`}
                >
                  <div class="flex items-start justify-between gap-3">
                    <p class="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{session.title}</p>
                    <div class="flex shrink-0 items-center gap-1.5">
                      {#if session.source === 'history'}
                        <span title="Read-only history session" class="rounded-full border border-slate-600/40 bg-slate-800/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          History
                        </span>
                      {:else}
                        <span title="Active live session" class="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                          Live
                        </span>
                      {/if}
                      {#if active}
                        <span class="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                          Active
                        </span>
                      {/if}
                    </div>
                  </div>
                  {#if isHistory}
                    <div class="mt-3 flex items-center gap-1.5">
                      <span class="rounded-full border border-slate-600/35 bg-slate-800/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                        {historyProviderLabel(session.agentId)}
                      </span>
                    </div>
                  {:else}
                    <div class="mt-3 flex items-center gap-1.5">
                      <span class={agentDotClass(agent?.status ?? 'unavailable')} aria-label={agentStatusLabel(agent?.status ?? 'unavailable')}></span>
                      <p class="text-[11px] text-slate-400">{agent?.name ?? session.agentId}</p>
                    </div>
                  {/if}
                  <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>{formatUpdatedAt(session.updatedAt)}</span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    {/if}
  </div>
</aside>
