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
  const [workspaceMode, setWorkspaceMode] = useState<'chat' | 'files' | 'diff'>('chat')

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col">
        <ChatHeader
          agentName="GitHub Copilot"
          errorMessage={null}
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

        <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)]">
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
            settingsLink={
              <span className="inline-flex h-9 items-center px-3 text-sm">Settings</span>
            }
          />

          <section className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden bg-[#070b12]">
            <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5 sm:px-5">
              {(['files', 'diff'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setWorkspaceMode((current) => (current === mode ? 'chat' : mode))}
                  className={[
                    'inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition',
                    workspaceMode === mode
                      ? 'border-teal-500/35 bg-teal-500/10 text-teal-200'
                      : 'border-white/10 bg-slate-900/70 text-slate-300 hover:bg-slate-800',
                  ].join(' ')}
                >
                  {mode === 'files' ? 'Files' : 'Diff'}
                </button>
              ))}
            </div>

            {workspaceMode === 'chat' ? (
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
            ) : workspaceMode === 'files' ? (
              <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
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
                    {
                      name: 'package.json',
                      path: 'package.json',
                      type: 'file',
                      hasChildren: false,
                    },
                  ]}
                  treePath={null}
                  treeLoading={false}
                  treeError={null}
                  expandedPaths={[]}
                  onToggleFolder={() => {}}
                  selectedEntryPath="src"
                  onSelectEntry={() => {}}
                  layout="explorer"
                  variant="embedded"
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                <div className="mx-auto max-w-4xl rounded-2xl border border-dashed border-white/10 bg-slate-900/55 px-5 py-8 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Diff
                  </p>
                  <h2 className="mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">
                    Diff view is coming next
                  </h2>
                </div>
              </div>
            )}

            <ChatComposer
              value={value}
              onChange={setValue}
              onSubmit={(event) => event.preventDefault()}
              disabled={false}
              canSubmit={value.trim().length > 0}
              helperText="Streaming responses appear in the workspace as the agent thinks and replies."
            />
          </section>
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
