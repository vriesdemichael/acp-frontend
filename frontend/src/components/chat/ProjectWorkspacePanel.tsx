import { useMemo, useState } from 'react'
import type { ProjectSummary } from '../../hooks/useAgUiChat.js'
export interface ProjectTreeEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  hasChildren: boolean
}

interface ProjectWorkspacePanelProps {
  projects: ProjectSummary[]
  selectedProjectId: string | null
  onProjectSelect: (projectId: string) => void | Promise<void>
  tree: ProjectTreeEntry[]
  treePath: string | null
  treeLoading: boolean
  treeError: string | null
  expandedPaths: string[]
  onToggleFolder: (path: string) => void | Promise<void>
  selectedEntryPath: string | null
  onSelectEntry: (path: string | null) => void
  layout?: 'full' | 'explorer'
  variant?: 'sidebar' | 'embedded'
}

export function ProjectWorkspacePanel({
  projects,
  selectedProjectId,
  onProjectSelect,
  tree,
  treePath,
  treeLoading,
  treeError,
  expandedPaths,
  onToggleFolder,
  selectedEntryPath,
  onSelectEntry,
  layout = 'full',
  variant = 'sidebar',
}: ProjectWorkspacePanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const panelId = 'project-workspace-panel'
  void onProjectSelect
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const expanded = new Set(expandedPaths)

  const panelContent = (
    <div
      id={panelId}
      data-testid="chat-context-panel"
      className={[
        'min-h-0 overflow-hidden flex-col text-slate-100',
        variant === 'sidebar'
          ? 'border-l border-white/8 bg-slate-950/82 p-4 shadow-[inset_1px_0_0_rgba(148,163,184,0.08)] backdrop-blur'
          : 'flex h-full rounded-2xl border border-white/10 bg-slate-950/70 p-4',
      ].join(' ')}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        Workspace
      </p>
      <h2 className="mt-2 font-[family:var(--font-display)] text-2xl leading-tight text-slate-50">
        {layout === 'explorer' ? 'Project Explorer' : 'Project Context'}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        {layout === 'explorer'
          ? 'Browse the selected repository with a read-only folder tree.'
          : 'Pick the repository the agent should work in, then browse a read-only folder tree.'}
      </p>

      {layout === 'full' ? null : selectedProject ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/80 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Active Project
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-slate-50">
                {selectedProject.name}
              </p>
            </div>
            <span className={buildProjectStatusClassName(selectedProject.status)}>
              {selectedProject.status}
            </span>
          </div>
          <p className="mt-2 break-all text-[11px] leading-5 text-slate-400">
            {selectedProject.path}
          </p>
        </div>
      ) : null}

      <section className="mt-4 flex min-h-0 flex-1 flex-col rounded-xl border border-white/10 bg-slate-900/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Explorer
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {treePath ? `Inside ${treePath}` : 'Root tree'}
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            {treeLoading ? 'Loading...' : `${tree.length} items`}
          </div>
        </div>

        {projects.length === 0 ? (
          <EmptyPanel
            title="No projects configured"
            description="The backend will create a starter config automatically, then use the current repo as the default workspace."
          />
        ) : !selectedProjectId ? (
          <EmptyPanel
            title="Choose a project"
            description="The chat session and folder explorer stay scoped to the selected repository."
          />
        ) : selectedProject?.status !== 'available' ? (
          <EmptyPanel
            title="Project unavailable"
            description="This entry is configured, but its path is missing or invalid on disk right now."
          />
        ) : treeError ? (
          <EmptyPanel title="Explorer unavailable" description={treeError} tone="error" />
        ) : tree.length === 0 && !treeLoading ? (
          <EmptyPanel
            title="Folder is empty"
            description="This location has no visible files yet."
          />
        ) : (
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-1">
              {tree.map((entry) => {
                const isDirectory = entry.type === 'directory'
                const isExpanded = expanded.has(entry.path)
                const isSelected = selectedEntryPath === entry.path

                return (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => {
                      onSelectEntry(entry.path)
                      if (isDirectory) {
                        void onToggleFolder(entry.path)
                      }
                    }}
                    className={[
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition',
                      isSelected
                        ? 'border-teal-500/40 bg-teal-500/10 text-slate-50'
                        : 'border-transparent bg-transparent text-slate-300 hover:border-white/8 hover:bg-slate-950/70',
                    ].join(' ')}
                  >
                    <span className="w-4 text-center text-xs text-slate-500">
                      {isDirectory ? (isExpanded ? '-' : '+') : '·'}
                    </span>
                    <span className="text-sm">{isDirectory ? 'DIR' : 'FILE'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{entry.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )

  if (variant === 'embedded') {
    return panelContent
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((current) => !current)}
        aria-expanded={mobileOpen}
        aria-controls={panelId}
        className="mx-4 mt-3 inline-flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-left text-slate-100 shadow-[0_18px_40px_rgba(2,6,23,0.32)] xl:hidden"
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Workspace
          </span>
          <span className="mt-1 block text-sm font-medium text-slate-50">
            {selectedProject?.name ?? 'Choose a project'}
          </span>
        </span>
        <span className="text-xs text-slate-400">{mobileOpen ? 'Hide' : 'Show'}</span>
      </button>

      <aside
        className={[
          mobileOpen ? 'flex' : 'hidden',
          'min-h-0 overflow-hidden flex-col xl:flex',
        ].join(' ')}
      >
        {panelContent}
      </aside>
    </>
  )
}

function buildProjectStatusClassName(status: ProjectSummary['status']): string {
  if (status === 'available') {
    return 'rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200'
  }

  return 'rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400'
}

interface EmptyPanelProps {
  title: string
  description: string
  tone?: 'default' | 'error'
}

function EmptyPanel({ title, description, tone = 'default' }: EmptyPanelProps) {
  return (
    <div
      className={[
        'mt-4 rounded-xl border px-4 py-5 text-sm',
        tone === 'error'
          ? 'border-rose-500/20 bg-rose-500/10 text-rose-100'
          : 'border-dashed border-white/10 bg-slate-950/60 text-slate-400',
      ].join(' ')}
    >
      <p className="font-medium text-slate-50">{title}</p>
      <p className="mt-2 leading-6">{description}</p>
    </div>
  )
}
