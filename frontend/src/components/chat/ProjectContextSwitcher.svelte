<script lang="ts">
  import type { ProjectSummary } from '../../store/chatStore.svelte.js'

  const RECENT_PATHS_STORAGE_KEY = 'acp.project-paths.recent'
  const DRAFT_PATH_STORAGE_KEY = 'acp.project-paths.draft-path'
  const DRAFT_NAME_STORAGE_KEY = 'acp.project-paths.draft-name'
  const MAX_RECENT_PATHS = 6

  export interface ProjectPathSuggestion {
    name: string
    path: string
  }

  interface Props {
    projects: ProjectSummary[]
    selectedProjectId: string | null
    visibleProjectIds: string[]
    open?: boolean
    onProjectSelect: (projectId: string) => void | Promise<void>
    onOpenChange?: (open: boolean) => void
    onProjectVisibilityChange: (projectId: string, visible: boolean) => void
    onAddProject: (name: string, path: string) => Promise<ProjectSummary>
    onRemoveProject: (projectId: string) => Promise<void>
    onSuggestProjectPaths: (path: string) => Promise<ProjectPathSuggestion[]>
  }

  const {
    projects,
    selectedProjectId,
    visibleProjectIds,
    open = undefined,
    onProjectSelect,
    onOpenChange,
    onProjectVisibilityChange,
    onAddProject,
    onRemoveProject,
    onSuggestProjectPaths,
  }: Props = $props()

  let uncontrolledManagerOpen = $state(false)
  let addFormOpen = $state(false)
  let addName = $state(readStoredValue(DRAFT_NAME_STORAGE_KEY))
  let addPath = $state(readStoredValue(DRAFT_PATH_STORAGE_KEY))
  let addError = $state<string | null>(null)
  let addSubmitting = $state(false)
  let removingProjectId = $state<string | null>(null)
  let pathSuggestions = $state<ProjectPathSuggestion[]>([])
  let pathSuggestionsLoading = $state(false)
  let pathSuggestionsOpen = $state(false)
  let activeSuggestionIndex = $state(-1)
  let pathSuggestionError = $state<string | null>(null)
  let isCompactViewport = $state(typeof window !== 'undefined' ? window.innerWidth < 1024 : false)
  let recentPaths = $state<string[]>(readStoredPaths(RECENT_PATHS_STORAGE_KEY))

  const suggestionListId = 'project-path-suggestions'

  const visibleProjectSet = $derived(new Set(visibleProjectIds))
  const visibleProjectCount = $derived(visibleProjectIds.length)
  const selectedProject = $derived(
    projects.find((project) => project.id === selectedProjectId) ?? null
  )
  const activeSuggestion = $derived(
    activeSuggestionIndex >= 0 ? (pathSuggestions[activeSuggestionIndex] ?? null) : null
  )
  const breadcrumbSegments = $derived(buildBreadcrumbSegments(addPath))
  const pathQuickActions = $derived(buildPathQuickActions(addPath, recentPaths))
  const pathInputValue = $derived(addPath.trim())
  const pathInputHasSearchablePrefix = $derived(looksLikeSuggestionPathInput(pathInputValue))
  const showSuggestionPanel = $derived(addFormOpen && pathInputValue.length > 0)
  const showSuggestionEmptyState = $derived(
    showSuggestionPanel &&
      !pathSuggestionsLoading &&
      !pathSuggestionError &&
      pathSuggestions.length === 0 &&
      pathInputHasSearchablePrefix
  )
  const managerOpen = $derived(open ?? uncontrolledManagerOpen)

  function setManagerOpen(nextOpen: boolean) {
    if (open === undefined) {
      uncontrolledManagerOpen = nextOpen
    }
    onOpenChange?.(nextOpen)
  }

  function applySuggestion(suggestion: ProjectPathSuggestion) {
    addPath = toTraversableSuggestionPath(suggestion.path)
    pathSuggestionsOpen = true
    activeSuggestionIndex = -1
  }

  function applyPath(path: string) {
    addPath = toTraversableSuggestionPath(path)
    pathSuggestionsOpen = true
    activeSuggestionIndex = -1
  }

  // Persist drafts
  $effect(() => {
    writeStoredValue(DRAFT_NAME_STORAGE_KEY, addName)
  })

  $effect(() => {
    writeStoredValue(DRAFT_PATH_STORAGE_KEY, addPath)
  })

  // Resize handler
  $effect(() => {
    const handleResize = () => {
      isCompactViewport = window.innerWidth < 1024
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  })

  // Path suggestion debounce
  $effect(() => {
    if (!addFormOpen) {
      pathSuggestions = []
      pathSuggestionsLoading = false
      pathSuggestionsOpen = false
      activeSuggestionIndex = -1
      pathSuggestionError = null
      return
    }

    const trimmedPath = addPath.trim()
    if (!trimmedPath || !looksLikeSuggestionPathInput(trimmedPath)) {
      pathSuggestions = []
      pathSuggestionsLoading = false
      pathSuggestionsOpen = false
      activeSuggestionIndex = -1
      pathSuggestionError = null
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      pathSuggestionsLoading = true
      pathSuggestionError = null

      void onSuggestProjectPaths(trimmedPath)
        .then((nextSuggestions) => {
          if (cancelled) return
          pathSuggestions = nextSuggestions
          pathSuggestionsOpen = true
          activeSuggestionIndex = nextSuggestions.length > 0 ? 0 : -1
        })
        .catch(() => {
          if (cancelled) return
          pathSuggestions = []
          pathSuggestionsOpen = true
          activeSuggestionIndex = -1
          pathSuggestionError = 'Unable to load folder suggestions right now.'
        })
        .finally(() => {
          if (!cancelled) {
            pathSuggestionsLoading = false
          }
        })
    }, 140)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  })

  // Keep activeSuggestionIndex in bounds
  $effect(() => {
    if (activeSuggestionIndex >= pathSuggestions.length) {
      activeSuggestionIndex = pathSuggestions.length > 0 ? 0 : -1
    }
  })

  async function handleAddSubmit(e: Event) {
    e.preventDefault()
    const trimmedPath = addPath.trim()

    if (!trimmedPath) {
      addError = 'Path is required.'
      return
    }

    const effectiveName =
      addName.trim() || (trimmedPath.split('/').filter(Boolean).pop() ?? trimmedPath)

    addError = null
    addSubmitting = true

    try {
      const newProject = await onAddProject(effectiveName, trimmedPath)
      const normalizedStoredPath = normalizeStoredPath(trimmedPath)
      if (normalizedStoredPath) {
        const next = [
          normalizedStoredPath,
          ...recentPaths.filter((item) => item !== normalizedStoredPath),
        ].slice(0, MAX_RECENT_PATHS)
        writeStoredPaths(RECENT_PATHS_STORAGE_KEY, next)
        recentPaths = next
      }

      addName = ''
      addPath = ''
      addFormOpen = false
      pathSuggestions = []
      pathSuggestionsOpen = false
      activeSuggestionIndex = -1
      onProjectVisibilityChange(newProject.id, true)
      await onProjectSelect(newProject.id)
    } catch {
      addError = 'Failed to add project. Check the name and path and try again.'
    } finally {
      addSubmitting = false
    }
  }

  function handlePathKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      pathSuggestionsOpen = false
      activeSuggestionIndex = -1
      return
    }

    if (pathSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      pathSuggestionsOpen = true
      activeSuggestionIndex =
        activeSuggestionIndex < pathSuggestions.length - 1 ? activeSuggestionIndex + 1 : 0
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      pathSuggestionsOpen = true
      activeSuggestionIndex =
        activeSuggestionIndex > 0 ? activeSuggestionIndex - 1 : pathSuggestions.length - 1
      return
    }

    if (e.key === 'Enter' && pathSuggestionsOpen && activeSuggestion) {
      e.preventDefault()
      applySuggestion(activeSuggestion)
    }
  }
</script>

<button
  type="button"
  aria-label="Open project manager"
  onclick={() => setManagerOpen(true)}
  class="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-left transition hover:border-white/15 hover:bg-slate-900"
>
  <span>
    <span class="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
      Projects
    </span>
    <span class="mt-1 block text-sm font-semibold text-slate-50">
      {selectedProject?.name ?? 'Manage projects'}
    </span>
    <span class="mt-1 block text-[11px] text-slate-400">
      {visibleProjectCount} visible in chats
    </span>
  </span>
  <span class="rounded-full border border-white/10 bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
    Open
  </span>
</button>

{#if managerOpen}
  <!-- Main manager modal -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm sm:px-6 lg:px-10">
    <div class="flex h-full max-h-[min(88vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f17] shadow-[0_30px_120px_rgba(2,6,23,0.65)]">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div class="min-w-0">
          <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Projects
          </p>
          <h2 class="mt-2 font-[family:var(--font-display)] text-2xl text-slate-50">
            Manage Project Views
          </h2>
          <p class="mt-2 text-sm text-slate-400">
            Show or hide projects in the chat rail, choose the current workspace, and add
            new repositories.
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onclick={() => {
              addFormOpen = !addFormOpen
              addError = null
            }}
            class="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            {addFormOpen ? 'Hide Add Project' : 'Add Project'}
          </button>
          <button
            type="button"
            onclick={() => setManagerOpen(false)}
            class="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>

      <div
        class={[
          'grid min-h-0 flex-1 gap-0 overflow-hidden',
          addFormOpen
            ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]'
            : 'lg:grid-cols-[minmax(0,1fr)]',
        ].join(' ')}
      >
        <section class="min-h-0 overflow-y-auto border-b border-white/8 px-5 py-4 lg:border-b-0 lg:border-r">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Session Rail
              </p>
              <p class="mt-1 text-sm text-slate-300">
                Choose which projects appear in chats.
              </p>
            </div>
            <span class="rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {visibleProjectCount}/{projects.length}
            </span>
          </div>

          <div class="space-y-2">
            {#each projects as project (project.id)}
              {@const visible = visibleProjectSet.has(project.id)}
              {@const current = project.id === selectedProjectId}
              {@const selectable = project.status === 'available'}
              <div class="rounded-xl border border-white/8 bg-slate-900/55 px-3 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="truncate text-sm font-semibold text-slate-50">{project.name}</p>
                      {#if current}
                        <span class="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                          Current
                        </span>
                      {/if}
                      <span class={buildProjectStatusClassName(project.status)}>
                        {describeProjectStatus(project.status)}
                      </span>
                    </div>
                    <p class="mt-2 break-all text-[11px] leading-5 text-slate-400">{project.path}</p>
                  </div>
                  <button
                    type="button"
                    onclick={() => onProjectVisibilityChange(project.id, !visible)}
                    class={[
                      'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]',
                      visible
                        ? 'border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-900'
                        : 'border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15',
                    ].join(' ')}
                  >
                    {visible ? 'Shown' : 'Hidden'}
                  </button>
                </div>

                <div class="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3">
                  <p class="text-[11px] text-slate-500">
                    {visible ? 'Visible in the session viewer.' : 'Hidden from the session viewer.'}
                  </p>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onclick={() => {
                        removingProjectId = project.id
                        void onRemoveProject(project.id).finally(() => {
                          if (removingProjectId === project.id) removingProjectId = null
                        })
                      }}
                      disabled={removingProjectId === project.id}
                      class="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {removingProjectId === project.id ? 'Removing' : 'Remove'}
                    </button>
                    <button
                      type="button"
                      disabled={!selectable || current}
                      onclick={() => void onProjectSelect(project.id)}
                      class="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:text-slate-500"
                    >
                      {current ? 'Selected' : 'Use'}
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </section>

        {#if addFormOpen && !isCompactViewport}
          <section class="min-h-0 overflow-y-auto px-5 py-4">
            {#snippet addProjectFormContent()}
              <div>
                <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Add Project
                </p>
                <p class="mt-1 text-sm text-slate-300">
                  Register another repository for chat and explorer context.
                </p>
              </div>

              <form
                aria-label="Add project form"
                onsubmit={handleAddSubmit}
                class="mt-4 space-y-3"
              >
                <input
                  type="text"
                  aria-label="Project name"
                  placeholder="Project name"
                  value={addName}
                  oninput={(e) => { addName = (e.target as HTMLInputElement).value }}
                  disabled={addSubmitting}
                  class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
                />
                <input
                  type="text"
                  aria-label="Project path"
                  role="combobox"
                  aria-expanded={pathSuggestionsOpen}
                  aria-controls={suggestionListId}
                  aria-activedescendant={activeSuggestion ? buildSuggestionId(activeSuggestion.path) : undefined}
                  aria-autocomplete="list"
                  placeholder="/absolute/path/to/project"
                  value={addPath}
                  oninput={(e) => {
                    addPath = (e.target as HTMLInputElement).value
                    pathSuggestionsOpen = true
                  }}
                  onfocus={() => {
                    if (pathSuggestions.length > 0 || pathSuggestionError) {
                      pathSuggestionsOpen = true
                    }
                  }}
                  onkeydown={handlePathKeydown}
                  disabled={addSubmitting}
                  class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
                />
                <p class="text-[11px] leading-5 text-slate-500">
                  Type an absolute path like /home/vries/projects or ~/code. Suggestions appear below when
                  folders match.
                </p>
                {#if breadcrumbSegments.length > 0}
                  <div class="flex flex-wrap gap-1">
                    {#each breadcrumbSegments as segment (segment.path)}
                      <button
                        type="button"
                        onclick={() => applyPath(segment.path)}
                        class="rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-teal-400/30 hover:text-teal-200"
                      >
                        {segment.label}
                      </button>
                    {/each}
                  </div>
                {/if}
                {#if pathQuickActions.length > 0}
                  <div class="grid gap-2 sm:grid-cols-2">
                    {#each pathQuickActions as group (group.label)}
                      <div class="rounded-xl border border-white/8 bg-slate-950/50 p-2">
                        <div class="mb-2 flex items-center justify-between">
                          <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {group.label}
                          </p>
                        </div>
                        <div class="flex flex-wrap gap-1">
                          {#each group.paths as path (`${group.label}-${path}`)}
                            <button
                              type="button"
                              onclick={() => applyPath(path)}
                              class="max-w-full truncate rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-left text-[11px] text-slate-300 transition hover:border-teal-400/30 hover:text-teal-200"
                              title={path}
                            >
                              {compactPathLabel(path)}
                            </button>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
                {#if pathSuggestionsLoading}
                  <p class="text-[11px] text-slate-500">Loading suggestions...</p>
                {/if}
                {#if showSuggestionPanel && !pathInputHasSearchablePrefix}
                  <div class="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-3 text-[11px] leading-5 text-slate-500">
                    Start with / or ~/ to browse folders.
                  </div>
                {/if}
                {#if pathSuggestionsOpen && pathSuggestions.length > 0}
                  <div
                    id={suggestionListId}
                    role="listbox"
                    aria-label="Path suggestions"
                    class="max-h-72 overflow-y-auto rounded-xl border border-teal-500/20 bg-[linear-gradient(180deg,rgba(8,15,24,0.98),rgba(5,10,18,0.98))] p-2 shadow-[0_18px_40px_rgba(2,6,23,0.4)]"
                  >
                    <div class="mb-2 flex items-center justify-between px-1">
                      <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Path suggestions
                      </p>
                      <p class="text-[10px] text-slate-600">Arrow keys · Enter</p>
                    </div>
                    <div class="space-y-1">
                      {#each pathSuggestions as suggestion, index (suggestion.path)}
                        <button
                          id={buildSuggestionId(suggestion.path)}
                          type="button"
                          role="option"
                          aria-selected={index === activeSuggestionIndex}
                          onmousedown={(e) => e.preventDefault()}
                          onmouseenter={() => { activeSuggestionIndex = index }}
                          onclick={() => applySuggestion(suggestion)}
                          class={[
                            'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                            index === activeSuggestionIndex
                              ? 'border-teal-400/40 bg-teal-500/10 text-slate-50 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.08)]'
                              : 'border-transparent bg-slate-900/70 text-slate-200 hover:border-white/8 hover:bg-slate-900',
                          ].join(' ')}
                        >
                          <span class="flex min-w-0 items-center gap-3">
                            <span class="rounded-md border border-teal-500/20 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-200">
                              Dir
                            </span>
                            <span class="truncate">{suggestion.name}</span>
                          </span>
                          <span class="ml-3 truncate text-[11px] text-slate-500">
                            {toTraversableSuggestionPath(suggestion.path)}
                          </span>
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
                {#if pathSuggestionsOpen && pathSuggestionError}
                  <div class="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-[11px] leading-5 text-rose-200">
                    {pathSuggestionError}
                  </div>
                {/if}
                {#if showSuggestionEmptyState}
                  <div class="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-3 text-[11px] leading-5 text-slate-500">
                    No matching folders found for {pathInputValue}.
                  </div>
                {/if}
                {#if addError}
                  <p role="alert" class="text-[11px] text-rose-400">{addError}</p>
                {/if}
                <button
                  type="submit"
                  disabled={addSubmitting}
                  class="w-full rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/20 disabled:opacity-50"
                >
                  {addSubmitting ? 'Adding…' : 'Add project'}
                </button>
              </form>
            {/snippet}
            {@render addProjectFormContent()}
          </section>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if managerOpen && addFormOpen && isCompactViewport}
  <!-- Mobile add project modal -->
  <div class="fixed inset-0 z-[60] bg-slate-950/82 px-3 py-3 backdrop-blur-sm sm:px-6 sm:py-6">
    <div
      data-testid="mobile-add-project-modal"
      class="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0a0f17] shadow-[0_30px_120px_rgba(2,6,23,0.75)]"
    >
      <div class="flex items-start justify-between gap-4 border-b border-white/8 px-4 py-4 sm:px-5">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Add Project
          </p>
          <p class="mt-1 text-sm text-slate-300">
            Use a focused form so the keyboard does not cover the inputs.
          </p>
        </div>
        <button
          type="button"
          onclick={() => { addFormOpen = false }}
          class="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Done
        </button>
      </div>

      <section class="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Add Project
          </p>
          <p class="mt-1 text-sm text-slate-300">
            Register another repository for chat and explorer context.
          </p>
        </div>

        <form
          aria-label="Add project form"
          onsubmit={handleAddSubmit}
          class="mt-4 space-y-3"
        >
          <input
            type="text"
            aria-label="Project name"
            placeholder="Project name"
            value={addName}
            oninput={(e) => { addName = (e.target as HTMLInputElement).value }}
            disabled={addSubmitting}
            class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
          />
          <input
            type="text"
            aria-label="Project path"
            role="combobox"
            aria-expanded={pathSuggestionsOpen}
            aria-controls={suggestionListId}
            aria-activedescendant={activeSuggestion ? buildSuggestionId(activeSuggestion.path) : undefined}
            aria-autocomplete="list"
            placeholder="/absolute/path/to/project"
            value={addPath}
            oninput={(e) => {
              addPath = (e.target as HTMLInputElement).value
              pathSuggestionsOpen = true
            }}
            onfocus={() => {
              if (pathSuggestions.length > 0 || pathSuggestionError) {
                pathSuggestionsOpen = true
              }
            }}
            onkeydown={handlePathKeydown}
            disabled={addSubmitting}
            class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
          />
          <p class="text-[11px] leading-5 text-slate-500">
            Type an absolute path like /home/vries/projects or ~/code. Suggestions appear below when
            folders match.
          </p>
          {#if pathSuggestionsLoading}
            <p class="text-[11px] text-slate-500">Loading suggestions...</p>
          {/if}
          {#if showSuggestionPanel && !pathInputHasSearchablePrefix}
            <div class="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-3 text-[11px] leading-5 text-slate-500">
              Start with / or ~/ to browse folders.
            </div>
          {/if}
          {#if pathSuggestionsOpen && pathSuggestions.length > 0}
            <div
              id="{suggestionListId}-mobile"
              role="listbox"
              aria-label="Path suggestions"
              class="max-h-72 overflow-y-auto rounded-xl border border-teal-500/20 bg-[linear-gradient(180deg,rgba(8,15,24,0.98),rgba(5,10,18,0.98))] p-2 shadow-[0_18px_40px_rgba(2,6,23,0.4)]"
            >
              <div class="space-y-1">
                {#each pathSuggestions as suggestion, index (suggestion.path)}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                    onmousedown={(e) => e.preventDefault()}
                    onmouseenter={() => { activeSuggestionIndex = index }}
                    onclick={() => applySuggestion(suggestion)}
                    class={[
                      'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                      index === activeSuggestionIndex
                        ? 'border-teal-400/40 bg-teal-500/10 text-slate-50'
                        : 'border-transparent bg-slate-900/70 text-slate-200 hover:bg-slate-900',
                    ].join(' ')}
                  >
                    <span class="truncate">{suggestion.name}</span>
                    <span class="ml-3 truncate text-[11px] text-slate-500">
                      {toTraversableSuggestionPath(suggestion.path)}
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
          {#if addError}
            <p role="alert" class="text-[11px] text-rose-400">{addError}</p>
          {/if}
          <button
            type="submit"
            disabled={addSubmitting}
            class="w-full rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/20 disabled:opacity-50"
          >
            {addSubmitting ? 'Adding…' : 'Add project'}
          </button>
        </form>
      </section>
    </div>
  </div>
{/if}

<script lang="ts" module>
  function buildProjectStatusClassName(status: string): string {
    if (status === 'available') {
      return 'rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200'
    }
    return 'rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400'
  }

  function describeProjectStatus(status: string): string {
    if (status === 'available') return status
    return status === 'missing' ? 'path not found' : 'path is invalid'
  }

  function toTraversableSuggestionPath(path: string): string {
    return path === '/' ? path : `${path}/`
  }

  function buildSuggestionId(path: string): string {
    return `project-path-suggestion-${path.replace(/[^a-zA-Z0-9_-]+/g, '-')}`
  }

  function buildBreadcrumbSegments(path: string): Array<{ label: string; path: string }> {
    const trimmed = path.trim()
    if (!trimmed.startsWith('/')) return []
    const normalized = trimmed === '/' ? '/' : trimmed.replace(/\/+$/, '')
    if (normalized === '/') return [{ label: '/', path: '/' }]
    const parts = normalized.split('/').filter(Boolean)
    const segments = [{ label: '/', path: '/' }]
    let current = ''
    for (const part of parts) {
      current = `${current}/${part}`
      segments.push({ label: part, path: current })
    }
    return segments
  }

  function buildPathQuickActions(
    currentPath: string,
    recentPaths: string[]
  ): Array<{ label: string; paths: string[] }> {
    const current = normalizeStoredPath(currentPath)
    const groups = [{ label: 'Recent', paths: recentPaths.filter((path) => path !== current) }]
    return groups.filter((group) => group.paths.length > 0)
  }

  function normalizeStoredPath(path: string): string {
    const trimmed = path.trim()
    if (!looksLikeSuggestionPathInput(trimmed)) return ''
    if (trimmed === '~') return '~'
    return trimmed === '/' ? '/' : trimmed.replace(/\/+$/, '')
  }

  function looksLikeSuggestionPathInput(path: string): boolean {
    return path.startsWith('/') || path === '~' || path.startsWith('~/')
  }

  function readStoredValue(storageKey: string): string {
    if (typeof window === 'undefined' || !window.localStorage) return ''
    return window.localStorage.getItem(storageKey) ?? ''
  }

  function writeStoredValue(storageKey: string, value: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    if (!value) {
      window.localStorage.removeItem(storageKey)
      return
    }
    window.localStorage.setItem(storageKey, value)
  }

  function compactPathLabel(path: string): string {
    if (path === '/' || path === '~') return path
    const trimmed = path.replace(/\/+$/, '')
    const parts = trimmed.split('/').filter(Boolean)
    if (path.startsWith('~/')) {
      const homeParts = path.slice(2).replace(/\/+$/, '').split('/').filter(Boolean)
      if (homeParts.length <= 2) return `~/${homeParts.join('/')}`
      return `~/${homeParts[0]}/.../${homeParts.at(-1)}`
    }
    if (parts.length <= 3) return path
    return `/${parts[0]}/${parts[1]}/.../${parts.at(-1)}`
  }

  function readStoredPaths(storageKey: string): string[] {
    if (typeof window === 'undefined' || !window.localStorage) return []
    try {
      const value = window.localStorage.getItem(storageKey)
      if (!value) return []
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_PATHS)
        : []
    } catch {
      return []
    }
  }

  function writeStoredPaths(storageKey: string, paths: string[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(storageKey, JSON.stringify(paths))
  }
</script>
