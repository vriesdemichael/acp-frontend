import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import type { ChatMessage } from '../../hooks/useAgUiChat.js'
import { parseUnifiedDiff } from './parseUnifiedDiff.js'
import { StructuredAssistantMessage } from './StructuredAssistantMessage.js'
import { ChatWelcomeState } from './ChatWelcomeState.js'

const SCROLL_BOTTOM_THRESHOLD = 120

interface ChatTranscriptProps {
  activeAgentName: string
  canManageProjects?: boolean
  canStartSession?: boolean
  hasAnyProject?: boolean
  hasAvailableAgent?: boolean
  hasAvailableProject?: boolean
  messages: ChatMessage[]
  projectPath?: string | null
  sessionId?: string | null
  hasSession: boolean
  loading: boolean
  historyLoading?: boolean
  streamReconnecting?: boolean
  onOpenProjectManager?: () => void
  onStartSession?: () => void
  ready: boolean
  thinking: boolean
  errorMessage: string | null
}

export function ChatTranscript({
  activeAgentName,
  canManageProjects = false,
  canStartSession = false,
  hasAnyProject = true,
  hasAvailableAgent = true,
  hasAvailableProject = true,
  messages,
  projectPath = null,
  sessionId = null,
  hasSession,
  loading,
  historyLoading = false,
  streamReconnecting = false,
  onOpenProjectManager,
  onStartSession,
  ready,
  thinking,
  errorMessage,
}: ChatTranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  const updateScrollState = useCallback(() => {
    const element = transcriptRef.current
    if (!element) return

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    const nearBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD

    shouldStickToBottomRef.current = nearBottom
    setShowJumpToLatest(!nearBottom && messages.length > 0)
  }, [messages.length])

  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const element = transcriptRef.current
    if (!element) return

    element.scrollTo({ top: element.scrollHeight, behavior })
    shouldStickToBottomRef.current = true
    setShowJumpToLatest(false)
  }

  useEffect(() => {
    if (!sessionId) return

    const frame = window.requestAnimationFrame(() => {
      scrollToLatest('auto')
    })

    return () => window.cancelAnimationFrame(frame)
  }, [sessionId])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (shouldStickToBottomRef.current) {
        scrollToLatest(messages.length > 0 ? 'smooth' : 'auto')
      } else {
        updateScrollState()
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [messages, thinking, updateScrollState])

  return (
    <div
      ref={transcriptRef}
      data-testid="chat-transcript"
      onScroll={updateScrollState}
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#070b12] px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
    >
      <div className="mx-auto flex min-h-full min-w-0 w-full max-w-5xl flex-col gap-6">
        {loading && !errorMessage && (
          <section className="rounded-[1.75rem] border border-amber-500/20 bg-amber-500/10 px-5 py-6 text-sm text-amber-100 shadow-sm">
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

        {historyLoading && hasSession && !loading && !errorMessage ? (
          <section
            data-testid="history-loading-banner"
            className="sticky top-3 z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-full border border-sky-500/18 bg-slate-950/90 px-4 py-3 text-sm text-sky-100 shadow-[0_10px_30px_rgba(15,23,42,0.35)] backdrop-blur relative"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(125,211,252,0.14),transparent)] animate-pulse" />
            <div className="relative z-10 flex items-center justify-center gap-3 text-center">
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">
                  Loading History
                </p>
                <p className="mt-1 text-sm text-slate-100">
                  Restoring the full conversation while keeping the current transcript in view.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {streamReconnecting && hasSession && !loading && !errorMessage && !historyLoading ? (
          <section
            data-testid="stream-reconnecting-banner"
            className="sticky top-3 z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-full border border-teal-500/18 bg-slate-950/90 px-4 py-3 text-sm text-teal-100 shadow-[0_10px_30px_rgba(15,23,42,0.35)] backdrop-blur relative"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(45,212,191,0.14),transparent)] animate-pulse" />
            <div className="relative z-10 flex items-center justify-center gap-3 text-center">
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-teal-300" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300/80">
                  Reconnecting Stream
                </p>
                <p className="mt-1 text-sm text-slate-100">
                  Live updates dropped for a moment. Rejoining the session stream now.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {errorMessage && (
          <section
            role="alert"
            className="rounded-[1.75rem] border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-100 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">
              Attention
            </p>
            <p className="mt-3 text-base font-medium text-slate-50">{errorMessage}</p>
          </section>
        )}

        {ready && messages.length === 0 && (
          <section className="rounded-[2rem] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(6,10,18,0.92))] px-5 py-9 text-center shadow-sm sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Transcript
            </p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-4xl text-slate-50">
              Start the conversation
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              Ask {activeAgentName} to inspect code, explain a failure, or sketch a next step for
              the current workspace.
            </p>
          </section>
        )}

        {!loading && messages.length === 0 && !hasSession && (
          <ChatWelcomeState
            activeAgentName={activeAgentName}
            canStartSession={canStartSession}
            hasAnyProject={hasAnyProject}
            hasAvailableProject={hasAvailableProject}
            hasAvailableAgent={hasAvailableAgent}
            onStartSession={onStartSession}
            onOpenProjectManager={canManageProjects ? onOpenProjectManager : undefined}
          />
        )}

        {buildTranscriptRuns(messages).map((run, index) =>
          run.kind === 'user' ? (
            <article key={`user-${run.message.id}-${index}`} className="flex min-w-0 justify-end">
              <div className="min-w-0 max-w-[92%] rounded-[1.6rem] bg-teal-500 px-4 py-3.5 text-slate-950 shadow-sm sm:max-w-[82%] lg:max-w-[72%]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-950/70">
                  You
                </p>
                {run.message.content ? (
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7">
                    {run.message.content}
                  </p>
                ) : null}
                {run.message.structuredBlocks?.length ? (
                  <div className="mt-3">
                    <StructuredAssistantMessage blocks={run.message.structuredBlocks} />
                  </div>
                ) : null}
                <TurnFooter
                  message={run.message}
                  compact
                  projectPath={projectPath}
                  sessionId={sessionId}
                />
              </div>
            </article>
          ) : (
            <article key={`assistant-${index}`} className="flex min-w-0 justify-start">
              <div className="w-full max-w-4xl px-4 py-3.5 text-slate-100">
                {buildAssistantNodes(run.messages).map((node, nodeIndex) =>
                  node.kind === 'structured' ? (
                    <div key={`structured-${nodeIndex}`} className={nodeIndex === 0 ? '' : 'mt-4'}>
                      <StructuredAssistantMessage
                        blocks={node.blocks}
                        summaryTitle={node.summaryTitle}
                        projectPath={projectPath}
                      />
                    </div>
                  ) : (
                    <div
                      key={`markdown-${nodeIndex}`}
                      className={`${nodeIndex === 0 ? '' : 'mt-4'} min-w-0 text-[15px] leading-7 text-slate-100`}
                    >
                      <AssistantMarkdown content={node.content} />
                    </div>
                  )
                )}
                <TurnFooter
                  message={run.messages.at(-1) ?? null}
                  turnInfoOverride={aggregateAssistantTurnInfo(run.messages)}
                  projectPath={projectPath}
                  sessionId={sessionId}
                />
              </div>
            </article>
          )
        )}

        {thinking && (
          <div className="flex justify-start" aria-live="polite">
            <div className="rounded-[1.4rem] border border-teal-500/15 bg-slate-900/95 px-4 py-3 text-sm text-slate-300 shadow-sm backdrop-blur">
              Thinking…
            </div>
          </div>
        )}

        {showJumpToLatest ? (
          <div className="sticky bottom-4 flex justify-center">
            <button
              type="button"
              onClick={() => scrollToLatest('auto')}
              className="inline-flex items-center justify-center rounded-full border border-teal-500/30 bg-slate-950/90 px-4 py-2 text-sm font-medium text-teal-100 shadow-[0_12px_30px_rgba(2,6,23,0.45)] backdrop-blur transition hover:bg-slate-900"
            >
              Jump to latest
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function firstLine(value: string): string | null {
  const line = value
    .split('\n')
    .map((part) => part.trim())
    .find(Boolean)

  return line ?? null
}

type TranscriptRun =
  | { kind: 'user'; message: ChatMessage }
  | { kind: 'assistant'; messages: ChatMessage[] }

type AssistantNode =
  | {
      kind: 'structured'
      blocks: NonNullable<ChatMessage['structuredBlocks']>
      summaryTitle: string | null
    }
  | { kind: 'markdown'; content: string }

function buildTranscriptRuns(messages: ChatMessage[]): TranscriptRun[] {
  const runs: TranscriptRun[] = []

  for (const message of messages) {
    if (message.role === 'user') {
      runs.push({ kind: 'user', message })
      continue
    }

    const lastRun = runs.at(-1)
    if (lastRun?.kind === 'assistant') {
      lastRun.messages.push(message)
      continue
    }

    runs.push({ kind: 'assistant', messages: [message] })
  }

  return runs
}

function aggregateAssistantTurnInfo(messages: ChatMessage[]): ChatMessage['turnInfo'] | undefined {
  const infos = messages.map((message) => message.turnInfo).filter(Boolean)
  if (infos.length === 0) {
    return undefined
  }

  const startedAtMs = infos.reduce<number | undefined>((value, info) => {
    if (info?.startedAtMs === undefined) {
      return value
    }

    return value === undefined ? info.startedAtMs : Math.min(value, info.startedAtMs)
  }, undefined)

  const completedAtMs = infos.reduce<number | undefined>((value, info) => {
    if (info?.completedAtMs === undefined) {
      return value
    }

    return value === undefined ? info.completedAtMs : Math.max(value, info.completedAtMs)
  }, undefined)

  const modifiedFiles = Array.from(new Set(infos.flatMap((info) => info?.modifiedFiles ?? [])))
  const patches = infos.flatMap((info) => info?.patches ?? [])
  const latest = infos.at(-1)

  return {
    providerId: latest?.providerId,
    modelId: latest?.modelId,
    mode: latest?.mode,
    startedAtMs,
    completedAtMs,
    durationMs:
      startedAtMs !== undefined && completedAtMs !== undefined
        ? completedAtMs - startedAtMs
        : undefined,
    modifiedFiles,
    patches,
  }
}

function buildAssistantNodes(messages: ChatMessage[]): AssistantNode[] {
  const nodes: AssistantNode[] = []

  for (const message of messages) {
    const blocks = message.structuredBlocks ?? []
    const summary = firstLine(message.content)
    const contentWithoutSummary =
      blocks.length > 0 && summary ? stripLeadingSummary(message.content, summary) : message.content

    if (blocks.length > 0) {
      const previous = nodes.at(-1)
      if (previous?.kind === 'structured') {
        previous.blocks.push(...blocks)
        if (!previous.summaryTitle && summary) {
          previous.summaryTitle = summary
        }
      } else {
        nodes.push({ kind: 'structured', blocks: [...blocks], summaryTitle: summary })
      }
    }

    if (contentWithoutSummary.trim()) {
      const previous = nodes.at(-1)
      if (previous?.kind === 'markdown') {
        previous.content = `${previous.content.trimEnd()}\n\n${contentWithoutSummary.trim()}`
      } else {
        nodes.push({ kind: 'markdown', content: contentWithoutSummary.trim() })
      }
    }
  }

  return nodes
}

function stripLeadingSummary(content: string, summary: string): string {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith(summary)) {
    return content
  }

  return trimmed.slice(summary.length).trimStart()
}

function CodeBlock({ language, children }: { language: string | null; children: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="group relative mt-3 overflow-hidden rounded-xl border border-white/8 bg-[#05070b] text-[13px] leading-6">
      <div className="flex items-center justify-between border-b border-white/6 bg-slate-900/60 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {language ?? 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language ?? 'text'}
        style={atomOneDark}
        customStyle={{
          margin: 0,
          padding: '0.75rem',
          background: 'transparent',
          fontSize: 'inherit',
          lineHeight: 'inherit',
        }}
        codeTagProps={{ style: { fontFamily: 'inherit' } }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ ...props }) => (
          <a
            {...props}
            className="text-teal-300 underline decoration-teal-500/40 underline-offset-2"
          />
        ),
        blockquote: ({ ...props }) => (
          <blockquote {...props} className="border-l-2 border-teal-500/35 pl-4 text-slate-300" />
        ),
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className ?? '')
          const isBlock = Boolean(className)
          if (!isBlock) {
            return (
              <code
                {...props}
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.92em] text-teal-200"
              >
                {children}
              </code>
            )
          }
          return (
            <CodeBlock language={match ? match[1] : null}>
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          )
        },
        h1: ({ ...props }) => (
          <h1 {...props} className="mt-5 text-2xl font-semibold text-slate-50 first:mt-0" />
        ),
        h2: ({ ...props }) => (
          <h2 {...props} className="mt-5 text-xl font-semibold text-slate-50 first:mt-0" />
        ),
        h3: ({ ...props }) => (
          <h3 {...props} className="mt-4 text-lg font-semibold text-slate-100 first:mt-0" />
        ),
        li: ({ ...props }) => (
          <li {...props} className="ml-5 list-disc pl-1 marker:text-slate-500" />
        ),
        ol: ({ ...props }) => <ol {...props} className="space-y-1" />,
        p: ({ ...props }) => <p {...props} className="mt-3 first:mt-0 whitespace-pre-wrap" />,
        pre: ({ children }) => <>{children}</>,
        table: ({ ...props }) => (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/8">
            <table {...props} className="min-w-full border-collapse text-sm" />
          </div>
        ),
        td: ({ ...props }) => (
          <td {...props} className="border-t border-white/8 px-3 py-2 text-slate-300" />
        ),
        th: ({ ...props }) => (
          <th {...props} className="bg-slate-900/90 px-3 py-2 text-left text-slate-100" />
        ),
        ul: ({ ...props }) => <ul {...props} className="space-y-1" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function TurnFooter({
  message,
  compact = false,
  projectPath = null,
  sessionId = null,
  turnInfoOverride,
}: {
  message: ChatMessage | null
  compact?: boolean
  projectPath?: string | null
  sessionId?: string | null
  turnInfoOverride?: ChatMessage['turnInfo']
}) {
  const [showFiles, setShowFiles] = useState(false)
  const [diffByHash, setDiffByHash] = useState<Record<string, string>>({})
  const [diffErrorByHash, setDiffErrorByHash] = useState<Record<string, string>>({})
  const [visibleDiffHashes, setVisibleDiffHashes] = useState<Record<string, boolean>>({})
  const [loadingHash, setLoadingHash] = useState<string | null>(null)
  const turnInfo = turnInfoOverride ?? message?.turnInfo
  const modifiedFiles = turnInfo?.modifiedFiles ?? []
  const patches = turnInfo?.patches ?? []
  const chipClass = compact
    ? 'border border-teal-950/20 text-teal-950/80'
    : 'border border-white/10 text-slate-200'
  const showCopy = !compact && Boolean(message?.content)
  const patchLabel = formatPatchLabel(patches.length, modifiedFiles.length)

  const loadPatchDiff = async (hash: string, nextHash: string) => {
    if (!sessionId || loadingHash === hash) {
      return
    }

    if (diffByHash[hash] !== undefined) {
      setVisibleDiffHashes((current) => ({ ...current, [hash]: true }))
      return
    }

    setLoadingHash(hash)
    setDiffErrorByHash((current) => {
      const next = { ...current }
      delete next[hash]
      return next
    })
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/patch-diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromHash: hash, toHash: nextHash }),
      })
      if (!response.ok) {
        throw new Error(`Patch diff request failed with status ${response.status}`)
      }

      const payload = (await response.json()) as { diff: string }
      setDiffByHash((current) => ({ ...current, [hash]: payload.diff }))
      setVisibleDiffHashes((current) => ({ ...current, [hash]: true }))
    } catch (error) {
      console.error('[ChatTranscript] patch diff load failed:', error)
      setDiffErrorByHash((current) => ({ ...current, [hash]: 'Unable to load this patch diff.' }))
    } finally {
      setLoadingHash((current) => (current === hash ? null : current))
    }
  }

  const togglePatchDiff = (hash: string, nextHash: string) => {
    if (visibleDiffHashes[hash]) {
      setVisibleDiffHashes((current) => ({ ...current, [hash]: false }))
      return
    }

    void loadPatchDiff(hash, nextHash)
  }

  if (!turnInfo && modifiedFiles.length === 0 && patches.length === 0) {
    return null
  }

  return (
    <div
      className={`${compact ? 'mt-3 border-teal-950/20 pt-2 text-teal-950/70' : 'mt-5 border-white/8 pt-3 text-slate-400'} border-t text-xs`}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
        {compact ? 'Turn Input' : 'Turn Outcome'}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {modifiedFiles.length > 0 || patches.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowFiles((value) => !value)}
              aria-expanded={showFiles}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipClass}`}
            >
              <span className="h-4 w-0.5 rounded bg-amber-400" />
              <span>{patchLabel}</span>
              <span className="text-[10px] uppercase tracking-[0.14em]">
                {showFiles ? 'Hide' : 'Show'}
              </span>
            </button>
          ) : null}
          {turnInfo?.providerId ? <span>{turnInfo.providerId}</span> : null}
          {turnInfo?.modelId ? <span>{turnInfo.modelId}</span> : null}
          {turnInfo?.mode ? <span>{turnInfo.mode} mode</span> : null}
          {turnInfo?.durationMs ? <span>{formatDuration(turnInfo.durationMs)}</span> : null}
        </div>

        {showCopy ? (
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(message?.content ?? '')}
            className={`rounded-full px-3 py-1 ${chipClass}`}
          >
            Copy
          </button>
        ) : null}
      </div>

      {showFiles && (modifiedFiles.length > 0 || patches.length > 0) ? (
        <div
          className={`${compact ? 'mt-3 border-teal-950/15 bg-teal-50/20 text-teal-950/85' : 'mt-4 border-white/8 bg-slate-900/55 text-slate-200'} w-full rounded-xl border px-3 py-3`}
        >
          {patches.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Patch Summary</p>
              <div className="space-y-3">
                {patches.map((patch, index) => (
                  <div
                    key={patch.hash || `patch-${index}`}
                    className="rounded-lg border border-current/10 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] opacity-80">
                      <span>Patch {index + 1}</span>
                      {patch.hash ? (
                        <code className="rounded bg-black/10 px-1.5 py-0.5 normal-case tracking-normal">
                          {shortHash(patch.hash)}
                        </code>
                      ) : null}
                      {patch.additions !== undefined || patch.deletions !== undefined ? (
                        <span className="normal-case tracking-normal opacity-90">
                          {formatPatchDelta(patch.additions, patch.deletions)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      {patch.files.map((file) => (
                        <div key={`${patch.hash}-${file}`} className="flex items-start gap-3">
                          <span className="mt-1.5 h-4 w-0.5 rounded bg-amber-400" />
                          <code className="break-all rounded bg-black/10 px-1.5 py-0.5 font-mono text-[12px]">
                            {relativizeFile(file, projectPath)}
                          </code>
                        </div>
                      ))}
                    </div>
                    {patch.nextHash ? (
                      <div className="mt-3">
                        {diffErrorByHash[patch.hash] ? (
                          <p className="mb-2 text-[11px] text-rose-200/85">
                            {diffErrorByHash[patch.hash]}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => togglePatchDiff(patch.hash, patch.nextHash ?? '')}
                          disabled={loadingHash === patch.hash}
                          className="rounded-full border border-current/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] opacity-90 disabled:opacity-50"
                        >
                          {loadingHash === patch.hash
                            ? 'Loading diff'
                            : visibleDiffHashes[patch.hash]
                              ? 'Hide diff'
                              : diffErrorByHash[patch.hash]
                                ? 'Retry diff'
                                : diffByHash[patch.hash] !== undefined
                                  ? 'Show diff'
                                  : 'View diff'}
                        </button>
                        {visibleDiffHashes[patch.hash] && diffByHash[patch.hash] !== undefined ? (
                          <div className="mt-3 overflow-hidden rounded-lg border border-current/10 bg-black/10">
                            <InlinePatchDiff diff={diffByHash[patch.hash]} />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                Modified Files
              </p>
              <div className="mt-3 space-y-2 text-sm">
                {modifiedFiles.map((file) => (
                  <div key={file} className="flex items-start gap-3">
                    <span className="mt-1.5 h-4 w-0.5 rounded bg-amber-400" />
                    <code className="break-all rounded bg-black/10 px-1.5 py-0.5 font-mono text-[12px]">
                      {relativizeFile(file, projectPath)}
                    </code>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

function formatPatchLabel(patchCount: number, modifiedFileCount: number): string {
  if (patchCount > 0) {
    return `Modified ${modifiedFileCount} file${modifiedFileCount === 1 ? '' : 's'} across ${patchCount} patch${patchCount === 1 ? '' : 'es'}`
  }

  return `Modified ${modifiedFileCount} file${modifiedFileCount === 1 ? '' : 's'}`
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`
  }

  return `${(durationMs / 1000).toFixed(1)}s`
}

function relativizeFile(file: string, projectPath?: string | null): string {
  if (!projectPath || !file.startsWith(projectPath)) {
    return file
  }

  return `.${file.slice(projectPath.length)}`
}

function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

function formatPatchDelta(additions?: number, deletions?: number): string {
  const added = additions ?? 0
  const removed = deletions ?? 0
  return `+${added} -${removed}`
}

function InlinePatchDiff({ diff }: { diff: string }) {
  const parsedFiles = parseUnifiedDiff(diff)

  if (parsedFiles.length === 0) {
    return (
      <pre className="overflow-x-auto px-3 py-3 text-[11px] leading-6 text-slate-200">
        <code>{diff || 'Diff unavailable.'}</code>
      </pre>
    )
  }

  return (
    <div className="space-y-3 px-3 py-3">
      {parsedFiles.map((file) => (
        <div
          key={file.header}
          className="overflow-hidden rounded-lg border border-white/8 bg-slate-950/60"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-3 py-2">
            <p className="break-all text-xs font-semibold text-slate-100">{file.displayPath}</p>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                +{file.additions}
              </span>
              <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-rose-200">
                -{file.deletions}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto font-mono text-[11px] leading-5">
            {file.hunks.map((hunk) => (
              <div key={`${file.header}-${hunk.header}`}>
                <div className="bg-slate-900/70 px-3 py-1.5 text-[10px] text-sky-200">
                  {hunk.header}
                </div>
                {hunk.lines.map((line, index) => (
                  <div
                    key={`${hunk.header}-${index}`}
                    className={
                      line.kind === 'addition'
                        ? 'bg-emerald-500/8 px-3 py-1 text-emerald-50'
                        : line.kind === 'deletion'
                          ? 'bg-rose-500/8 px-3 py-1 text-rose-50'
                          : line.kind === 'note'
                            ? 'bg-slate-900/90 px-3 py-1 italic text-slate-500'
                            : 'bg-slate-950/30 px-3 py-1 text-slate-200'
                    }
                  >
                    <span className="mr-2 text-slate-500">
                      {line.kind === 'addition'
                        ? '+'
                        : line.kind === 'deletion'
                          ? '-'
                          : line.kind === 'note'
                            ? '\\'
                            : ' '}
                    </span>
                    {line.content || ' '}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
