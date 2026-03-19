// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { ProjectWorkspacePanel } from './ProjectWorkspacePanel.js'
import type { ProjectSummary } from '../../hooks/useAgUiChat.js'

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
  onAddProject: vi
    .fn<(name: string, path: string) => Promise<ProjectSummary>>()
    .mockResolvedValue(AVAILABLE_PROJECT),
  tree: [] as [],
  treePath: null as string | null,
  treeLoading: false,
  treeError: null as string | null,
  expandedPaths: [] as string[],
  onToggleFolder: vi.fn<(path: string) => void>(),
  selectedEntryPath: null as string | null,
  onSelectEntry: vi.fn<(path: string | null) => void>(),
}

function renderPanel(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<ProjectWorkspacePanel {...DEFAULT_PROPS} {...overrides} />)
}

describe('ProjectWorkspacePanel', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders the project selector with all projects', () => {
    renderPanel()

    const panel = screen.getByTestId('chat-context-panel')
    const select = panel.querySelector('select[aria-label="Active project"]') as HTMLSelectElement
    expect(select).toBeDefined()

    const options = Array.from(select.options).filter((o) => o.value !== '')
    expect(options).toHaveLength(2)
    expect(options[0]!.value).toBe('repo-1')
    expect(options[1]!.value).toBe('repo-2')
  })

  it('disables options for unavailable projects', () => {
    renderPanel()

    const panel = screen.getByTestId('chat-context-panel')
    const select = panel.querySelector('select[aria-label="Active project"]') as HTMLSelectElement
    const missingOption = Array.from(select.options).find((o) => o.value === 'repo-2')
    expect(missingOption?.disabled).toBe(true)
  })

  it('shows selected project name and path', () => {
    renderPanel()

    const panel = screen.getByTestId('chat-context-panel')
    expect(within(panel).getAllByText('ACP Frontend').length).toBeGreaterThan(0)
    expect(within(panel).getByText('/work/acp-frontend')).toBeDefined()
  })

  it('shows "Add" button and toggles to add form on click', async () => {
    renderPanel()

    const addButton = screen.getByRole('button', { name: /Add project/i })
    expect(addButton).toBeDefined()

    fireEvent.click(addButton)

    await waitFor(() =>
      expect(screen.getByRole('form', { name: /Add project form/i })).toBeDefined()
    )
    expect(screen.getByRole('textbox', { name: /Project name/i })).toBeDefined()
    expect(screen.getByRole('textbox', { name: /Project path/i })).toBeDefined()
  })

  it('shows "Cancel" button when the form is open', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Cancel adding project/i })).toBeDefined()
    )
  })

  it('calls onAddProject with trimmed name and path on valid submit', async () => {
    const onAddProject = vi
      .fn<(name: string, path: string) => Promise<ProjectSummary>>()
      .mockResolvedValue({
        id: 'new-project',
        name: 'New Project',
        path: '/work/new',
        status: 'available',
      })

    renderPanel({ onAddProject })
    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))

    await waitFor(() => screen.getByRole('textbox', { name: /Project name/i }))

    fireEvent.change(screen.getByRole('textbox', { name: /Project name/i }), {
      target: { value: '  New Project  ' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Project path/i }), {
      target: { value: '/work/new' },
    })
    fireEvent.submit(screen.getByRole('form', { name: /Add project form/i }))

    await waitFor(() => expect(onAddProject).toHaveBeenCalledWith('New Project', '/work/new'))
  })

  it('closes the form and resets fields after a successful add', async () => {
    const onAddProject = vi
      .fn<(name: string, path: string) => Promise<ProjectSummary>>()
      .mockResolvedValue({
        id: 'new-project',
        name: 'New Project',
        path: '/work/new',
        status: 'available',
      })

    renderPanel({ onAddProject })
    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))

    await waitFor(() => screen.getByRole('textbox', { name: /Project name/i }))

    fireEvent.change(screen.getByRole('textbox', { name: /Project name/i }), {
      target: { value: 'New Project' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Project path/i }), {
      target: { value: '/work/new' },
    })
    fireEvent.submit(screen.getByRole('form', { name: /Add project form/i }))

    await waitFor(() =>
      expect(screen.queryByRole('form', { name: /Add project form/i })).toBeNull()
    )
    expect(screen.getByRole('combobox', { name: /Active project/i })).toBeDefined()
  })

  it('shows validation error when name is empty', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))

    await waitFor(() => screen.getByRole('form', { name: /Add project form/i }))

    fireEvent.change(screen.getByRole('textbox', { name: /Project path/i }), {
      target: { value: '/work/new' },
    })
    fireEvent.submit(screen.getByRole('form', { name: /Add project form/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(screen.getByText('Name is required.')).toBeDefined()
    expect(DEFAULT_PROPS.onAddProject).not.toHaveBeenCalled()
  })

  it('shows validation error when path is empty', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))

    await waitFor(() => screen.getByRole('form', { name: /Add project form/i }))

    fireEvent.change(screen.getByRole('textbox', { name: /Project name/i }), {
      target: { value: 'New Project' },
    })
    fireEvent.submit(screen.getByRole('form', { name: /Add project form/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(screen.getByText('Path is required.')).toBeDefined()
  })

  it('shows error when onAddProject rejects', async () => {
    const onAddProject = vi
      .fn<(name: string, path: string) => Promise<ProjectSummary>>()
      .mockRejectedValue(new Error('Server error'))

    renderPanel({ onAddProject })
    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))

    await waitFor(() => screen.getByRole('form', { name: /Add project form/i }))

    fireEvent.change(screen.getByRole('textbox', { name: /Project name/i }), {
      target: { value: 'Bad Project' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Project path/i }), {
      target: { value: '/bad/path' },
    })
    fireEvent.submit(screen.getByRole('form', { name: /Add project form/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())
    expect(
      screen.getByText('Failed to add project. Check the name and path and try again.')
    ).toBeDefined()
  })

  it('shows empty panel when no projects are configured', () => {
    renderPanel({ projects: [], selectedProjectId: null })

    const panel = screen.getByTestId('chat-context-panel')
    expect(within(panel).getAllByText('No projects configured').length).toBeGreaterThan(0)
  })

  it('shows choose-a-project panel when nothing is selected', () => {
    renderPanel({ selectedProjectId: null })

    const panel = screen.getByTestId('chat-context-panel')
    expect(within(panel).getAllByText('Choose a project').length).toBeGreaterThan(0)
  })

  it('shows project-unavailable panel when selected project is not available', () => {
    renderPanel({ selectedProjectId: MISSING_PROJECT.id })

    expect(screen.getByText('Project unavailable')).toBeDefined()
  })
})
