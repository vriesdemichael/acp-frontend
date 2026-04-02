import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { StreamEvent } from '../stream-events.js'
import type { BaseStreamEvent } from '../stream-events.js'
import type {
  BackendEndpointSupport,
  SessionAdapter,
  SessionDetails,
  SessionMessage,
  SessionProjectContext,
  SessionSummary,
} from '../agents/types.js'

interface FakeSessionState {
  id: string
  title: string
  updatedAt: Date
  project: SessionProjectContext | null
  messages: SessionDetails['messages']
}

const TEST_ENDPOINT_SUPPORT: BackendEndpointSupport = {
  source: 'connection',
  implemented: ['session/new', 'session/prompt', 'session/update', 'session/list'],
  unknown: ['session/resume'],
}

export class FakeSessionAdapter implements SessionAdapter {
  readonly agentId: string
  readonly agentName: string
  readonly events = new EventEmitter()
  private readonly sessions = new Map<string, FakeSessionState>()

  constructor(agentId: string, agentName: string) {
    this.agentId = agentId
    this.agentName = agentName
  }

  getEndpointSupport(): BackendEndpointSupport {
    return TEST_ENDPOINT_SUPPORT
  }

  ownsSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  async newSession(project: SessionProjectContext | null): Promise<string> {
    const sessionNumber = this.sessions.size + 1
    const sessionId = `session-${sessionNumber}`
    this.sessions.set(sessionId, {
      id: sessionId,
      title: `Session session-${sessionNumber}`,
      updatedAt: new Date(),
      project,
      messages: [],
    })
    return sessionId
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    session.messages.push({ id: `user-${randomUUID()}`, role: 'user', content: text })
    if (session.title.startsWith('Session session-')) {
      const compactText = text.trim().replace(/\s+/g, ' ')
      session.title = compactText.length <= 48 ? compactText : `${compactText.slice(0, 45)}...`
    }

    const assistantMessageId = `assistant-${randomUUID()}`
    const reply = `Acknowledged: ${text}`
    const streamEvents: BaseStreamEvent[] = [
      { type: StreamEvent.RUN_STARTED, threadId: sessionId, runId: randomUUID() },
      { type: StreamEvent.TEXT_MESSAGE_START, messageId: assistantMessageId, role: 'assistant' },
      { type: StreamEvent.TEXT_MESSAGE_CONTENT, messageId: assistantMessageId, delta: reply },
      { type: StreamEvent.TEXT_MESSAGE_END, messageId: assistantMessageId },
      { type: StreamEvent.RUN_FINISHED, threadId: sessionId, runId: randomUUID() },
    ]

    session.messages.push({ id: assistantMessageId, role: 'assistant', content: reply })
    session.updatedAt = new Date()

    queueMicrotask(() => {
      for (const event of streamEvents) {
        this.events.emit(sessionId, event)
      }
    })
  }

  async sendHandoff(sessionId: string, messages: SessionMessage[]): Promise<void> {
    // In the fake adapter, treat a handoff like a regular message summarising the history.
    const summary = `[Handoff] Received ${String(messages.length)} prior message(s).`
    await this.sendMessage(sessionId, summary)
  }

  closeSession(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.events.removeAllListeners(sessionId)
  }

  reset(): void {
    for (const sessionId of this.sessions.keys()) {
      this.events.removeAllListeners(sessionId)
    }

    this.sessions.clear()
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
      modelState: null,
    }
  }

  private toSessionSummary(session: FakeSessionState): SessionSummary {
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
