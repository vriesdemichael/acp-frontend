import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChatHeader } from '../components/chat/ChatHeader.js'
import { ProjectContextSwitcher } from '../components/chat/ProjectContextSwitcher.js'
import { SessionList } from '../components/chat/SessionList.js'
import { ChatTranscript } from '../components/chat/ChatTranscript.js'
import { ChatComposer } from '../components/chat/ChatComposer.js'
import { ProjectWorkspacePanel } from '../components/chat/ProjectWorkspacePanel.js'

function ChatLayoutStory() {
  const [value, setValue] = useState('')

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col">
        <ChatHeader
          agentId="copilot"
          agents={[
            { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
            { id: 'claude-code', name: 'Claude Code', status: 'unavailable', command: null },
          ]}
          errorMessage={null}
          onAgentSelect={() => {}}
          renderLink={({ className, children }) => <span className={className}>{children}</span>}
          project={{
            id: 'acp-frontend',
            name: 'ACP Frontend',
            path: '/home/vries/projects/acp-frontend',
            status: 'available',
          }}
          sessionTitle="Agentic Coding Presentation Outline"
          ready
          thinking={false}
        />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_18rem]">
          <SessionList
            agents={[
              { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
              { id: 'gemini-cli', name: 'Gemini CLI', status: 'active', command: 'gemini' },
              { id: 'claude-code', name: 'Claude Code', status: 'unavailable', command: null },
            ]}
            sessions={[
              {
                id: 'session-12345678',
                title: 'Agentic Coding Presentation Outline',
                updatedAt: '2026-03-18T09:00:00.000Z',
                agentId: 'copilot',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
              {
                id: 'session-2',
                title: 'CLI-Integrated Code Assistant Alternatives',
                updatedAt: '2026-03-18T08:10:00.000Z',
                agentId: 'copilot',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
              {
                id: 'session-3',
                title: 'VS Code YAML Frontmatter Validation Tooling',
                updatedAt: '2026-03-17T16:42:00.000Z',
                agentId: 'copilot',
                project: {
                  id: 'acp-frontend',
                  name: 'ACP Frontend',
                  path: '/home/vries/projects/acp-frontend',
                },
              },
              {
                id: 'session-4',
                title: 'Gemini follow-up on grouped session discovery',
                updatedAt: '2026-03-16T11:18:00.000Z',
                agentId: 'gemini-cli',
                project: {
                  id: 'docs-site',
                  name: 'Docs Site',
                  path: '/home/vries/projects/docs-site',
                },
              },
            ]}
            selectedAgentId="copilot"
            selectedProjectId="acp-frontend"
            activeSessionId="session-12345678"
            creatingSession={false}
            onCreate={() => {}}
            onSelect={() => {}}
            projectSwitcher={
              <ProjectContextSwitcher
                projects={[
                  {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                    status: 'available',
                  },
                  {
                    id: 'docs-site',
                    name: 'Docs Site',
                    path: '/home/vries/projects/docs-site',
                    status: 'missing',
                  },
                ]}
                selectedProjectId="acp-frontend"
                visibleProjectIds={['acp-frontend', 'docs-site']}
                onProjectSelect={() => {}}
                onProjectVisibilityChange={() => {}}
                onAddProject={() =>
                  Promise.resolve({
                    id: 'new-project',
                    name: 'New Project',
                    path: '/home/vries/projects/new-project',
                    status: 'available' as const,
                  })
                }
                onRemoveProject={() => Promise.resolve()}
                onSuggestProjectPaths={(path) =>
                  Promise.resolve([
                    {
                      name: 'acp-frontend',
                      path: `${path.replace(/\/+$/, '')}/acp-frontend`,
                    },
                  ])
                }
              />
            }
          />

          <section className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden bg-[#070b12] xl:border-x xl:border-white/8">
            <ChatTranscript
              activeAgentName="GitHub Copilot"
              messages={[
                {
                  id: 'assistant-1',
                  role: 'assistant',
                  content:
                    'The header should collapse into a sleek top bar while the side rails hug the edges and leave more room for the actual conversation.',
                },
                {
                  id: 'user-1',
                  role: 'user',
                  content: 'Keep the layout tighter and less dashboard-like.',
                },
                {
                  id: 'assistant-2',
                  role: 'assistant',
                  content:
                    'A darker shell with a compact control bar and slimmer side panels will get much closer to the reference pattern without copying it directly.',
                },
              ]}
              hasSession
              loading={false}
              ready
              thinking
              errorMessage={null}
            />

            <ChatComposer
              value={value}
              onChange={setValue}
              onSubmit={(event) => event.preventDefault()}
              disabled={false}
              canSubmit={value.trim().length > 0}
              helperText="Streaming responses appear in the workspace as the agent thinks and replies."
            />
          </section>

          <ProjectWorkspacePanel
            projects={[
              {
                id: 'acp-frontend',
                name: 'ACP Frontend',
                path: '/home/vries/projects/acp-frontend',
                status: 'available',
              },
              {
                id: 'docs-site',
                name: 'Docs Site',
                path: '/home/vries/projects/docs-site',
                status: 'missing',
              },
            ]}
            selectedProjectId="acp-frontend"
            onProjectSelect={() => {}}
            onAddProject={() =>
              Promise.resolve({
                id: 'new-project',
                name: 'New Project',
                path: '/home/vries/projects/new-project',
                status: 'available' as const,
              })
            }
            onSuggestProjectPaths={(path) =>
              Promise.resolve([
                {
                  name: 'acp-frontend',
                  path: `${path.replace(/\/+$/, '')}/acp-frontend`,
                },
              ])
            }
            tree={[
              { name: 'src', path: 'src', type: 'directory', hasChildren: true },
              { name: 'package.json', path: 'package.json', type: 'file', hasChildren: false },
            ]}
            treePath={null}
            treeLoading={false}
            treeError={null}
            expandedPaths={[]}
            onToggleFolder={() => {}}
            selectedEntryPath="src"
            onSelectEntry={() => {}}
            layout="explorer"
          />
        </div>
      </div>
    </main>
  )
}

const meta = {
  title: 'Pages/ChatLayout',
  component: ChatLayoutStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ChatLayoutStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
