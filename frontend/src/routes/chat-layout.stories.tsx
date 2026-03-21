import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChatHeader } from '../components/chat/ChatHeader.js'
import { ProjectContextSwitcher } from '../components/chat/ProjectContextSwitcher.js'
import { SessionList } from '../components/chat/SessionList.js'
import { ChatTranscript } from '../components/chat/ChatTranscript.js'
import { ChatComposer } from '../components/chat/ChatComposer.js'
import { ChatDiffView } from '../components/chat/ChatDiffView.js'
import { ProjectWorkspacePanel } from '../components/chat/ProjectWorkspacePanel.js'

function ChatLayoutStory() {
  const [value, setValue] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [projectManagerOpen, setProjectManagerOpen] = useState(false)
  const [workspaceMode, setWorkspaceMode] = useState<'chat' | 'files' | 'diff'>('chat')

  return (
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col">
        <ChatHeader
          agentName="GitHub Copilot"
          errorMessage={null}
          onToggleSidebar={() => setMobileSidebarOpen(true)}
          project={{
            id: 'acp-frontend',
            name: 'ACP Frontend',
            path: '/home/vries/projects/acp-frontend',
            status: 'available',
          }}
          sessionTitle="Agentic Coding Presentation Outline"
          ready={false}
          thinking={false}
        />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <SessionList
            agents={[
              { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
              { id: 'gemini-cli', name: 'Gemini CLI', status: 'active', command: 'gemini' },
              { id: 'claude-code', name: 'Claude Code', status: 'unavailable', command: null },
            ]}
            sessions={[]}
            createMenuOpen={createMenuOpen}
            selectedAgentId="copilot"
            selectedProjectId="acp-frontend"
            activeSessionId={null}
            creatingSession={false}
            mobileOpen={mobileSidebarOpen}
            onCreate={() => setCreateMenuOpen(false)}
            onCreateMenuOpenChange={setCreateMenuOpen}
            onMobileOpenChange={setMobileSidebarOpen}
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
                open={projectManagerOpen}
                onProjectSelect={() => {}}
                onOpenChange={setProjectManagerOpen}
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
                canManageProjects
                canStartSession
                hasAnyProject
                hasAvailableAgent
                hasAvailableProject
                messages={[]}
                hasSession={false}
                loading={false}
                onOpenProjectManager={() => setProjectManagerOpen(true)}
                onStartSession={() => {
                  setProjectManagerOpen(false)
                  setCreateMenuOpen(true)
                  setMobileSidebarOpen(true)
                }}
                ready={false}
                thinking={false}
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
                <div className="mx-auto w-full max-w-4xl">
                  <ChatDiffView
                    state="ready"
                    diff={`diff --git a/frontend/src/routes/chat.tsx b/frontend/src/routes/chat.tsx
index 7f13ef2..c9ab221 100644
--- a/frontend/src/routes/chat.tsx
+++ b/frontend/src/routes/chat.tsx
@@ -24,6 +24,7 @@ export function ChatPage() {
  export function ChatPage() {
 +  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
    const [workspaceMode, setWorkspaceMode] = useState<'chat' | 'files' | 'diff'>('chat')
@@ -238,6 +239,7 @@ export function ChatPage() {
    <ChatHeader
 +    onToggleSidebar={() => setMobileSidebarOpen(true)}
      agentName={selectedAgent?.name ?? null}
      project={selectedProject}
diff --git a/frontend/src/components/chat/SessionList.tsx b/frontend/src/components/chat/SessionList.tsx
index 1111111..2222222 100644
--- a/frontend/src/components/chat/SessionList.tsx
+++ b/frontend/src/components/chat/SessionList.tsx
@@ -91,0 +92,6 @@
 +          {mobile && onMobileOpenChange ? (
 +            <button aria-label="Close navigation">×</button>
 +          ) : null}
 +
 +          <div className="relative z-10 h-full w-[min(22rem,88vw)]">
 +            {renderPanel({ mobile: true })}
                     `}
                  />
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
