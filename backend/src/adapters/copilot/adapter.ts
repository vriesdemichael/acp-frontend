import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import {
  EventType,
  type BaseEvent,
  type TextMessageContentEvent,
  type TextMessageStartEvent,
} from '@ag-ui/core'
import type { Client, MessagePart } from 'acp-sdk'
import { StreamTranslator } from '../../agui/index.js'
import type {
  SessionAdapter,
  SessionDetails,
  SessionMessage,
  SessionSummary,
} from '../../agents/types.js'
import type { CopilotProcess } from './process.js'
import type { SessionState } from './types.js'

export type ProcessFactory = (onExit: (code: number | null) => void) => CopilotProcess
export type ClientFactory = (port: number) => Client

export class CopilotAdapter implements SessionAdapter {
  private readonly sessions = new Map<string, SessionState>()
  /** EventEmitter used to push AG-UI events to the SSE stream endpoint. */
  readonly events = new EventEmitter()
  readonly agentId = 'copilot'
  readonly agentName = 'GitHub Copilot'

  constructor(
    private readonly createProcess: ProcessFactory,
    private readonly createClient: ClientFactory
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
        `Copilot process exited with code ${String(code)}`
      )) {
        this.events.emit(sessionId, ev)
      }
    })

    await proc.start()

    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: 'New chat',
      agentProcess: proc,
      mcpServers,
      firstMessageSent: false,
      messages: [],
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

    this.pushUserMessage(session, text)

    const client = this.createClient(session.agentProcess.port!)
    const input = this.buildInput(session, text)

    // Mark that the first message has been sent (so mcpServers are not re-injected)
    session.firstMessageSent = true

    const runId = randomUUID()
    const translator = new StreamTranslator(sessionId, runId)

    const emit = (events: BaseEvent[]) => {
      this.applyEvents(session, events)
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

  listSessions(): SessionSummary[] {
    return Array.from(this.sessions.values())
      .map((session) => this.toSessionSummary(session))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  getSession(sessionId: string): SessionDetails | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    return {
      ...this.toSessionSummary(session),
      messages: session.messages.map((message) => ({ ...message })),
    }
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

  private toSessionSummary(session: SessionState): SessionSummary {
    return {
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt.toISOString(),
      agentId: this.agentId,
    }
  }

  private pushUserMessage(session: SessionState, text: string): void {
    session.messages.push({
      id: `user-${randomUUID()}`,
      role: 'user',
      content: text,
    })
    session.updatedAt = new Date()

    if (session.title === 'New chat') {
      session.title = deriveSessionTitle(text)
    }
  }

  private applyEvents(session: SessionState, events: BaseEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case EventType.TEXT_MESSAGE_START: {
          const startEvent = event as TextMessageStartEvent
          session.messages.push({
            id: startEvent.messageId,
            role: 'assistant',
            content: '',
          })
          session.updatedAt = new Date()
          break
        }

        case EventType.TEXT_MESSAGE_CONTENT: {
          const contentEvent = event as TextMessageContentEvent
          const assistantMessage = this.findOrCreateAssistantMessage(
            session.messages,
            contentEvent.messageId
          )
          assistantMessage.content += contentEvent.delta
          session.updatedAt = new Date()
          break
        }

        default:
          break
      }
    }
  }

  private findOrCreateAssistantMessage(
    messages: SessionMessage[],
    messageId: string
  ): SessionMessage {
    const existingMessage = messages.find((message) => message.id === messageId)

    if (existingMessage) {
      return existingMessage
    }

    const fallbackMessage: SessionMessage = {
      id: messageId,
      role: 'assistant',
      content: '',
    }
    messages.push(fallbackMessage)
    return fallbackMessage
  }
}

function deriveSessionTitle(text: string): string {
  const compactText = text.trim().replace(/\s+/g, ' ')
  if (compactText.length <= 48) return compactText
  return `${compactText.slice(0, 45).trimEnd()}...`
}
