import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import type { BaseEvent } from '@ag-ui/core'
import type { Client, MessagePart } from 'acp-sdk'
import { StreamTranslator } from '../../agui/index.js'
import type { CopilotProcess } from './process.js'
import type { SessionState } from './types.js'

export type ProcessFactory = (onExit: (code: number | null) => void) => CopilotProcess
export type ClientFactory = (port: number) => Client

export class CopilotAdapter {
  private readonly sessions = new Map<string, SessionState>()
  /** EventEmitter used to push AG-UI events to the SSE stream endpoint. */
  readonly events = new EventEmitter()

  constructor(
    private readonly createProcess: ProcessFactory,
    private readonly createClient: ClientFactory,
  ) {}

  /**
   * Spawn the Copilot CLI subprocess and register a new session.
   * mcpServers (from mcp.json) are stored and injected into the first ACP run
   * per ADR-003.
   */
  async newSession(mcpServers: Record<string, unknown> = {}): Promise<string> {
    const sessionId = randomUUID()

    const proc = this.createProcess((code) => {
      this.sessions.delete(sessionId)
      for (const ev of new StreamTranslator(sessionId, 'subprocess-exit').onRunError(
        `Copilot process exited with code ${String(code)}`,
      )) {
        this.events.emit(sessionId, ev)
      }
    })

    await proc.start()

    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date(),
      agentProcess: proc,
      mcpServers,
      firstMessageSent: false,
    })

    return sessionId
  }

  /**
   * Forward a user message to the Copilot ACP server and stream translated
   * AG-UI events onto `this.events` for the given sessionId.
   *
   * This method fires asynchronously — the caller does not need to await the
   * full stream; events arrive on the EventEmitter as they are produced.
   */
  async sendMessage(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session === undefined) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const client = this.createClient(session.agentProcess.port!)
    const input = this.buildInput(session, text)

    // Mark that the first message has been sent (so mcpServers are not re-injected)
    session.firstMessageSent = true

    const runId = randomUUID()
    const translator = new StreamTranslator(sessionId, runId)

    const emit = (events: BaseEvent[]) => {
      for (const ev of events) this.events.emit(sessionId, ev)
    }

    emit(translator.onRunStart())

    try {
      for await (const event of client.runStream('copilot', input)) {
        emit(translator.onAcpEvent(event))
      }
      emit(translator.onRunFinish())
    } catch (err: unknown) {
      emit(translator.onRunError(err instanceof Error ? err.message : String(err)))
    }
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    session?.agentProcess.stop()
    this.sessions.delete(sessionId)
    this.events.removeAllListeners(sessionId)
  }

  get sessionCount(): number {
    return this.sessions.size
  }

  /**
   * Build the ACP input for a run.
   * On the first message of a session, the mcpServers configuration is injected
   * as an additional JSON part per ADR-003.
   */
  private buildInput(session: SessionState, text: string): string | MessagePart[] {
    if (!session.firstMessageSent && Object.keys(session.mcpServers).length > 0) {
      // Inject mcpServers as a structured part per ADR-003. The MCP config
      // part is prepended so the ACP server can extract it at initialization time.
      return [
        {
          name: 'mcp-config',
          content_type: 'application/json',
          content_encoding: 'plain',
          content: JSON.stringify({ mcpServers: session.mcpServers }),
        } satisfies MessagePart,
        {
          content_type: 'text/plain',
          content_encoding: 'plain',
          content: text,
        } satisfies MessagePart,
      ]
    }
    return text
  }
}
