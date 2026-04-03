import type { Meta, StoryObj } from '@storybook/svelte'
import ChatHeader from './ChatHeader.svelte'

const meta = {
  title: 'Chat/ChatHeader',
  component: ChatHeader,
  args: {
    activeAgentName: 'GitHub Copilot',
    project: {
      id: 'acp-frontend',
      name: 'ACP Frontend',
      path: '/home/vries/projects/acp-frontend',
      status: 'available' as const,
    },
    sessionId: '8bde315f-d2a3-4521-80e2-a55a0f2598d8',
    title: 'Agentic Coding Presentation Outline',
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
