import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProjectSummary } from '../../hooks/useAgUiChat.js'

const RECENT_PATHS_STORAGE_KEY = 'acp.project-paths.recent'
const FAVORITE_PATHS_STORAGE_KEY = 'acp.project-paths.favorites'
const DRAFT_PATH_STORAGE_KEY = 'acp.project-paths.draft-path'
const DRAFT_NAME_STORAGE_KEY = 'acp.project-paths.draft-name'
const MAX_RECENT_PATHS = 6

export interface ProjectPathSuggestion {
  name: string
  path: string
}

interface ProjectContextSwitcherProps {
  projects: ProjectSummary[]
  selectedProjectId: string | null
  visibleProjectIds: string[]
  onProjectSelect: (projectId: string) => void | Promise<void>
  onProjectVisibilityChange: (projectId: string, visible: boolean) => void
  onAddProject: (name: string, path: string) => Promise<ProjectSummary>
  onRemoveProject: (projectId: string) => Promise<void>
  onSuggestProjectPaths: (path: string) => Promise<ProjectPathSuggestion[]>
}

export function ProjectContextSwitcher({
  projects,
  selectedProjectId,
  visibleProjectIds,
  onProjectSelect,
  onProjectVisibilityChange,
  onAddProject,
  onRemoveProject,
  onSuggestProjectPaths,
}: ProjectContextSwitcherProps) {
  const [managerOpen, setManagerOpen] = useState(false)
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [addName, setAddName] = useState(() => readStoredValue(DRAFT_NAME_STORAGE_KEY))
  const [addPath, setAddPath] = useState(() => readStoredValue(DRAFT_PATH_STORAGE_KEY))
  const [addError, setAddError] = useState<string | null>(null)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [removingProjectId, setRemovingProjectId] = useState<string | null>(null)
  const [pathSuggestions, setPathSuggestions] = useState<ProjectPathSuggestion[]>([])
  const [pathSuggestionsLoading, setPathSuggestionsLoading] = useState(false)
  const [pathSuggestionsOpen, setPathSuggestionsOpen] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [pathSuggestionError, setPathSuggestionError] = useState<string | null>(null)
  const [recentPaths, setRecentPaths] = useState<string[]>(() =>
    readStoredPaths(RECENT_PATHS_STORAGE_KEY)
  )
  const [favoritePaths, setFavoritePaths] = useState<string[]>(() =>
    readStoredPaths(FAVORITE_PATHS_STORAGE_KEY)
  )
  const suggestionListId = 'project-path-suggestions'
  const visibleProjectSet = useMemo(() => new Set(visibleProjectIds), [visibleProjectIds])
  const visibleProjectCount = visibleProjectIds.length
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const activeSuggestion =
    activeSuggestionIndex >= 0 ? (pathSuggestions[activeSuggestionIndex] ?? null) : null
  const breadcrumbSegments = useMemo(() => buildBreadcrumbSegments(addPath), [addPath])
  const pathQuickActions = useMemo(
    () => buildPathQuickActions(addPath, recentPaths, favoritePaths),
    [addPath, recentPaths, favoritePaths]
  )
  const normalizedCurrentPath = normalizeStoredPath(addPath)
  const pathInputValue = addPath.trim()
  const pathInputHasSearchablePrefix = looksLikeSuggestionPathInput(pathInputValue)
  const showSuggestionPanel = addFormOpen && pathInputValue.length > 0
  const showSuggestionEmptyState =
    showSuggestionPanel &&
    !pathSuggestionsLoading &&
    !pathSuggestionError &&
    pathSuggestions.length === 0 &&
    pathInputHasSearchablePrefix

  const applySuggestion = (suggestion: ProjectPathSuggestion) => {
    setAddPath(toTraversableSuggestionPath(suggestion.path))
    setPathSuggestionsOpen(true)
    setActiveSuggestionIndex(-1)
  }

  const applyPath = (path: string) => {
    setAddPath(toTraversableSuggestionPath(path))
    setPathSuggestionsOpen(true)
    setActiveSuggestionIndex(-1)
  }

  const toggleFavoritePath = (path: string) => {
    const normalizedPath = normalizeStoredPath(path)
    if (!normalizedPath) {
      return
    }

    setFavoritePaths((current) => {
      const next = current.includes(normalizedPath)
        ? current.filter((item) => item !== normalizedPath)
        : [normalizedPath, ...current].slice(0, MAX_RECENT_PATHS)
      writeStoredPaths(FAVORITE_PATHS_STORAGE_KEY, next)
      return next
    })
  }

  useEffect(() => {
    writeStoredValue(DRAFT_NAME_STORAGE_KEY, addName)
  }, [addName])

  useEffect(() => {
    writeStoredValue(DRAFT_PATH_STORAGE_KEY, addPath)
  }, [addPath])

  useEffect(() => {
    if (!addFormOpen) {
      setPathSuggestions([])
      setPathSuggestionsLoading(false)
      setPathSuggestionsOpen(false)
      setActiveSuggestionIndex(-1)
      setPathSuggestionError(null)
      return
    }

    const trimmedPath = addPath.trim()
    if (!trimmedPath || !looksLikeSuggestionPathInput(trimmedPath)) {
      setPathSuggestions([])
      setPathSuggestionsLoading(false)
      setPathSuggestionsOpen(false)
      setActiveSuggestionIndex(-1)
      setPathSuggestionError(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setPathSuggestionsLoading(true)
      setPathSuggestionError(null)

      void onSuggestProjectPaths(trimmedPath)
        .then((nextSuggestions) => {
          if (cancelled) {
            return
          }

          setPathSuggestions(nextSuggestions)
          setPathSuggestionsOpen(true)
          setActiveSuggestionIndex(nextSuggestions.length > 0 ? 0 : -1)
        })
        .catch(() => {
          if (cancelled) {
            return
          }

          setPathSuggestions([])
          setPathSuggestionsOpen(true)
          setActiveSuggestionIndex(-1)
          setPathSuggestionError('Unable to load folder suggestions right now.')
        })
        .finally(() => {
          if (!cancelled) {
            setPathSuggestionsLoading(false)
          }
        })
    }, 140)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [addFormOpen, addPath, onSuggestProjectPaths])

  useEffect(() => {
    if (activeSuggestionIndex >= pathSuggestions.length) {
      setActiveSuggestionIndex(pathSuggestions.length > 0 ? 0 : -1)
    }
  }, [activeSuggestionIndex, pathSuggestions])

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedPath = addPath.trim()

    if (!trimmedPath) {
      setAddError('Path is required.')
      return
    }

    const effectiveName =
      addName.trim() || (trimmedPath.split('/').filter(Boolean).pop() ?? trimmedPath)

    setAddError(null)
    setAddSubmitting(true)

    try {
      const newProject = await onAddProject(effectiveName, trimmedPath)
      const normalizedStoredPath = normalizeStoredPath(trimmedPath)
      if (normalizedStoredPath) {
        setRecentPaths((current) => {
          const next = [
            normalizedStoredPath,
            ...current.filter((item) => item !== normalizedStoredPath),
          ].slice(0, MAX_RECENT_PATHS)
          writeStoredPaths(RECENT_PATHS_STORAGE_KEY, next)
          return next
        })
      }

      setAddName('')
      setAddPath('')
      setAddFormOpen(false)
      setPathSuggestions([])
      setPathSuggestionsOpen(false)
      setActiveSuggestionIndex(-1)
      onProjectVisibilityChange(newProject.id, true)
      await onProjectSelect(newProject.id)
    } catch {
      setAddError('Failed to add project. Check the name and path and try again.')
    } finally {
      setAddSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setManagerOpen(true)}
        className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-left transition hover:border-white/15 hover:bg-slate-900"
      >
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Projects
          </span>
          <span className="mt-1 block text-sm font-semibold text-slate-50">
            {selectedProject?.name ?? 'Manage projects'}
          </span>
          <span className="mt-1 block text-[11px] text-slate-400">
            {visibleProjectCount} visible in chats
          </span>
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          Open
        </span>
      </button>

      {managerOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm sm:px-6 lg:px-10">
              <div className="flex h-full max-h-[min(88vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f17] shadow-[0_30px_120px_rgba(2,6,23,0.65)]">
                <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Projects
                    </p>
                    <h2 className="mt-2 font-[family:var(--font-display)] text-2xl text-slate-50">
                      Manage Project Views
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Show or hide projects in the chat rail, choose the current workspace, and add
                      new repositories.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManagerOpen(false)}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
                  <section className="min-h-0 overflow-y-auto border-b border-white/8 px-5 py-4 lg:border-b-0 lg:border-r">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Session Rail
                        </p>
                        <p className="mt-1 text-sm text-slate-300">
                          Choose which projects appear in chats.
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {visibleProjectCount}/{projects.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {projects.map((project) => {
                        const visible = visibleProjectSet.has(project.id)
                        const current = project.id === selectedProjectId
                        const selectable = project.status === 'available'

                        return (
                          <div
                            key={project.id}
                            className="rounded-xl border border-white/8 bg-slate-900/55 px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-slate-50">
                                    {project.name}
                                  </p>
                                  {current ? (
                                    <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200">
                                      Current
                                    </span>
                                  ) : null}
                                  <span className={buildProjectStatusClassName(project.status)}>
                                    {describeProjectStatus(project.status)}
                                  </span>
                                </div>
                                <p className="mt-2 break-all text-[11px] leading-5 text-slate-400">
                                  {project.path}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onProjectVisibilityChange(project.id, !visible)}
                                className={[
                                  'shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]',
                                  visible
                                    ? 'border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-900'
                                    : 'border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15',
                                ].join(' ')}
                              >
                                {visible ? 'Shown' : 'Hidden'}
                              </button>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3">
                              <p className="text-[11px] text-slate-500">
                                {visible
                                  ? 'Visible in the session viewer.'
                                  : 'Hidden from the session viewer.'}
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemovingProjectId(project.id)
                                    void onRemoveProject(project.id).finally(() => {
                                      setRemovingProjectId((currentId) =>
                                        currentId === project.id ? null : currentId
                                      )
                                    })
                                  }}
                                  disabled={removingProjectId === project.id}
                                  className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {removingProjectId === project.id ? 'Removing' : 'Remove'}
                                </button>
                                <button
                                  type="button"
                                  disabled={!selectable || current}
                                  onClick={() => void onProjectSelect(project.id)}
                                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:text-slate-500"
                                >
                                  {current ? 'Selected' : 'Use'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section className="min-h-0 overflow-y-auto px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Add Project
                        </p>
                        <p className="mt-1 text-sm text-slate-300">
                          Register another repository for chat and explorer context.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAddFormOpen((current) => !current)
                          setAddError(null)
                        }}
                        className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 hover:bg-slate-800"
                      >
                        {addFormOpen ? 'Hide Form' : 'Add New'}
                      </button>
                    </div>

                    {addFormOpen ? (
                      <form
                        aria-label="Add project form"
                        onSubmit={(e) => void handleAddSubmit(e)}
                        className="mt-4 space-y-3"
                      >
                        <input
                          type="text"
                          aria-label="Project name"
                          placeholder="Project name"
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                          disabled={addSubmitting}
                          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
                        />
                        <input
                          type="text"
                          aria-label="Project path"
                          role="combobox"
                          aria-expanded={pathSuggestionsOpen}
                          aria-controls={suggestionListId}
                          aria-activedescendant={
                            activeSuggestion ? buildSuggestionId(activeSuggestion.path) : undefined
                          }
                          aria-autocomplete="list"
                          placeholder="/absolute/path/to/project"
                          value={addPath}
                          onChange={(e) => {
                            setAddPath(e.target.value)
                            setPathSuggestionsOpen(true)
                          }}
                          onFocus={() => {
                            if (pathSuggestions.length > 0 || pathSuggestionError) {
                              setPathSuggestionsOpen(true)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setPathSuggestionsOpen(false)
                              setActiveSuggestionIndex(-1)
                              return
                            }

                            if (pathSuggestions.length === 0) {
                              return
                            }

                            if (e.key === 'ArrowDown') {
                              e.preventDefault()
                              setPathSuggestionsOpen(true)
                              setActiveSuggestionIndex((current) =>
                                current < pathSuggestions.length - 1 ? current + 1 : 0
                              )
                              return
                            }

                            if (e.key === 'ArrowUp') {
                              e.preventDefault()
                              setPathSuggestionsOpen(true)
                              setActiveSuggestionIndex((current) =>
                                current > 0 ? current - 1 : pathSuggestions.length - 1
                              )
                              return
                            }

                            if (e.key === 'Enter' && pathSuggestionsOpen && activeSuggestion) {
                              e.preventDefault()
                              applySuggestion(activeSuggestion)
                            }
                          }}
                          disabled={addSubmitting}
                          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
                        />
                        <p className="text-[11px] leading-5 text-slate-500">
                          Type an absolute path like /home/vries/projects or ~/code. Suggestions
                          appear below when folders match.
                        </p>
                        {breadcrumbSegments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {breadcrumbSegments.map((segment) => (
                              <button
                                key={segment.path}
                                type="button"
                                onClick={() => applyPath(segment.path)}
                                className="rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-teal-400/30 hover:text-teal-200"
                              >
                                {segment.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {normalizedCurrentPath ? (
                          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-slate-950/50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Current path
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-300">
                                {normalizedCurrentPath}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleFavoritePath(addPath)}
                              className="ml-3 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200 hover:bg-amber-500/15"
                            >
                              {favoritePaths.includes(normalizedCurrentPath) ? 'Saved' : 'Save'}
                            </button>
                          </div>
                        ) : null}
                        {pathQuickActions.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {pathQuickActions.map((group) => (
                              <div
                                key={group.label}
                                className="rounded-xl border border-white/8 bg-slate-950/50 p-2"
                              >
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {group.label}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {group.paths.map((path) => (
                                    <button
                                      key={`${group.label}-${path}`}
                                      type="button"
                                      onClick={() => applyPath(path)}
                                      className="max-w-full truncate rounded-lg border border-white/10 bg-slate-900/80 px-2.5 py-1.5 text-left text-[11px] text-slate-300 transition hover:border-teal-400/30 hover:text-teal-200"
                                      title={path}
                                    >
                                      {compactPathLabel(path)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {pathSuggestionsLoading ? (
                          <p className="text-[11px] text-slate-500">Loading suggestions...</p>
                        ) : null}
                        {showSuggestionPanel && !pathInputHasSearchablePrefix ? (
                          <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-3 text-[11px] leading-5 text-slate-500">
                            Start with / or ~/ to browse folders.
                          </div>
                        ) : null}
                        {pathSuggestionsOpen && pathSuggestions.length > 0 ? (
                          <div
                            id={suggestionListId}
                            role="listbox"
                            aria-label="Path suggestions"
                            className="rounded-xl border border-teal-500/20 bg-[linear-gradient(180deg,rgba(8,15,24,0.98),rgba(5,10,18,0.98))] p-2 shadow-[0_18px_40px_rgba(2,6,23,0.4)]"
                          >
                            <div className="mb-2 flex items-center justify-between px-1">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Path suggestions
                              </p>
                              <p className="text-[10px] text-slate-600">Arrow keys · Enter</p>
                            </div>
                            <div className="space-y-1">
                              {pathSuggestions.map((suggestion, index) => (
                                <button
                                  key={suggestion.path}
                                  id={buildSuggestionId(suggestion.path)}
                                  type="button"
                                  role="option"
                                  aria-selected={index === activeSuggestionIndex}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onMouseEnter={() => setActiveSuggestionIndex(index)}
                                  onClick={() => applySuggestion(suggestion)}
                                  className={[
                                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                                    index === activeSuggestionIndex
                                      ? 'border-teal-400/40 bg-teal-500/10 text-slate-50 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.08)]'
                                      : 'border-transparent bg-slate-900/70 text-slate-200 hover:border-white/8 hover:bg-slate-900',
                                  ].join(' ')}
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <span className="rounded-md border border-teal-500/20 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-200">
                                      Dir
                                    </span>
                                    <span className="truncate">{suggestion.name}</span>
                                  </span>
                                  <span className="ml-3 truncate text-[11px] text-slate-500">
                                    {toTraversableSuggestionPath(suggestion.path)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {pathSuggestionsOpen && pathSuggestionError ? (
                          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-[11px] leading-5 text-rose-200">
                            {pathSuggestionError}
                          </div>
                        ) : null}
                        {showSuggestionEmptyState ? (
                          <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-3 text-[11px] leading-5 text-slate-500">
                            No matching folders found for {pathInputValue}.
                          </div>
                        ) : null}
                        {addError ? (
                          <p role="alert" className="text-[11px] text-rose-400">
                            {addError}
                          </p>
                        ) : null}
                        <button
                          type="submit"
                          disabled={addSubmitting}
                          className="w-full rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/20 disabled:opacity-50"
                        >
                          {addSubmitting ? 'Adding…' : 'Add project'}
                        </button>
                      </form>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-400">
                        Open the add form to register another project path.
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function buildProjectStatusClassName(status: ProjectSummary['status']): string {
  if (status === 'available') {
    return 'rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200'
  }

  return 'rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400'
}

function describeProjectStatus(status: ProjectSummary['status']): string {
  if (status === 'available') {
    return status
  }

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
  if (!trimmed.startsWith('/')) {
    return []
  }

  const normalized = trimmed === '/' ? '/' : trimmed.replace(/\/+$/, '')
  if (normalized === '/') {
    return [{ label: '/', path: '/' }]
  }

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
  recentPaths: string[],
  favoritePaths: string[]
): Array<{ label: string; paths: string[] }> {
  const current = normalizeStoredPath(currentPath)
  const groups = [
    { label: 'Favorites', paths: favoritePaths.filter((path) => path !== current) },
    { label: 'Recent', paths: recentPaths.filter((path) => path !== current) },
  ]

  return groups.filter((group) => group.paths.length > 0)
}

function normalizeStoredPath(path: string): string {
  const trimmed = path.trim()
  if (!looksLikeSuggestionPathInput(trimmed)) {
    return ''
  }

  if (trimmed === '~') {
    return '~'
  }

  return trimmed === '/' ? '/' : trimmed.replace(/\/+$/, '')
}

function looksLikeSuggestionPathInput(path: string): boolean {
  return path.startsWith('/') || path === '~' || path.startsWith('~/')
}

function readStoredValue(storageKey: string): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return ''
  }

  return window.localStorage.getItem(storageKey) ?? ''
}

function writeStoredValue(storageKey: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  if (!value) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, value)
}

function compactPathLabel(path: string): string {
  if (path === '/' || path === '~') {
    return path
  }

  const trimmed = path.replace(/\/+$/, '')
  const parts = trimmed.split('/').filter(Boolean)
  if (path.startsWith('~/')) {
    const homeParts = path.slice(2).replace(/\/+$/, '').split('/').filter(Boolean)
    if (homeParts.length <= 2) {
      return `~/${homeParts.join('/')}`
    }

    return `~/${homeParts[0]}/.../${homeParts.at(-1)}`
  }

  if (parts.length <= 3) {
    return path
  }

  return `/${parts[0]}/${parts[1]}/.../${parts.at(-1)}`
}

function readStoredPaths(storageKey: string): string[] {
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
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_PATHS)
      : []
  } catch {
    return []
  }
}

function writeStoredPaths(storageKey: string, paths: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(paths))
}
