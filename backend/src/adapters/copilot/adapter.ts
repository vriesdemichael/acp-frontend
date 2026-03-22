import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import {
  EventType,
  type BaseEvent,
  type TextMessageContentEvent,
  type TextMessageStartEvent,
} from '@ag-ui/core'
import type { ContentBlock, McpServer, SessionNotification } from '@agentclientprotocol/sdk'
import { StreamTranslator } from '../../agui/index.js'
import type {
  BackendEndpointSupport,
  SessionAdapter,
  SessionDetails,
  SessionMessage,
  SessionProjectContext,
  SessionSummary,
} from '../../agents/types.js'
import { deriveEndpointSupport } from '../shared/capabilities.js'
import type { CopilotProcess } from './process.js'
import type { SessionState } from './types.js'

export interface ProcessHandlers {
  onExit: (code: number | null) => void
  onSessionUpdate: (notification: SessionNotification) => void
}

export type ProcessFactory = (handlers: ProcessHandlers) => CopilotProcess

export class CopilotAdapter implements SessionAdapter {
  private readonly sessions = new Map<string, SessionState>()
  readonly events = new EventEmitter()
  readonly agentId = 'copilot'
  readonly agentName = 'GitHub Copilot'
  private lastKnownEndpointSupport: BackendEndpointSupport = deriveEndpointSupport(null)

  constructor(private readonly createProcess: ProcessFactory) {}

  async newSession(
    project: SessionProjectContext | null,
    mcpServers: McpServer[] = []
  ): Promise<string> {
    const sessionId = randomUUID()

    const proc = this.createProcess({
      onExit: (code) => {
        this.sessions.delete(sessionId)
        for (const ev of new StreamTranslator(sessionId, 'subprocess-exit').onRunError(
          `Copilot process exited with code ${String(code)}`
        )) {
          this.events.emit(sessionId, ev)
        }
      },
      onSessionUpdate: (notification) => {
        this.handleSessionNotification(sessionId, notification)
      },
    })

    const client = await proc.start()
    const initializeResponse = await client.initialize()
    this.lastKnownEndpointSupport = deriveEndpointSupport(initializeResponse)
    const createdSession = await client.newSession({
      cwd: project?.path ?? process.cwd(),
      mcpServers,
    })

    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: 'New chat',
      project,
      agentProcess: proc,
      acpClient: client,
      acpSessionId: createdSession.sessionId,
      initializeResponse,
      mcpServers,
      firstMessageSent: false,
      pendingEvents: [],
      lastPromptResponse: null,
      forwardUpdate: null,
      messages: [],
    })

    return sessionId
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    this.pushUserMessage(session, text)

    const runId = randomUUID()
    const translator = new StreamTranslator(sessionId, runId)
    const emit = (events: BaseEvent[]) => {
      this.applyEvents(session, events)
      for (const ev of events) this.events.emit(sessionId, ev)
    }

    emit(translator.onRunStart())

    try {
      session.forwardUpdate = (notification) => {
        emit(translator.onSessionUpdate(notification.update))
      }

      const result = await session.acpClient.prompt({
        sessionId: session.acpSessionId,
        prompt: [{ type: 'text', text }] satisfies ContentBlock[],
      })

      session.lastPromptResponse = result
      emit(translator.onRunFinish())
    } catch (err: unknown) {
      emit(translator.onRunError(err instanceof Error ? err.message : String(err)))
    } finally {
      session.forwardUpdate = null
      session.pendingEvents = []
    }
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    void session?.acpClient.close()
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

  getEndpointSupport(): BackendEndpointSupport {
    return this.lastKnownEndpointSupport
  }

  ownsSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  private handleSessionNotification(sessionId: string, notification: SessionNotification): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    if (session.forwardUpdate) {
      session.forwardUpdate(notification)
      return
    }

    session.pendingEvents.push(notification)
  }

  private toSessionSummary(session: SessionState): SessionSummary {
    return {
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt.toISOString(),
      agentId: this.agentId,
      project: session.project,
      source: 'live',
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
