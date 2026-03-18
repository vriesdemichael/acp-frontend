import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChatComposer } from './ChatComposer.js'

function ComposerStory(props: { disabled: boolean; canSubmit: boolean; initialValue?: string }) {
  const [value, setValue] = useState(props.initialValue ?? '')

  return (
    <div className="max-w-3xl rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={(event) => event.preventDefault()}
        disabled={props.disabled}
        canSubmit={props.canSubmit}
      />
    </div>
  )
}

const meta = {
  title: 'Chat/ChatComposer',
  component: ComposerStory,
  args: {
    disabled: false,
    canSubmit: true,
    initialValue: 'Say hello in one short sentence.',
  },
} satisfies Meta<typeof ComposerStory>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {}

export const Disabled: Story = {
  args: {
    disabled: true,
    canSubmit: false,
    initialValue: '',
  },
}
