import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ChatComposer } from './ChatComposer.js'
import type { ModelState } from '../../hooks/useAgUiChat.js'

function ComposerStory(props: {
  disabled: boolean
  canSubmit: boolean
  initialValue?: string
  helperText?: string
  modelState?: ModelState | null
}) {
  const [value, setValue] = useState(props.initialValue ?? '')
  const [modelState, setModelState] = useState<ModelState | null>(props.modelState ?? null)

  const handleModelChange = (modelId: string) => {
    setModelState((prev) => (prev ? { ...prev, currentModelId: modelId } : prev))
  }

  return (
    <div className="max-w-5xl rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_18px_60px_rgba(2,6,23,0.25)]">
      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={(event) => event.preventDefault()}
        disabled={props.disabled}
        canSubmit={props.canSubmit}
        helperText={props.helperText}
        modelState={modelState}
        onModelChange={handleModelChange}
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

// History-session panel stories (rendered directly, not via ComposerStory wrapper)
export const HistorySessionWithResumeAndFork: StoryObj<typeof ChatComposer> = {
  render: () => (
    <div className="max-w-5xl rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_18px_60px_rgba(2,6,23,0.25)]">
      <ChatComposer
        value=""
        onChange={() => {}}
        onSubmit={(e) => e.preventDefault()}
        disabled={false}
        canSubmit={false}
        isHistorySession
        resumeAgent={{ id: 'opencode', name: 'opencode' }}
        forkAgents={[
          { id: 'copilot', name: 'GitHub Copilot' },
          { id: 'gemini', name: 'Gemini CLI' },
        ]}
        onResume={(id) => console.log('resume', id)}
        onFork={(id) => console.log('fork', id)}
      />
    </div>
  ),
}

export const HistorySessionResumeOnly: StoryObj<typeof ChatComposer> = {
  render: () => (
    <div className="max-w-5xl rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_18px_60px_rgba(2,6,23,0.25)]">
      <ChatComposer
        value=""
        onChange={() => {}}
        onSubmit={(e) => e.preventDefault()}
        disabled={false}
        canSubmit={false}
        isHistorySession
        resumeAgent={{ id: 'opencode', name: 'opencode' }}
        forkAgents={[]}
        onResume={(id) => console.log('resume', id)}
      />
    </div>
  ),
}

export const HistorySessionForkOnly: StoryObj<typeof ChatComposer> = {
  render: () => (
    <div className="max-w-5xl rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_18px_60px_rgba(2,6,23,0.25)]">
      <ChatComposer
        value=""
        onChange={() => {}}
        onSubmit={(e) => e.preventDefault()}
        disabled={false}
        canSubmit={false}
        isHistorySession
        forkAgents={[{ id: 'copilot', name: 'GitHub Copilot' }]}
        onFork={(id) => console.log('fork', id)}
      />
    </div>
  ),
}

export const HistorySessionNoAgents: StoryObj<typeof ChatComposer> = {
  render: () => (
    <div className="max-w-5xl rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_18px_60px_rgba(2,6,23,0.25)]">
      <ChatComposer
        value=""
        onChange={() => {}}
        onSubmit={(e) => e.preventDefault()}
        disabled={false}
        canSubmit={false}
        isHistorySession
      />
    </div>
  ),
}

export const HistorySessionLoading: StoryObj<typeof ChatComposer> = {
  render: () => (
    <div className="max-w-5xl rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_18px_60px_rgba(2,6,23,0.25)]">
      <ChatComposer
        value=""
        onChange={() => {}}
        onSubmit={(e) => e.preventDefault()}
        disabled={false}
        canSubmit={false}
        isHistorySession
        historyLoading
      />
    </div>
  ),
}

export const WithModelSelector: Story = {
  args: {
    disabled: false,
    canSubmit: true,
    initialValue: 'Summarise the latest changes in one paragraph.',
    helperText: undefined,
    modelState: {
      availableModels: [
        { modelId: 'gpt-4o', name: 'GPT-4o' },
        { modelId: 'gpt-4o-mini', name: 'GPT-4o mini' },
        { modelId: 'o3', name: 'o3' },
      ],
      currentModelId: 'gpt-4o',
    },
  },
}

export const WithSingleModel: Story = {
  args: {
    disabled: false,
    canSubmit: true,
    initialValue: 'Say hello in one short sentence.',
    helperText: undefined,
    modelState: {
      availableModels: [{ modelId: 'gpt-4o', name: 'GPT-4o' }],
      currentModelId: 'gpt-4o',
    },
  },
}
