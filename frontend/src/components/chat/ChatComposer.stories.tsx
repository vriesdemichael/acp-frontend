import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChatComposer } from './ChatComposer.js'

function ComposerStory(props: {
  disabled: boolean
  canSubmit: boolean
  initialValue?: string
  helperText?: string
}) {
  const [value, setValue] = useState(props.initialValue ?? '')

  return (
    <div className="max-w-5xl rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_18px_60px_rgba(2,6,23,0.25)]">
      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={(event) => event.preventDefault()}
        disabled={props.disabled}
        canSubmit={props.canSubmit}
        helperText={props.helperText}
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
    helperText: 'Streaming responses appear in the workspace as the agent thinks and replies.',
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
    helperText: 'Choose a project context and start a new session before sending a message.',
  },
}
