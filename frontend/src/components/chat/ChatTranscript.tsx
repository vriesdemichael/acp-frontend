import type { ChatMessage } from '../../hooks/useAgUiChat.js'

interface ChatTranscriptProps {
  activeAgentName: string
  messages: ChatMessage[]
  loading: boolean
  ready: boolean
  thinking: boolean
  errorMessage: string | null
}

export function ChatTranscript({
  activeAgentName,
  messages,
  loading,
  ready,
  thinking,
  errorMessage,
}: ChatTranscriptProps) {
  return (
    <div
      data-testid="chat-transcript"
      className="min-h-0 flex-1 overflow-y-auto bg-[#070b12] px-5 py-5 sm:px-6 sm:py-6"
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5">
        {loading && !errorMessage && (
          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-100 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Loading
            </p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-3xl text-slate-50">
              Opening your workspace
            </h2>
            <p className="mt-3 max-w-xl leading-6 text-slate-300">
              Creating a fresh agent session and preparing the stream.
            </p>
          </section>
        )}

        {errorMessage && (
          <section
            role="alert"
            className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-100 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
              Attention
            </p>
            <p className="mt-3 text-base font-medium text-slate-50">{errorMessage}</p>
          </section>
        )}

        {ready && messages.length === 0 && (
          <section className="rounded-2xl border border-dashed border-white/10 bg-slate-900/55 px-5 py-8 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Transcript
            </p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-4xl text-slate-50">
              Start the conversation
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400">
              Ask {activeAgentName} to inspect code, explain a failure, or sketch a next step for
              the current workspace.
            </p>
          </section>
        )}

        {messages.map((message) => {
          const isUser = message.role === 'user'

          return (
            <article
              key={message.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${
                  isUser
                    ? 'bg-teal-500 text-slate-950'
                    : 'border border-white/10 bg-slate-900/95 text-slate-100 backdrop-blur'
                }`}
              >
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${
                    isUser ? 'text-teal-950/70' : 'text-teal-300'
                  }`}
                >
                  {isUser ? 'You' : activeAgentName}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              </div>
            </article>
          )
        })}

        {thinking && (
          <div className="flex justify-start" aria-live="polite">
            <div className="rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-sm text-slate-300 shadow-sm backdrop-blur">
              Thinking…
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
