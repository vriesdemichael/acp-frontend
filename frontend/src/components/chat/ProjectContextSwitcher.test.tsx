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
  onProjectSelect: vi.fn<(id: string) => void>(),
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

  it('renders the project selector with all projects', () => {
    renderSwitcher()

    const select = screen.getByRole('combobox', { name: /Active project/i }) as HTMLSelectElement
    const options = Array.from(select.options).filter((o) => o.value !== '')
    expect(options).toHaveLength(2)
    expect(options[0]!.value).toBe('repo-1')
    expect(options[1]!.value).toBe('repo-2')
  })

  it('disables options for unavailable projects', () => {
    renderSwitcher()

    const select = screen.getByRole('combobox', { name: /Active project/i }) as HTMLSelectElement
    const missingOption = Array.from(select.options).find((o) => o.value === 'repo-2')
    expect(missingOption?.disabled).toBe(true)
  })

  it('renders unavailable projects with a human-readable status label', () => {
    renderSwitcher()

    const select = screen.getByRole('combobox', { name: /Active project/i }) as HTMLSelectElement
    const missingOption = Array.from(select.options).find((o) => o.value === 'repo-2')

    expect(missingOption?.textContent).toContain('path not found')
    expect(missingOption?.textContent).not.toContain('missing')
  })

  it('shows selected project name and path', () => {
    renderSwitcher()

    expect(screen.getAllByText('ACP Frontend').length).toBeGreaterThan(0)
    expect(screen.getByText('/work/acp-frontend')).toBeDefined()
  })

  it('shows "Add" button and toggles to add form on click', async () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))

    await waitFor(() =>
      expect(screen.getByRole('form', { name: /Add project form/i })).toBeDefined()
    )
    expect(screen.getByRole('textbox', { name: /Project name/i })).toBeDefined()
    expect(screen.getByRole('combobox', { name: /Project path/i })).toBeDefined()
  })

  it('preserves draft values when toggling the add form', async () => {
    renderSwitcher()

    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /Project name/i }), {
      target: { value: 'Draft Name' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /Project path/i }), {
      target: { value: '/tmp/project-draft' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Cancel adding project/i }))
    fireEvent.click(screen.getByRole('button', { name: /Add project/i }))

    expect((screen.getByRole('textbox', { name: /Project name/i }) as HTMLInputElement).value).toBe(
      'Draft Name'
    )
    expect(
      (screen.getByRole('combobox', { name: /Project path/i }) as HTMLInputElement).value
    ).toBe('/tmp/project-draft')
  })

  it('calls onProjectSelect when the active project changes', () => {
    renderSwitcher()

    fireEvent.change(screen.getByRole('combobox', { name: /Active project/i }), {
      target: { value: 'repo-1' },
    })

    expect(DEFAULT_PROPS.onProjectSelect).toHaveBeenCalledWith('repo-1')
  })
})
