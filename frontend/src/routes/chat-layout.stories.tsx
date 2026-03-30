import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChatComposer } from '../components/chat/ChatComposer.js'
import { ChatDiffView } from '../components/chat/ChatDiffView.js'
import { ChatHeader } from '../components/chat/ChatHeader.js'
import { ProjectContextSwitcher } from '../components/chat/ProjectContextSwitcher.js'
import { ProjectWorkspacePanel } from '../components/chat/ProjectWorkspacePanel.js'
import { SessionList } from '../components/chat/SessionList.js'
import { ChatTranscript } from '../components/chat/ChatTranscript.js'

type Surface = 'chat' | 'files' | 'diff'

function ChatLayoutStory(props: { mobileDrawer?: boolean; surface?: Surface; thinking?: boolean }) {
  const [value, setValue] = useState('')

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col">
        <ChatHeader
          activeAgentName="GitHub Copilot"
          errorMessage={null}
          renderLink={({ className, children }) => <span className={className}>{children}</span>}
          project={{
            id: 'acp-frontend',
            name: 'ACP Frontend',
            path: '/home/vries/projects/acp-frontend',
            status: 'available',
          }}
          sessionId="session-12345678"
          ready
          thinking={props.thinking ?? false}
          title="Agentic Coding Presentation Outline"
        />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[18.5rem_minmax(0,1fr)_19rem]">
          <aside className="hidden lg:flex">
            <div className="flex min-h-0 w-full flex-col">
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
                    source: 'history' as const,
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
                    source: 'history' as const,
                    project: {
                      id: 'acp-frontend',
                      name: 'ACP Frontend',
                      path: '/home/vries/projects/acp-frontend',
                    },
                  },
                  {
                    id: 'session-3',
                    title: 'Gemini follow-up on grouped session discovery',
                    updatedAt: '2026-03-16T11:18:00.000Z',
                    agentId: 'gemini-cli',
                    source: 'history' as const,
                    project: {
                      id: 'docs-site',
                      name: 'Docs Site',
                      path: '/home/vries/projects/docs-site',
                    },
                  },
                ]}
                activeSessionId="session-12345678"
                creatingSession={false}
                onCreate={() => {}}
                onSelect={() => {}}
              />

              <div className="border-r border-t border-white/8 bg-slate-950/84 p-4">
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
                  onOpenChange={() => {}}
                  onProjectVisibilityChange={() => {}}
                  onAddProject={async () => ({
                    id: 'new-project',
                    name: 'New Project',
                    path: '/home/vries/projects/new-project',
                    status: 'available',
                  })}
                  onRemoveProject={async () => {}}
                  onSuggestProjectPaths={async () => []}
                />

                <button
                  type="button"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/75 text-sm font-medium text-slate-200"
                >
                  Settings
                </button>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden bg-[#070b12] lg:border-x lg:border-white/8">
            <div className="hidden items-center justify-between border-b border-white/8 bg-slate-950/72 px-6 py-3 lg:flex">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Workspace view
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Keep the conversation central while switching files and diff in place.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={tabClassName(props.surface !== 'files' && props.surface !== 'diff')}
                >
                  Chat
                </button>
                <button type="button" className={tabClassName(props.surface === 'files')}>
                  Files
                </button>
                <button type="button" className={tabClassName(props.surface === 'diff')}>
                  Diff
                </button>
              </div>
            </div>

            {props.surface === 'diff' ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                <div className="mx-auto max-w-5xl">
                  <ChatDiffView
                    state="ready"
                    diff={`diff --git a/src/app.tsx b/src/app.tsx
index 1234567..89abcde 100644
--- a/src/app.tsx
+++ b/src/app.tsx
@@ -1,3 +1,4 @@
 import { AppShell } from './shell'
-import { LegacyPane } from './legacy'
+import { ChatDiffView } from './chat'
 
+const enabled = true
 export function App() {
`}
                  />
                </div>
              </div>
            ) : props.surface === 'files' ? (
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
                activeAgentCount={2}
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
              />
            ) : (
              <ChatTranscript
                activeAgentName="GitHub Copilot"
                canManageProjects
                canStartSession
                hasAnyProject
                hasAvailableAgent
                hasAvailableProject
                onOpenProjectManager={() => {}}
                onStartSession={() => {}}
                messages={[
                  {
                    id: 'assistant-1',
                    role: 'assistant',
                    content:
                      'The header should collapse into a tighter control bar while the side rails stop competing with the actual conversation.',
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
                      'A slimmer rail, quieter badges, and a more dominant transcript column will get much closer to that feeling.',
                  },
                ]}
                hasSession
                loading={false}
                ready
                thinking={props.thinking ?? true}
                errorMessage={null}
              />
            )}

            <ChatComposer
              value={value}
              onChange={setValue}
              onSubmit={(event) => event.preventDefault()}
              disabled={false}
              canSubmit={value.trim().length > 0}
              helperText="The composer stays visible while you inspect files or diff so the conversation keeps its place."
            />
          </section>

          <div className="hidden xl:flex">
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
              activeAgentCount={2}
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
            />
          </div>
        </div>
      </div>

      {props.mobileDrawer ? (
        <aside
          data-testid="chat-session-drawer"
          className="fixed inset-y-0 left-0 z-50 flex w-[min(26rem,92vw)] flex-col border-r border-white/10 bg-[#050912] shadow-[0_18px_80px_rgba(2,6,23,0.6)] lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                New Session
              </p>
              <p className="mt-1 text-sm text-slate-300">Navigation and project controls</p>
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg text-slate-100"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <SessionList
              agents={[
                { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
                { id: 'gemini-cli', name: 'Gemini CLI', status: 'active', command: 'gemini' },
              ]}
              sessions={[
                {
                  id: 'session-12345678',
                  title: 'Agentic Coding Presentation Outline',
                  updatedAt: '2026-03-18T09:00:00.000Z',
                  agentId: 'copilot',
                  source: 'history' as const,
                  project: {
                    id: 'acp-frontend',
                    name: 'ACP Frontend',
                    path: '/home/vries/projects/acp-frontend',
                  },
                },
              ]}
              activeSessionId="session-12345678"
              creatingSession={false}
              onCreate={() => {}}
              onSelect={() => {}}
            />
          </div>

          <div className="border-t border-white/8 p-4">
            <button
              type="button"
              aria-label="Open project manager"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/75 text-sm font-medium text-slate-100"
            >
              Open project manager
            </button>
          </div>
        </aside>
      ) : null}
    </main>
  )
}

function tabClassName(active: boolean) {
  return [
    'inline-flex h-10 items-center justify-center rounded-xl border px-3.5 text-sm font-medium transition',
    active
      ? 'border-teal-500/30 bg-teal-500/12 text-teal-100'
      : 'border-white/10 bg-slate-900/55 text-slate-300',
  ].join(' ')
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

export const Default: Story = {
  args: {
    surface: 'chat',
    thinking: true,
  },
}

export const DiffMode: Story = {
  args: {
    surface: 'diff',
    thinking: false,
  },
}

export const FilesMode: Story = {
  args: {
    surface: 'files',
    thinking: false,
  },
}

export const MobileDrawerOpen: Story = {
  args: {
    mobileDrawer: true,
    surface: 'chat',
    thinking: true,
  },
}
