// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ProjectContextSwitcher } from './ProjectContextSwitcher.js'
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
  visibleProjectIds: [AVAILABLE_PROJECT.id] as string[],
  onProjectSelect: vi.fn<(id: string) => void>(),
  onProjectVisibilityChange: vi.fn<(id: string, visible: boolean) => void>(),
  onRemoveProject: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(),
  onAddProject: vi
    .fn<(name: string, path: string) => Promise<ProjectSummary>>()
    .mockResolvedValue(AVAILABLE_PROJECT),
  onSuggestProjectPaths: vi
    .fn<(path: string) => Promise<Array<{ name: string; path: string }>>>()
    .mockResolvedValue([]),
}

function renderSwitcher(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<ProjectContextSwitcher {...DEFAULT_PROPS} {...overrides} />)
}

describe('ProjectContextSwitcher', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a button with current project summary', () => {
    renderSwitcher()

    expect(screen.getByRole('button', { name: /Open/i })).toBeDefined()
    expect(screen.getByText('ACP Frontend')).toBeDefined()
    expect(screen.getByText('1 visible in chats')).toBeDefined()
  })

  it('opens a project manager view with visibility controls', async () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /Open/i }))

    expect(await screen.findByText('Manage Project Views')).toBeDefined()
    expect(screen.getAllByText('ACP Frontend').length).toBeGreaterThan(0)
    expect(screen.getByText('Missing Project')).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Shown' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Hidden' })).toBeDefined()
  })

  it('toggles project visibility from the manager view', async () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /Open/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hidden' }))

    expect(DEFAULT_PROPS.onProjectVisibilityChange).toHaveBeenCalledWith('repo-2', true)
  })

  it('selects a project from the manager view', async () => {
    renderSwitcher({
      selectedProjectId: null,
      projects: [
        AVAILABLE_PROJECT,
        {
          id: 'repo-3',
          name: 'Docs Site',
          path: '/work/docs',
          status: 'available',
        },
      ],
      visibleProjectIds: [AVAILABLE_PROJECT.id, 'repo-3'],
    })

    fireEvent.click(screen.getByRole('button', { name: /Open/i }))
    fireEvent.click((await screen.findAllByRole('button', { name: /^Use$/ }))[0]!)

    expect(DEFAULT_PROPS.onProjectSelect).toHaveBeenCalledWith('repo-1')
  })

  it('shows "Add New" button and toggles to add form on click', async () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /Open/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Add New/i }))

    await waitFor(() =>
      expect(screen.getByRole('form', { name: /Add project form/i })).toBeDefined()
    )
    expect(screen.getByRole('textbox', { name: /Project name/i })).toBeDefined()
    expect(screen.getByRole('combobox', { name: /Project path/i })).toBeDefined()
  })

  it('preserves draft values when toggling the add form', async () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /Open/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Add New/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /Project name/i }), {
      target: { value: 'Draft Name' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /Project path/i }), {
      target: { value: '/tmp/project-draft' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Hide Form/i }))
    fireEvent.click(screen.getByRole('button', { name: /Add New/i }))

    expect((screen.getByRole('textbox', { name: /Project name/i }) as HTMLInputElement).value).toBe(
      'Draft Name'
    )
    expect(
      (screen.getByRole('combobox', { name: /Project path/i }) as HTMLInputElement).value
    ).toBe('/tmp/project-draft')
  })

  it('closes the manager view', async () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /Open/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Close/i }))

    await waitFor(() => expect(screen.queryByText('Manage Project Views')).toBeNull())
  })

  it('removes a project from the manager view', async () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /Open/i }))
    fireEvent.click((await screen.findAllByRole('button', { name: 'Remove' }))[0]!)

    expect(DEFAULT_PROPS.onRemoveProject).toHaveBeenCalledWith('repo-1')
  })
})
