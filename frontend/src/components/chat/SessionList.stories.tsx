import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { SessionList } from './SessionList.js'

const denseSessions = Array.from({ length: 8 }, (_, index) => ({
  id: `session-${index + 1}`,
  title: index === 0 ? 'Inspect auth bug' : `Conversation ${index + 1}`,
  updatedAt: `2026-03-1${Math.min(index + 1, 8)}T08:0${index}:00.000Z`,
  agentId: 'copilot',
  project: {
    id: 'acp-frontend',
    name: 'ACP Frontend',
    path: '/home/vries/projects/acp-frontend',
  },
}))

const meta = {
  title: 'Chat/SessionList',
  component: SessionList,
  args: {
    agents: [
      { id: 'copilot', name: 'GitHub Copilot', status: 'active', command: 'copilot' },
      { id: 'gemini-cli', name: 'Gemini CLI', status: 'active', command: 'gemini' },
      { id: 'claude-code', name: 'Claude Code', status: 'unavailable', command: null },
    ],
    sessions: denseSessions,
    selectedAgentId: 'copilot',
    activeSessionId: 'session-1',
    creatingSession: false,
    onCreate: () => {},
    onSelect: () => {},
  },
} satisfies Meta<typeof SessionList>

export default meta
type Story = StoryObj<typeof meta>

function MobileDrawerStory(args: ComponentProps<typeof SessionList>) {
  const [mobileOpen, setMobileOpen] = useState(true)

  return (
    <div className="min-h-screen bg-[#05070b] p-4 text-slate-100">
      <SessionList {...args} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
    </div>
  )
}

export const DenseList: Story = {}

export const Empty: Story = {
  args: {
    sessions: [],
    activeSessionId: null,
  },
}

export const Creating: Story = {
  args: {
    creatingSession: true,
  },
}

export const GroupedByProject: Story = {
  args: {
    sessions: [
      ...denseSessions,
      {
        id: 'gemini-session-1',
        title: 'Gemini compatibility notes',
        updatedAt: '2026-03-18T11:20:00.000Z',
        agentId: 'gemini-cli',
        project: {
          id: 'docs-site',
          name: 'Docs Site',
          path: '/home/vries/projects/docs-site',
        },
      },
    ],
    selectedAgentId: 'gemini-cli',
  },
}

export const MobileDrawer: Story = {
  render: (args) => <MobileDrawerStory {...args} />,
}
