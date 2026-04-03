<script lang="ts">
  import type { ProjectSummary } from '../../store/chatStore.svelte.js'

  export interface ProjectTreeEntry {
    name: string
    path: string
    type: 'file' | 'directory'
    hasChildren: boolean
  }

  interface Props {
    projects: ProjectSummary[]
    selectedProjectId: string | null
    onProjectSelect: (projectId: string) => void | Promise<void>
    activeAgentCount?: number
    showProjectPicker?: boolean
    tree: ProjectTreeEntry[]
    treePath: string | null
    treeLoading: boolean
    treeError: string | null
    expandedPaths: string[]
    onToggleFolder: (path: string) => void | Promise<void>
    selectedEntryPath: string | null
    onSelectEntry: (path: string | null) => void
  }

  const {
    projects,
    selectedProjectId,
    onProjectSelect,
    activeAgentCount = 0,
    showProjectPicker = true,
    tree,
    treePath,
    treeLoading,
    treeError,
    expandedPaths,
    onToggleFolder,
    selectedEntryPath,
    onSelectEntry,
  }: Props = $props()

  let mobileOpen = $state(false)
  const panelId = 'project-workspace-panel'

  const selectedProject = $derived(projects.find((p) => p.id === selectedProjectId) ?? null)
  const expanded = $derived(new Set(expandedPaths))

  function buildProjectOptionLabel(project: ProjectSummary, agentCount: number): string {
    if (project.status !== 'available') return `${project.name} — ${project.status}`
    if (agentCount === 0) return `${project.name} — no agent online`
    return `${project.name} - ${project.path}`
  }

  function buildProjectStatusClassName(status: ProjectSummary['status']): string {
    if (status === 'available') {
      return 'rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200'
    }
    return 'rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400'
  }
</script>

{#snippet emptyPanel(title: string, description: string, tone: 'default' | 'error' = 'default')}
  <div
    class={[
      'mt-4 rounded-xl border px-4 py-5 text-sm',
      tone === 'error'
        ? 'border-rose-500/20 bg-rose-500/10 text-rose-100'
        : 'border-dashed border-white/10 bg-slate-950/60 text-slate-400',
    ].join(' ')}
  >
    <p class="font-medium text-slate-50">{title}</p>
    <p class="mt-2 leading-6">{description}</p>
  </div>
{/snippet}

<button
  type="button"
  onclick={() => (mobileOpen = !mobileOpen)}
  aria-expanded={mobileOpen}
  aria-controls={panelId}
  class="mx-4 mt-3 inline-flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-left text-slate-100 shadow-[0_18px_40px_rgba(2,6,23,0.32)] xl:hidden"
>
  <span>
    <span class="block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
      Workspace
    </span>
    <span class="mt-1 block text-sm font-medium text-slate-50">
      {selectedProject?.name ?? 'Choose a project'}
    </span>
  </span>
  <span class="text-xs text-slate-400">{mobileOpen ? 'Hide' : 'Show'}</span>
</button>

<aside
  id={panelId}
  data-testid="chat-context-panel"
  class={[
    mobileOpen ? 'flex' : 'hidden',
    'min-h-0 flex-col border-l border-white/8 bg-slate-950/82 p-4 text-slate-100 shadow-[inset_1px_0_0_rgba(148,163,184,0.08)] backdrop-blur xl:flex',
  ].join(' ')}
>
  <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Workspace</p>
  <h2 class="mt-2 font-[family:var(--font-display)] text-2xl leading-tight text-slate-50">
    Project Context
  </h2>
  <p class="mt-3 text-sm leading-6 text-slate-400">
    Pick the repository the agent should work in, then browse a read-only folder tree.
  </p>

  {#if showProjectPicker}
    <div class="mt-5 rounded-xl border border-white/10 bg-slate-900/80 p-3">
      <label class="block">
        <span class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Active Project
        </span>
        <select
          value={selectedProjectId ?? ''}
          onchange={(event) => void onProjectSelect((event.target as HTMLSelectElement).value)}
          aria-label="Active project"
          class="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-teal-500"
        >
          <option value="" disabled>
            {projects.length === 0 ? 'No projects configured' : 'Select a project'}
          </option>
          {#each projects as project (project.id)}
            <option value={project.id} disabled={project.status !== 'available'}>
              {buildProjectOptionLabel(project, activeAgentCount)}
            </option>
          {/each}
        </select>
      </label>

      {#if selectedProject}
        <div class="mt-3 rounded-lg border border-white/8 bg-slate-950/70 px-3 py-3">
          <div class="flex items-center justify-between gap-3">
            <p class="truncate text-sm font-semibold text-slate-50">{selectedProject.name}</p>
            <span class={buildProjectStatusClassName(selectedProject.status)}>
              {selectedProject.status}
            </span>
          </div>
          <p class="mt-2 break-all text-[11px] leading-5 text-slate-400">{selectedProject.path}</p>
        </div>
      {/if}
    </div>
  {:else if selectedProject}
    <div class="mt-5 rounded-xl border border-white/10 bg-slate-900/80 p-3">
      <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        Current Project
      </p>
      <div class="mt-3 rounded-lg border border-white/8 bg-slate-950/70 px-3 py-3">
        <div class="flex items-center justify-between gap-3">
          <p class="truncate text-sm font-semibold text-slate-50">{selectedProject.name}</p>
          <span class={buildProjectStatusClassName(selectedProject.status)}>
            {selectedProject.status}
          </span>
        </div>
        <p class="mt-2 break-all text-[11px] leading-5 text-slate-400">{selectedProject.path}</p>
      </div>
    </div>
  {/if}

  <section class="mt-4 flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-slate-900/70 p-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Explorer</p>
        <p class="mt-1 text-sm text-slate-300">
          {treePath ? `Inside ${treePath}` : 'Root tree'}
        </p>
      </div>
      <div class="text-[11px] text-slate-500">
        {treeLoading ? 'Loading...' : `${tree.length} items`}
      </div>
    </div>

    {#if projects.length === 0}
      {@render emptyPanel('No projects configured', 'The backend will create a starter config automatically, then use the current repo as the default workspace.')}
    {:else if !selectedProjectId}
      {@render emptyPanel('Choose a project', 'The chat session and folder explorer stay scoped to the selected repository.')}
    {:else if selectedProject?.status !== 'available'}
      {@render emptyPanel('Project unavailable', 'This entry is configured, but its path is missing or invalid on disk right now.')}
    {:else if treeError}
      {@render emptyPanel('Explorer unavailable', treeError, 'error')}
    {:else if tree.length === 0 && !treeLoading}
      {@render emptyPanel('Folder is empty', 'This location has no visible files yet.')}
    {:else}
      <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
        <div class="space-y-1">
          {#each tree as entry (entry.path)}
            {@const isDirectory = entry.type === 'directory'}
            {@const isExpanded = expanded.has(entry.path)}
            {@const isSelected = selectedEntryPath === entry.path}
            <button
              type="button"
              onclick={() => {
                onSelectEntry(entry.path)
                if (isDirectory) void onToggleFolder(entry.path)
              }}
              class={[
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition',
                isSelected
                  ? 'border-teal-500/40 bg-teal-500/10 text-slate-50'
                  : 'border-transparent bg-transparent text-slate-300 hover:border-white/8 hover:bg-slate-950/70',
              ].join(' ')}
            >
              <span class="w-4 text-center text-xs text-slate-500">
                {isDirectory ? (isExpanded ? '-' : '+') : '·'}
              </span>
              <span class="text-sm">{isDirectory ? 'DIR' : 'FILE'}</span>
              <span class="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </section>
</aside>
