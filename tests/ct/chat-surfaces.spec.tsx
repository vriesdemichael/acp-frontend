import { test, expect } from '@playwright/experimental-ct-react'
import { ChatHeader } from '../../frontend/src/components/chat/ChatHeader.js'
import { ChatTranscript } from '../../frontend/src/components/chat/ChatTranscript.js'
import { SessionList } from '../../frontend/src/components/chat/SessionList.js'
import { ChatComposer } from '../../frontend/src/components/chat/ChatComposer.js'

test.describe('chat surfaces', () => {
  test('renders header status info', async ({ mount }) => {
    const component = await mount(
      <div className="p-6">
        <ChatHeader
          renderLink={({ className, children }) => <span className={className}>{children}</span>}
          project={{
            id: 'acp-frontend',
            name: 'ACP Frontend',
            path: '/home/runner/work/acp-frontend/acp-frontend',
            status: 'available',
          }}
          sessionId="session-1"
          errorMessage={null}
          ready
          thinking={false}
        />
      </div>
    )

    await expect(component.getByText('Ready')).toBeVisible()
    await expect(component.getByText('ACP Frontend')).toBeVisible()
  })

  test('renders transcript on mobile viewport', async ({ mount }) => {
    const component = await mount(
      <div className="p-4">
        <ChatTranscript
          activeAgentName="GitHub Copilot"
          messages={[
            { id: 'user-1', role: 'user', content: 'Please inspect the layout.' },
            { id: 'assistant-1', role: 'assistant', content: 'The spacing looks balanced now.' },
          ]}
          loading={false}
          ready
          thinking
          errorMessage={null}
        />
      </div>
    )

    await expect(component.getByText('Thinking…')).toBeVisible()
    await expect(component.getByText('The spacing looks balanced now.')).toBeVisible()
  })

  test('renders dense sessions and composer', async ({ mount }) => {
    const component = await mount(
      <div className="grid grid-cols-[20rem_1fr] gap-6 p-6">
        <SessionList
          agents={[{ id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' }]}
          sessions={Array.from({ length: 6 }, (_, index) => ({
            id: `session-${index + 1}`,
            title: `Conversation ${index + 1}`,
            updatedAt: `2026-03-1${index + 1}T08:00:00.000Z`,
            agentId: 'copilot',
            project: {
              id: 'acp-frontend',
              name: 'ACP Frontend',
              path: '/home/runner/work/acp-frontend/acp-frontend',
            },
          }))}
          activeSessionId="session-1"
          creatingSession={false}
          onCreate={() => {}}
          onSelect={() => {}}
        />
        <div className="rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
          <ChatComposer
            value="Ship the Playwright setup"
            onChange={() => {}}
            onSubmit={(event) => event.preventDefault()}
            disabled={false}
            canSubmit
          />
        </div>
      </div>
    )

    await expect(component.getByRole('button', { name: 'New' })).toBeVisible()
    await expect(component.getByRole('button', { name: 'Send' })).toBeEnabled()
  })
})
