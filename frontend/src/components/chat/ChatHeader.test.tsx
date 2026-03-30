// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ChatHeader } from './ChatHeader.js'

const DEFAULT_PROPS = {
  activeAgentName: 'GitHub Copilot',
  project: {
    id: 'acp-frontend',
    name: 'ACP Frontend',
    path: '/home/vries/projects/acp-frontend',
    status: 'available' as const,
  },
  sessionId: 'session-12345678',
  title: 'Investigate auth regression',
  errorMessage: null,
  ready: true,
  thinking: false,
  renderLink: ({ children, className }: { children: ReactNode; className: string }) => (
    <span className={className}>{children}</span>
  ),
}

describe('ChatHeader', () => {
  const originalWidth = window.innerWidth

  beforeEach(() => {
    window.innerWidth = originalWidth
  })

  afterEach(() => {
    window.innerWidth = originalWidth
    window.dispatchEvent(new Event('resize'))
  })

  it('shows a compact mobile header without settings links or extra pills', () => {
    window.innerWidth = 390
    window.dispatchEvent(new Event('resize'))

    render(<ChatHeader {...DEFAULT_PROPS} />)

    expect(screen.getByTestId('chat-header-compact')).toBeDefined()
    expect(screen.queryByText('Backends')).toBeNull()
    expect(screen.queryByText('MCP')).toBeNull()
    expect(screen.queryByText('Session session-1')).toBeNull()
    expect(screen.getByText('Ready')).toBeDefined()
  })

  it('shows the full desktop header with metadata pills and settings links', () => {
    window.innerWidth = 1280
    window.dispatchEvent(new Event('resize'))

    render(<ChatHeader {...DEFAULT_PROPS} />)

    expect(screen.queryByTestId('chat-header-compact')).toBeNull()
    expect(screen.getAllByText('Backends').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MCP').length).toBeGreaterThan(0)
    expect(screen.getByText('Session session-')).toBeDefined()
  })

  it('shows the actual error message in the compact mobile header', () => {
    window.innerWidth = 390
    window.dispatchEvent(new Event('resize'))

    render(
      <ChatHeader
        {...DEFAULT_PROPS}
        errorMessage="Unable to load that session right now. Pick another one or create a new chat."
        ready={false}
      />
    )

    expect(
      screen.queryByText(
        'Unable to load that session right now. Pick another one or create a new chat.'
      )
    ).toBeNull()
    expect(screen.getByText('Warning')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Show chat warning details' }))

    expect(screen.getByRole('dialog', { name: 'Chat warning details' })).toBeDefined()
    expect(
      screen.getByText(
        'Unable to load that session right now. Pick another one or create a new chat.'
      )
    ).toBeDefined()
  })
})
