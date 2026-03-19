import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatHeader } from './ChatHeader.js'

const agents = [
  { id: 'copilot', name: 'GitHub Copilot', status: 'active' as const, command: 'copilot' },
  { id: 'claude-code', name: 'Claude Code', status: 'unavailable' as const, command: null },
]

const meta = {
  title: 'Chat/ChatHeader',
  component: ChatHeader,
  args: {
    agentId: 'copilot',
    agents,
    onAgentSelect: () => {},
    project: {
      id: 'acp-frontend',
      name: 'ACP Frontend',
      path: '/home/vries/projects/acp-frontend',
      status: 'available',
    },
    sessionId: '8bde315f-d2a3-4521-80e2-a55a0f2598d8',
    errorMessage: null,
    ready: true,
    thinking: false,
  },
} satisfies Meta<typeof ChatHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {}

export const Thinking: Story = {
  args: {
    thinking: true,
  },
}

export const Error: Story = {
  args: {
    errorMessage: 'The live chat stream disconnected unexpectedly.',
  },
}
