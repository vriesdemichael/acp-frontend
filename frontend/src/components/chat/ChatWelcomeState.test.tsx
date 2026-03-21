// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a href={typeof props.to === 'string' ? props.to : '#'} {...props}>
      {children}
    </a>
  ),
}))

import { ChatWelcomeState } from './ChatWelcomeState.js'

function renderWelcomeState(props: Partial<React.ComponentProps<typeof ChatWelcomeState>> = {}) {
  return render(
    <ChatWelcomeState
      activeAgentName="GitHub Copilot"
      canStartSession
      hasAnyProject
      hasAvailableAgent
      hasAvailableProject
      onStartSession={vi.fn()}
      onOpenProjectManager={vi.fn()}
      {...props}
    />
  )
}

describe('ChatWelcomeState', () => {
  it('renders the ready-to-start onboarding state', () => {
    renderWelcomeState()

    expect(screen.getByText('Open a fresh chat in this project')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Start a session' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Open project manager' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Open settings' })).toBeDefined()
  })

  it('renders the project setup state when no projects exist', () => {
    renderWelcomeState({
      canStartSession: false,
      hasAnyProject: false,
      hasAvailableProject: false,
    })

    expect(screen.getByText('Bring a project into the workspace')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Start a session' })).toBeNull()
  })

  it('renders the agent setup state when no agent is available', () => {
    renderWelcomeState({
      canStartSession: false,
      hasAvailableAgent: false,
    })

    expect(screen.getByText('Connect an agent to begin')).toBeDefined()
  })

  it('fires the start callback when the CTA is pressed', () => {
    const onStartSession = vi.fn()
    renderWelcomeState({ onStartSession })

    fireEvent.click(screen.getByRole('button', { name: 'Start a session' }))
    expect(onStartSession).toHaveBeenCalledTimes(1)
  })
})
