import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChatComposer } from '../components/chat/ChatComposer.js'
import { ChatHeader } from '../components/chat/ChatHeader.js'
import { SessionList } from '../components/chat/SessionList.js'
import { ChatSidePanel } from '../components/chat/ChatSidePanel.js'
import { ChatTranscript } from '../components/chat/ChatTranscript.js'
import { useAgUiChat } from '../hooks/useAgUiChat.js'

export function ChatPage() {
  const navigate = useNavigate({ from: '/chat' })
  const search = useSearch({ from: '/chat' })
  const sessionId = search.session ?? null
  const agentId = search.agent ?? null
  const {
    agentId: activeAgentId,
    agents,
    creatingSession,
    errorMessage,
    loading,
    messages,
    ready,
    selectedAgent,
    selectAgent,
    selectSession,
    sendMessage,
    sessionId: activeSessionId,
    sessions,
    startNewSession,
    thinking,
  } = useAgUiChat({
    sessionId,
    agentId,
    onAgentSelected: (nextAgentId) => {
      void navigate({ to: '/chat', search: (current) => ({ ...current, agent: nextAgentId }) })
    },
    onSessionCreated: (nextSessionId) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, session: nextSessionId }),
      })
    },
    onSessionSelected: (nextSessionId) => {
      void navigate({
        to: '/chat',
        search: (current) => ({ ...current, session: nextSessionId }),
      })
    },
  })
  const [input, setInput] = useState('')
  const activeAgentName = useMemo(
    () => selectedAgent?.name ?? 'the selected agent',
    [selectedAgent]
  )

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !ready) return

    try {
      await sendMessage(text)
      setInput('')
    } catch {
      // Error state is already surfaced by the hook.
    }
  }

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1600px] flex-col gap-4 sm:min-h-[calc(100vh-3rem)] lg:gap-5">
        <ChatHeader
          agentId={activeAgentId}
          agents={agents}
          onAgentSelect={selectAgent}
          sessionId={activeSessionId}
          ready={ready}
          thinking={thinking}
        />

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
          <SessionList
            sessions={sessions}
            activeSessionId={activeSessionId}
            creatingSession={creatingSession}
            onCreate={startNewSession}
            onSelect={selectSession}
          />

          <section className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.68)] shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <ChatTranscript
              activeAgentName={activeAgentName}
              messages={messages}
              loading={loading}
              ready={ready}
              thinking={thinking}
              errorMessage={errorMessage}
            />

            <ChatComposer
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              disabled={!ready}
              canSubmit={ready && input.trim().length > 0}
            />
          </section>

          <ChatSidePanel
            testId="chat-context-panel"
            title="Workspace"
            description="Reserved surface for project selection, folder context, and HITL activity without reshaping the chat pane."
            bullets={['Project picker', 'Folder tree', 'Approvals']}
            className="xl:flex xl:flex-col"
          />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_34%)]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[18rem] bg-[radial-gradient(circle_at_bottom,rgba(15,23,42,0.08),transparent_55%)]" />
    </main>
  )
}
