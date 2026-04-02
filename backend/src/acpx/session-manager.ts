import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { StreamTranslator } from '../agui/translate.js'
import { StreamEvent } from '../stream-events.js'
import type { BaseStreamEvent } from '../stream-events.js'
import type {
  SessionAdapter,
  SessionSummary,
  SessionDetails,
  SessionMessage,
  SessionProjectContext,
  BackendEndpointSupport,
} from '../agents/types.js'

/**
 * ACP NDJSON line shapes emitted by `acpx --format json`.
 * Only the fields we actually consume are typed; the rest are `unknown`.
 */
interface AcpxLine {
  type: string
  [key: string]: unknown
}

interface AcpxSessionState {
  id: string
  acpxSessionId: string | null
  agentCommand: string
  cwd: string
  title: string
  createdAt: Date
  updatedAt: Date
  project: SessionProjectContext | null
  messages: SessionMessage[]
  proc: ChildProcess | null
}

const ENDPOINT_SUPPORT: BackendEndpointSupport = {
  source: 'connection',
  implemented: ['session/new', 'session/prompt', 'session/update'],
  unknown: ['session/load', 'session/resume', 'session/fork'],
}

/**
 * SessionAdapter implementation backed by `acpx` subprocess.
 *
 * One AcpxSessionManager is created per configured agent. It shells out to
 * `acpx --format json <agentCommand> prompt` for live streaming and
 * `acpx <agentCommand> sessions new` to create sessions.
 */
export class AcpxSessionManager implements SessionAdapter {
  readonly agentId: string
  readonly agentName: string
  readonly events = new EventEmitter()
  private readonly sessions = new Map<string, AcpxSessionState>()

  constructor(
    agentId: string,
    agentName: string,
    private readonly agentCommand: string
  ) {
    this.agentId = agentId
    this.agentName = agentName
  }

  getEndpointSupport(): BackendEndpointSupport {
    return ENDPOINT_SUPPORT
  }

  ownsSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  async newSession(project: SessionProjectContext | null): Promise<string> {
    const sessionId = randomUUID()
    const cwd = project?.path ?? process.cwd()

    // Create an acpx session by running: acpx <agentCommand> sessions new --cwd <cwd>
    const acpxSessionId = await this.runAcpxNewSession(cwd)

    this.sessions.set(sessionId, {
      id: sessionId,
      acpxSessionId,
      agentCommand: this.agentCommand,
      cwd,
      title: 'New chat',
      createdAt: new Date(),
      updatedAt: new Date(),
      project,
      messages: [],
      proc: null,
    })

    return sessionId
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)

    this.pushUserMessage(session, text)

    const runId = randomUUID()
    const translator = new StreamTranslator(sessionId, runId)
    const emit = (events: BaseStreamEvent[]) => {
      this.applyEvents(session, events)
      for (const ev of events) this.events.emit(sessionId, ev)
    }

    emit(translator.onRunStart())

    try {
      await this.streamPrompt(session, text, (line) => {
        try {
          emit(
            translator.onSessionUpdate(
              line as unknown as Parameters<typeof translator.onSessionUpdate>[0]
            )
          )
        } catch {
          // Malformed or unexpected update shape — skip this line
        }
      })
      emit(translator.onRunFinish())
    } catch (err) {
      emit(translator.onRunError(err instanceof Error ? err.message : String(err)))
    }
  }

  async sendHandoff(sessionId: string, messages: SessionMessage[]): Promise<void> {
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const handoffPrompt =
      `[Context from a previous conversation being continued here]\n\n${transcript}\n\n` +
      `[End of previous conversation. Please acknowledge you have the context and are ready to continue.]`

    await this.sendMessage(sessionId, handoffPrompt)
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session?.proc && !session.proc.killed) {
      session.proc.kill('SIGTERM')
    }
    this.sessions.delete(sessionId)
    this.events.removeAllListeners(sessionId)
  }

  listSessions(): SessionSummary[] {
    return Array.from(this.sessions.values())
      .map((s) => this.toSummary(s))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  getSession(sessionId: string): SessionDetails | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return {
      ...this.toSummary(session),
      messages: session.messages.map((m) => ({ ...m })),
      modelState: null,
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Run `acpx <agentCommand> sessions new --cwd <cwd>` and parse the session id
   * from stdout. Returns null when acpx outputs no recognisable session id (e.g.
   * it is not installed), in which case we fall back to a local UUID so the
   * session can still be tracked in-process.
   */
  private async runAcpxNewSession(cwd: string): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn('acpx', [this.agentCommand, 'sessions', 'new', '--cwd', cwd], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      })

      let output = ''
      proc.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })

      proc.on('close', () => {
        // acpx prints a session id line, e.g. "session-id: <uuid>"
        const match = /session[- ]id:\s*(\S+)/i.exec(output) ?? /^(\S+)$/m.exec(output.trim())
        resolve(match ? (match[1] ?? null) : null)
      })

      proc.on('error', () => resolve(null))
    })
  }

  /**
   * Stream a prompt through `acpx --format json <agentCommand> prompt "<text>"`
   * and call `onLine` for each parsed ACP NDJSON line.
   */
  private async streamPrompt(
    session: AcpxSessionState,
    text: string,
    onLine: (line: AcpxLine) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['--format', 'json', this.agentCommand, 'prompt', text]
      if (session.acpxSessionId) {
        args.push('--session', session.acpxSessionId)
      }

      const proc = spawn('acpx', args, {
        cwd: session.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      })

      session.proc = proc

      proc.stderr?.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trim()
        if (line.length > 0) {
          console.debug(`[acpx/${this.agentCommand} stderr]`, line)
        }
      })

      if (!proc.stdout) {
        session.proc = null
        reject(new Error('acpx process has no stdout; spawn may have failed'))
        return
      }

      const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity })
      rl.on('line', (rawLine) => {
        const trimmed = rawLine.trim()
        if (!trimmed) return
        try {
          const parsed = JSON.parse(trimmed) as AcpxLine
          try {
            onLine(parsed)
          } catch (err) {
            // onLine callback threw — reject the promise and kill the process
            session.proc = null
            if (!proc.killed) proc.kill('SIGTERM')
            reject(err instanceof Error ? err : new Error(String(err)))
          }
        } catch {
          // Non-JSON diagnostic line — ignore
        }
      })

      proc.on('close', (code) => {
        session.proc = null
        if (code !== 0 && code !== null) {
          reject(new Error(`acpx exited with code ${String(code)}`))
        } else {
          resolve()
        }
      })

      proc.on('error', (err) => {
        session.proc = null
        reject(err)
      })
    })
  }

  private pushUserMessage(session: AcpxSessionState, text: string): void {
    session.messages.push({ id: `user-${randomUUID()}`, role: 'user', content: text })
    session.updatedAt = new Date()
    if (session.title === 'New chat') {
      session.title = deriveTitle(text)
    }
  }

  private applyEvents(session: AcpxSessionState, events: BaseStreamEvent[]): void {
    for (const event of events) {
      if (event.type === StreamEvent.TEXT_MESSAGE_START) {
        session.messages.push({
          id: event['messageId'] as string,
          role: 'assistant',
          content: '',
        })
        session.updatedAt = new Date()
      } else if (event.type === StreamEvent.TEXT_MESSAGE_CONTENT) {
        const msg = session.messages.find((m) => m.id === (event['messageId'] as string))
        if (msg) {
          msg.content += event['delta'] as string
          session.updatedAt = new Date()
        }
      } else if (event.type === StreamEvent.CUSTOM && event['name'] === 'a2ui:tool_call') {
        const payload = event['value'] as Record<string, unknown>
        const callId = typeof payload['callId'] === 'string' ? payload['callId'] : null
        const toolName = typeof payload['toolName'] === 'string' ? payload['toolName'] : null
        if (!callId || !toolName) continue

        const msgId = `assistant-tool-${callId}`
        let msg = session.messages.find((m) => m.id === msgId)
        if (!msg) {
          msg = { id: msgId, role: 'assistant', content: '' }
          session.messages.push(msg)
        }

        msg.structuredBlocks = upsertToolCallBlock(msg.structuredBlocks ?? [], {
          kind: 'tool_call',
          payload: {
            callId,
            toolName,
            args: payload['args'],
            result: typeof payload['result'] === 'string' ? payload['result'] : undefined,
            done: payload['done'] === true,
          },
        })
        session.updatedAt = new Date()
      }
    }
  }

  private toSummary(session: AcpxSessionState): SessionSummary {
    return {
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt.toISOString(),
      agentId: this.agentId,
      project: session.project,
      source: 'live',
    }
  }
}

function deriveTitle(text: string): string {
  const compact = text.trim().replace(/\s+/g, ' ')
  return compact.length <= 48 ? compact : `${compact.slice(0, 45).trimEnd()}...`
}

function upsertToolCallBlock(
  blocks: NonNullable<SessionMessage['structuredBlocks']>,
  next: NonNullable<SessionMessage['structuredBlocks']>[number]
): NonNullable<SessionMessage['structuredBlocks']> {
  const idx = blocks.findIndex(
    (b) =>
      b.kind === 'tool_call' &&
      next.kind === 'tool_call' &&
      b.payload.callId === next.payload.callId
  )
  if (idx === -1) return [...blocks, next]
  return blocks.map((b, i) => (i === idx ? next : b))
}
