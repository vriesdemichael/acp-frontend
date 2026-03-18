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
    <main className="min-h-screen bg-[#05070b] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col">
        <ChatHeader
          agentId={activeAgentId}
          agents={agents}
          errorMessage={errorMessage}
          onAgentSelect={selectAgent}
          sessionId={activeSessionId}
          ready={ready}
          thinking={thinking}
        />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_18rem]">
          <SessionList
            agents={agents}
            sessions={sessions}
            selectedAgentId={activeAgentId}
            activeSessionId={activeSessionId}
            creatingSession={creatingSession}
            onCreate={startNewSession}
            onSelect={selectSession}
          />

          <section className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden bg-[#070b12] xl:border-x xl:border-white/8">
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

      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.1),transparent_42%)]" />
    </main>
  )
}
