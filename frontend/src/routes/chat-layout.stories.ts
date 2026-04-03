import type { Meta, StoryObj } from '@storybook/svelte'
import ChatLayout from './ChatLayout.svelte'

const meta = {
  title: 'Pages/ChatLayout',
  component: ChatLayout,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ChatLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    thinking: true,
    mobileDrawer: false,
  },
}

export const MobileDrawerOpen: Story = {
  args: {
    mobileDrawer: true,
    thinking: true,
  },
}
