import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatHeader } from './ChatHeader.js'

const meta = {
  title: 'Chat/ChatHeader',
  component: ChatHeader,
  args: {
    agentName: 'GitHub Copilot',
    project: {
      id: 'acp-frontend',
      name: 'ACP Frontend',
      path: '/home/vries/projects/acp-frontend',
      status: 'available',
    },
    sessionTitle: 'Investigate chat session selection race',
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
