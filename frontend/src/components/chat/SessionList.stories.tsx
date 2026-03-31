import type { Meta, StoryObj } from '@storybook/react-vite'
import { SessionList } from './SessionList.js'

const denseSessions = Array.from({ length: 8 }, (_, index) => ({
  id: `session-${index + 1}`,
  title: index === 0 ? 'Inspect auth bug' : `Conversation ${index + 1}`,
  updatedAt: `2026-03-1${Math.min(index + 1, 8)}T08:0${index}:00.000Z`,
  agentId: 'copilot',
  source: 'history' as const,
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
      {
        id: 'copilot',
        name: 'GitHub Copilot',
        status: 'active',
        command: 'copilot',
        canResume: true,
        canLoad: false,
      },
      {
        id: 'gemini-cli',
        name: 'Gemini CLI',
        status: 'active',
        command: 'gemini',
        canResume: true,
        canLoad: false,
      },
      {
        id: 'claude-code',
        name: 'Claude Code',
        status: 'unavailable',
        command: null,
        canResume: false,
        canLoad: false,
      },
    ],
    sessions: denseSessions,
    activeSessionId: 'session-1',
    creatingSession: false,
    onCreate: () => {},
    onSelect: () => {},
  },
} satisfies Meta<typeof SessionList>

export default meta
type Story = StoryObj<typeof meta>

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

export const MixedAgents: Story = {
  args: {
    sessions: [
      ...denseSessions,
      {
        id: 'gemini-session-1',
        title: 'Gemini compatibility notes',
        updatedAt: '2026-03-18T11:20:00.000Z',
        agentId: 'gemini-cli',
        source: 'history' as const,
        project: {
          id: 'docs-site',
          name: 'Docs Site',
          path: '/home/vries/projects/docs-site',
        },
      },
    ],
  },
}
