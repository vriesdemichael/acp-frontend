import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChatSidePanel } from './ChatSidePanel.js'

const meta = {
  title: 'Chat/ChatSidePanel',
  component: ChatSidePanel,
  args: {
    testId: 'storybook-chat-side-panel',
    title: 'Workspace',
    description:
      'Reserved surface for project selection, folder context, and human-in-the-loop activity without reshaping the transcript pane.',
    bullets: ['Project picker', 'Folder tree', 'Approvals'],
    className: 'flex flex-col',
  },
} satisfies Meta<typeof ChatSidePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
