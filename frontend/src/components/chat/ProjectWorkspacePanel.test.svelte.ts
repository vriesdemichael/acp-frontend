// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/svelte'
import ProjectWorkspacePanel from './ProjectWorkspacePanel.svelte'
import type { ProjectSummary } from '../../store/chatStore.svelte.js'

const AVAILABLE_PROJECT: ProjectSummary = {
  id: 'repo-1',
  name: 'ACP Frontend',
  path: '/work/acp-frontend',
  status: 'available',
}

const MISSING_PROJECT: ProjectSummary = {
  id: 'repo-2',
  name: 'Missing Project',
  path: '/work/missing',
  status: 'missing',
}

const DEFAULT_PROPS = {
  projects: [AVAILABLE_PROJECT, MISSING_PROJECT] as ProjectSummary[],
  selectedProjectId: AVAILABLE_PROJECT.id as string | null,
  onProjectSelect: vi.fn<(id: string) => void>(),
  tree: [] as unknown[],
  treePath: null as string | null,
  treeLoading: false,
  treeError: null as string | null,
  expandedPaths: [] as string[],
  onToggleFolder: vi.fn<(path: string) => void>(),
  selectedEntryPath: null as string | null,
  onSelectEntry: vi.fn<(path: string | null) => void>(),
}

function renderPanel(
  overrides: Partial<typeof DEFAULT_PROPS> & { showProjectPicker?: boolean } = {}
) {
  return render(ProjectWorkspacePanel, { props: { ...DEFAULT_PROPS, ...overrides } })
}

describe('ProjectWorkspacePanel', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders explorer-only layout without project management controls', () => {
    renderPanel()

    const panel = screen.getByTestId('chat-context-panel')
    expect(within(panel).queryByText('Manage Project Views')).toBeNull()
    expect(within(panel).queryByRole('button', { name: /Open/i })).toBeNull()
    expect(within(panel).getByText('Project Context')).toBeDefined()
    expect(within(panel).getByText('/work/acp-frontend')).toBeDefined()
  })

  it('can hide the project picker in supporting file mode', () => {
    renderPanel({ showProjectPicker: false })

    const panel = screen.getByTestId('chat-context-panel')
    expect(within(panel).queryByRole('combobox', { name: /Active project/i })).toBeNull()
    expect(within(panel).getByText('Current Project')).toBeDefined()
  })

  it('renders selected project summary in full layout', () => {
    renderPanel()

    const panel = screen.getByTestId('chat-context-panel')
    expect(within(panel).getByText('Project Context')).toBeDefined()
    expect(within(panel).getByText('Folder is empty')).toBeDefined()
  })

  it('shows choose-a-project panel when nothing is selected', () => {
    renderPanel({ selectedProjectId: null })

    const panel = screen.getByTestId('chat-context-panel')
    expect(within(panel).getByText('Choose a project')).toBeDefined()
  })

  it('shows project-unavailable panel when selected project is not available', () => {
    renderPanel({ selectedProjectId: MISSING_PROJECT.id })

    expect(screen.getByText('Project unavailable')).toBeDefined()
  })

  it('renders tree entries and toggles folders', () => {
    renderPanel({
      tree: [{ name: 'src', path: 'src', type: 'directory', hasChildren: true }] as unknown[],
    })

    fireEvent.click(screen.getByRole('button', { name: /src/i }))

    expect(DEFAULT_PROPS.onSelectEntry).toHaveBeenCalledWith('src')
    expect(DEFAULT_PROPS.onToggleFolder).toHaveBeenCalledWith('src')
  })

  it('renders tree error state', () => {
    renderPanel({ treeError: 'Explorer unavailable for now.' })

    expect(screen.getByText('Explorer unavailable')).toBeDefined()
    expect(screen.getByText('Explorer unavailable for now.')).toBeDefined()
  })

  it('shows empty panel when no projects are configured', () => {
    renderPanel({ projects: [], selectedProjectId: null })

    const panel = screen.getByTestId('chat-context-panel')
    expect(within(panel).getAllByText('No projects configured').length).toBeGreaterThan(0)
  })
})
