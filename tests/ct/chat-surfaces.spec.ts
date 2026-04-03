import { test, expect } from '@playwright/experimental-ct-svelte'
import ChatHeader from '../../frontend/src/components/chat/ChatHeader.svelte'
import ChatTranscript from '../../frontend/src/components/chat/ChatTranscript.svelte'
import SessionList from '../../frontend/src/components/chat/SessionList.svelte'
import ChatComposer from '../../frontend/src/components/chat/ChatComposer.svelte'

test.describe('chat surfaces', () => {
  test('renders header status info', async ({ mount }) => {
    const component = await mount(ChatHeader, {
      props: {
        project: {
          id: 'acp-frontend',
          name: 'ACP Frontend',
          path: '/home/runner/work/acp-frontend/acp-frontend',
          status: 'available',
        },
        sessionId: 'session-1',
        errorMessage: null,
        ready: true,
        thinking: false,
      },
    })

    await expect(component.getByText('Ready')).toBeVisible()
    await expect(component.getByText('ACP Frontend', { exact: true })).toBeVisible()
  })

  test('renders transcript on mobile viewport', async ({ mount }) => {
    const component = await mount(ChatTranscript, {
      props: {
        activeAgentName: 'GitHub Copilot',
        messages: [
          { id: 'user-1', role: 'user', content: 'Please inspect the layout.' },
          { id: 'assistant-1', role: 'assistant', content: 'The spacing looks balanced now.' },
        ],
        hasSession: true,
        loading: false,
        ready: true,
        thinking: true,
        errorMessage: null,
      },
    })

    await expect(component.getByText('Thinking…')).toBeVisible()
    await expect(component.getByText('The spacing looks balanced now.')).toBeVisible()
  })

  test('renders dense sessions and composer', async ({ mount }) => {
    const sessionComponent = await mount(SessionList, {
      props: {
        agents: [{ id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' }],
        sessions: Array.from({ length: 6 }, (_, index) => ({
          id: `session-${index + 1}`,
          title: `Conversation ${index + 1}`,
          updatedAt: `2026-03-1${index + 1}T08:00:00.000Z`,
          agentId: 'copilot',
          source: 'live' as const,
          project: {
            id: 'acp-frontend',
            name: 'ACP Frontend',
            path: '/home/runner/work/acp-frontend/acp-frontend',
          },
        })),
        activeSessionId: 'session-1',
        creatingSession: false,
        onCreate: () => {},
        onSelect: () => {},
      },
    })

    const composerComponent = await mount(ChatComposer, {
      props: {
        value: 'Ship the Playwright setup',
        onChange: () => {},
        onSubmit: () => {},
        disabled: false,
        canSubmit: true,
        resumableAgents: [],
      },
    })

    await expect(sessionComponent.getByRole('button', { name: 'New chat' })).toBeVisible()
    await expect(composerComponent.getByRole('button', { name: 'Send' })).toBeEnabled()
  })
})
