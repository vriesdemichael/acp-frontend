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
      className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6"
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4">
        {loading && !errorMessage && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50/90 px-5 py-6 text-sm text-amber-950 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Loading
            </p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-3xl text-slate-900">
              Opening your workspace
            </h2>
            <p className="mt-3 max-w-xl leading-6 text-slate-700">
              Creating a fresh agent session and preparing the stream.
            </p>
          </section>
        )}

        {errorMessage && (
          <section
            role="alert"
            className="rounded-3xl border border-rose-200 bg-rose-50/90 px-5 py-5 text-sm text-rose-950 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
              Attention
            </p>
            <p className="mt-3 text-base font-medium text-slate-900">{errorMessage}</p>
          </section>
        )}

        {ready && messages.length === 0 && (
          <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/65 px-5 py-8 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Transcript
            </p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-4xl text-slate-900">
              Start the conversation
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600">
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
                className={`max-w-[85%] rounded-[1.75rem] px-4 py-3 shadow-sm sm:max-w-[75%] ${
                  isUser
                    ? 'bg-slate-900 text-white'
                    : 'border border-white/80 bg-white/85 text-slate-900 backdrop-blur'
                }`}
              >
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${
                    isUser ? 'text-slate-300' : 'text-teal-700'
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
            <div className="rounded-[1.75rem] border border-white/80 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur">
              Thinking…
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
