<script lang="ts">
  import ChatHeader from '../components/chat/ChatHeader.svelte'
  import ChatTranscript from '../components/chat/ChatTranscript.svelte'
  import ChatComposer from '../components/chat/ChatComposer.svelte'
  import SessionList from '../components/chat/SessionList.svelte'
  import ProjectWorkspacePanel from '../components/chat/ProjectWorkspacePanel.svelte'

  interface Props {
    mobileDrawer?: boolean
    thinking?: boolean
  }

  const { mobileDrawer = false, thinking = false }: Props = $props()

  let composerValue = $state('')

  const project = {
    id: 'acp-frontend',
    name: 'ACP Frontend',
    path: '/home/vries/projects/acp-frontend',
    status: 'available' as const,
  }

  const agents = [
    {
      id: 'copilot',
      name: 'GitHub Copilot',
      status: 'active' as const,
      command: 'copilot',
      canResume: true,
      canLoad: false,
    },
    {
      id: 'gemini-cli',
      name: 'Gemini CLI',
      status: 'active' as const,
      command: 'gemini',
      canResume: true,
      canLoad: false,
    },
    {
      id: 'claude-code',
      name: 'Claude Code',
      status: 'unavailable' as const,
      command: null,
      canResume: false,
      canLoad: false,
    },
  ]

  const sessions = [
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
  ]

  const projects = [
    project,
    {
      id: 'docs-site',
      name: 'Docs Site',
      path: '/home/vries/projects/docs-site',
      status: 'missing' as const,
    },
  ]

  const messages = [
    {
      id: 'assistant-1',
      role: 'assistant' as const,
      content:
        'The header should collapse into a tighter control bar while the side rails stop competing with the actual conversation.',
    },
    {
      id: 'user-1',
      role: 'user' as const,
      content: 'Keep the layout tighter and less dashboard-like.',
    },
  ]
</script>

<main class="min-h-screen bg-[#05070b] text-slate-100">
  <div class="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col">
    <ChatHeader
      activeAgentName="GitHub Copilot"
      errorMessage={null}
      {project}
      sessionId="session-12345678"
      ready
      {thinking}
      title="Agentic Coding Presentation Outline"
    />

    <div class="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[18.5rem_minmax(0,1fr)_19rem]">
      <aside class="hidden lg:flex">
        <div class="flex min-h-0 w-full flex-col">
          <SessionList
            {agents}
            {sessions}
            activeSessionId="session-12345678"
            creatingSession={false}
            onCreate={() => {}}
            onSelect={() => {}}
          />
        </div>
      </aside>

      <section class="flex min-h-[32rem] min-w-0 flex-col overflow-hidden bg-[#070b12] lg:border-x lg:border-white/8">
        <ChatTranscript
          activeAgentName="GitHub Copilot"
          {messages}
          hasSession
          loading={false}
          ready
          {thinking}
          errorMessage={null}
        />

        <ChatComposer
          value={composerValue}
          onChange={(v) => (composerValue = v)}
          onSubmit={() => {}}
          disabled={false}
          canSubmit={composerValue.trim().length > 0}
          helperText="The composer stays visible while you inspect files or diff."
        />
      </section>

      <div class="hidden xl:flex">
        <ProjectWorkspacePanel
          {projects}
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

  {#if mobileDrawer}
    <aside
      data-testid="chat-session-drawer"
      class="fixed inset-y-0 left-0 z-50 flex w-[min(26rem,92vw)] flex-col border-r border-white/10 bg-[#050912] shadow-[0_18px_80px_rgba(2,6,23,0.6)] lg:hidden"
    >
      <div class="flex items-center justify-between border-b border-white/8 px-4 py-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            New Session
          </p>
          <p class="mt-1 text-sm text-slate-300">Navigation and project controls</p>
        </div>
        <button
          type="button"
          aria-label="Close navigation"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg text-slate-100"
        >
          ×
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <SessionList
          {agents}
          {sessions}
          activeSessionId="session-12345678"
          creatingSession={false}
          onCreate={() => {}}
          onSelect={() => {}}
        />
      </div>
    </aside>
  {/if}
</main>
