import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatTranscript } from './ChatTranscript.js'

const meta = {
  title: 'Chat/ChatTranscript',
  component: ChatTranscript,
  args: {
    activeAgentName: 'GitHub Copilot',
    messages: [],
    hasSession: true,
    loading: false,
    ready: true,
    thinking: false,
    errorMessage: null,
  },
} satisfies Meta<typeof ChatTranscript>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const Loading: Story = {
  args: {
    hasSession: false,
    loading: true,
    ready: false,
  },
}

export const Error: Story = {
  args: {
    hasSession: false,
    errorMessage: 'Message failed to send. Check the agent connection and try again.',
  },
}

export const LongTranscript: Story = {
  args: {
    hasSession: true,
    messages: [
      { id: 'user-1', role: 'user', content: 'Please audit the chat layout for mobile spacing.' },
      {
        id: 'assistant-1',
        role: 'assistant',
        content:
          'The main issue is vertical crowding in the header, especially once session metadata and status badges stack. I would reduce the copy, tighten the gaps, and keep the composer pinned visually to the transcript.',
      },
      { id: 'user-2', role: 'user', content: 'Can you suggest a cleaner status treatment?' },
      {
        id: 'assistant-2',
        role: 'assistant',
        content:
          'Use a single concise status block in the header and avoid repeating health diagnostics in the transcript pane. That keeps the chat area focused on conversation content.',
      },
    ],
  },
}

export const DenseDesktop: Story = {
  args: {
    hasSession: true,
    messages: [
      {
        id: 'assistant-1',
        role: 'assistant',
        content:
          'The transcript should become the clear hero of the page, with fewer decorative status treatments stealing attention from the conversation itself.',
      },
      {
        id: 'user-1',
        role: 'user',
        content: 'So the layout should feel more like a chat app than a dashboard?',
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        content:
          'Exactly. Keep context available, but let the eye land on the exchange first and the controls second.',
      },
      {
        id: 'user-2',
        role: 'user',
        content:
          'And files or diff should stay in the same column rather than opening a separate workspace?',
      },
      {
        id: 'assistant-3',
        role: 'assistant',
        content:
          'Yes. The mental model is one conversation surface with contextual modes, not three competing panes.',
      },
    ],
  },
}

export const Thinking: Story = {
  args: {
    hasSession: true,
    messages: [{ id: 'user-1', role: 'user', content: 'Say hello in one short sentence.' }],
    thinking: true,
  },
}

export const Welcome: Story = {
  args: {
    hasSession: false,
    ready: false,
    canManageProjects: true,
    canStartSession: true,
    hasAnyProject: true,
    hasAvailableAgent: true,
    hasAvailableProject: true,
    onOpenProjectManager: () => {},
    onStartSession: () => {},
  },
}

export const NeedsProject: Story = {
  args: {
    hasSession: false,
    ready: false,
    canManageProjects: true,
    canStartSession: false,
    hasAnyProject: false,
    hasAvailableAgent: true,
    hasAvailableProject: false,
    onOpenProjectManager: () => {},
  },
}

export const NeedsAgent: Story = {
  args: {
    hasSession: false,
    ready: false,
    canManageProjects: true,
    canStartSession: false,
    hasAnyProject: true,
    hasAvailableAgent: false,
    hasAvailableProject: true,
    onOpenProjectManager: () => {},
  },
}
