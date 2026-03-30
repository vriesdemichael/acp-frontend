import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  HistorySourceDescriptor,
  SessionDetails,
  SessionMessage,
  SessionProjectContext,
  SessionSummary,
  StructuredBlock,
} from '../agents/types.js'

interface CopilotWorkspaceMeta {
  id?: string
  cwd?: string
  created_at?: string
  updated_at?: string
  summary?: string
}

interface CopilotUserMessageEvent {
  type: 'user.message'
  data?: {
    content?: string
  }
}

interface CopilotToolRequest {
  toolCallId?: string
  name?: string
  arguments?: unknown
}

interface CopilotAnyEvent {
  type: string
  id?: string
  timestamp?: string
  data?: Record<string, unknown>
}

interface VscodeChatSessionFile {
  sessionId?: string
  customTitle?: string
  lastMessageDate?: number
  requests?: Array<Record<string, unknown>>
}

interface CopilotSessionDescriptor {
  id: string
  cwd: string
  updatedAt: string
  title: string
  sourceType: 'cli_events' | 'vscode_chat'
  eventsFile?: string
  chatSessionFile?: string
  workspaceStorageRoot?: string
}

const COPILOT_SESSION_STATE_DIR =
  process.env['COPILOT_SESSION_STATE_DIR'] ?? join(homedir(), '.copilot', 'session-state')
const COPILOT_HISTORY_SESSION_STATE_DIR =
  process.env['COPILOT_HISTORY_SESSION_STATE_DIR'] ??
  join(homedir(), '.copilot', 'history-session-state')
const COPILOT_VSCODE_WORKSPACE_STORAGE_DIRS = process.env['COPILOT_VSCODE_WORKSPACE_STORAGE_DIRS']

// ─── Unified copilot provider (one logical backend) ──────────────────────────

/**
 * Discover ALL Copilot history sources: CLI (WSL + Host) and VS Code (Linux + Host).
 * Used by the single `copilot` history provider.
 *
 * @param historyPathHints VS Code workspace storage root paths
 * @param cliHistoryPathHints CLI session-state directory paths (WSL + Host)
 */
export function discoverCopilotHistorySources(
  historyPathHints: string[] = [],
  cliHistoryPathHints: string[] = []
) {
  return [
    ...discoverCopilotSourcesForIntegration(
      'copilot',
      knownCliWslRoots(cliHistoryPathHints),
      knownCliHostRoots(cliHistoryPathHints)
    ),
    ...discoverVscodeCopilotSources(historyPathHints, 'copilot'),
  ]
}

/**
 * Read sessions from ALL Copilot history sources (CLI + VS Code, WSL + Host).
 * Deduplicates by session id with CLI > VS Code precedence.
 *
 * @param historyPathHints VS Code workspace storage root paths
 * @param cliHistoryPathHints CLI session-state directory paths (WSL + Host)
 */
export function readCopilotSessions(
  knownProjects: SessionProjectContext[],
  historyPathHints: string[] = [],
  cliHistoryPathHints: string[] = []
) {
  const cliDescriptors = [
    ...listCliDescriptors(knownCliWslRoots(cliHistoryPathHints)),
    ...listCliDescriptors(knownCliHostRoots(cliHistoryPathHints)),
  ]
  const vscodeDescriptors = listVscodeCopilotSessionDescriptors(
    discoverWorkspaceStorageRoots(historyPathHints).map((r) => r.path)
  )

  // CLI wins over VS Code when the same session id appears in both
  const merged = dedupeByCliPrecedence(cliDescriptors, vscodeDescriptors)
  return readCopilotSessionsForIntegration('copilot', merged, knownProjects)
}

/**
 * Retrieve a single session from any Copilot source.
 *
 * @param historyPathHints VS Code workspace storage root paths
 * @param cliHistoryPathHints CLI session-state directory paths (WSL + Host)
 */
export function getCopilotSession(
  sessionId: string,
  knownProjects: SessionProjectContext[],
  historyPathHints: string[] = [],
  cliHistoryPathHints: string[] = []
) {
  const cliDescriptors = [
    ...listCliDescriptors(knownCliWslRoots(cliHistoryPathHints)),
    ...listCliDescriptors(knownCliHostRoots(cliHistoryPathHints)),
  ]
  const vscodeDescriptors = listVscodeCopilotSessionDescriptors(
    discoverWorkspaceStorageRoots(historyPathHints).map((r) => r.path)
  )
  const merged = dedupeByCliPrecedence(cliDescriptors, vscodeDescriptors)
  return getCopilotSessionForIntegration('copilot', sessionId, merged, knownProjects)
}

// ─── Per-integration functions (kept for internal use / legacy tests) ─────────

export function discoverCopilotCliWslHistorySources(cliHistoryPathHints: string[] = []) {
  return discoverCopilotSourcesForIntegration(
    'copilot-cli-wsl',
    knownCliWslRoots(cliHistoryPathHints),
    []
  )
}

export function discoverCopilotCliHostHistorySources(cliHistoryPathHints: string[] = []) {
  return discoverCopilotSourcesForIntegration(
    'copilot-cli-host',
    [],
    knownCliHostRoots(cliHistoryPathHints)
  )
}

export function discoverCopilotVscodeHostHistorySources(historyPathHints: string[] = []) {
  return discoverCopilotVscodeSourcesForIntegration(
    'copilot-vscode-host',
    'mounted_host',
    historyPathHints
  )
}

export function discoverCopilotVscodeWslHistorySources(historyPathHints: string[] = []) {
  return discoverCopilotVscodeSourcesForIntegration('copilot-vscode-wsl', 'linux', historyPathHints)
}

export function readCopilotCliWslSessions(
  knownProjects: SessionProjectContext[],
  cliHistoryPathHints: string[] = []
) {
  // This is a CLI-only function; pass no VS Code workspace storage hints.
  const descriptors = listCliDescriptors(knownCliWslRoots(cliHistoryPathHints))
  return readCopilotSessionsForIntegration('copilot-cli-wsl', descriptors, knownProjects)
}

export function readCopilotCliHostSessions(
  knownProjects: SessionProjectContext[],
  cliHistoryPathHints: string[] = []
) {
  return readCopilotSessionsForIntegration(
    'copilot-cli-host',
    listCliDescriptors(knownCliHostRoots(cliHistoryPathHints)),
    knownProjects
  )
}

export function readCopilotVscodeHostSessions(
  knownProjects: SessionProjectContext[],
  historyPathHints: string[] = []
) {
  return readCopilotSessionsForIntegration(
    'copilot-vscode-host',
    listVscodeCopilotSessionDescriptors(
      filteredWorkspaceRoots('mounted_host', historyPathHints).map((root) => root.path)
    ),
    knownProjects
  )
}

export function readCopilotVscodeWslSessions(
  knownProjects: SessionProjectContext[],
  historyPathHints: string[] = []
) {
  return readCopilotSessionsForIntegration(
    'copilot-vscode-wsl',
    listVscodeCopilotSessionDescriptors(
      filteredWorkspaceRoots('linux', historyPathHints).map((root) => root.path)
    ),
    knownProjects
  )
}

export function getCopilotCliWslSession(
  sessionId: string,
  knownProjects: SessionProjectContext[],
  cliHistoryPathHints: string[] = []
) {
  // This is a CLI-only function; pass no VS Code workspace storage hints.
  const descriptors = listCliDescriptors(knownCliWslRoots(cliHistoryPathHints))
  return getCopilotSessionForIntegration('copilot-cli-wsl', sessionId, descriptors, knownProjects)
}

export function getCopilotCliHostSession(
  sessionId: string,
  knownProjects: SessionProjectContext[],
  cliHistoryPathHints: string[] = []
) {
  return getCopilotSessionForIntegration(
    'copilot-cli-host',
    sessionId,
    listCliDescriptors(knownCliHostRoots(cliHistoryPathHints)),
    knownProjects
  )
}

export function getCopilotVscodeHostSession(
  sessionId: string,
  knownProjects: SessionProjectContext[],
  historyPathHints: string[] = []
) {
  return getCopilotSessionForIntegration(
    'copilot-vscode-host',
    sessionId,
    listVscodeCopilotSessionDescriptors(
      filteredWorkspaceRoots('mounted_host', historyPathHints).map((root) => root.path)
    ),
    knownProjects
  )
}

export function getCopilotVscodeWslSession(
  sessionId: string,
  knownProjects: SessionProjectContext[],
  historyPathHints: string[] = []
) {
  return getCopilotSessionForIntegration(
    'copilot-vscode-wsl',
    sessionId,
    listVscodeCopilotSessionDescriptors(
      filteredWorkspaceRoots('linux', historyPathHints).map((root) => root.path)
    ),
    knownProjects
  )
}

function dedupeByCliPrecedence(
  cliDescriptors: CopilotSessionDescriptor[],
  vscodeDescriptors: CopilotSessionDescriptor[]
): CopilotSessionDescriptor[] {
  const cliIds = new Set(cliDescriptors.map((d) => d.id))
  const vscodeOnly = vscodeDescriptors.filter((d) => !cliIds.has(d.id))
  return [...cliDescriptors, ...vscodeOnly]
}

function readSessionDescriptorMessages(descriptor: CopilotSessionDescriptor): SessionMessage[] {
  if (descriptor.sourceType === 'cli_events' && descriptor.eventsFile) {
    return readSessionMessages(descriptor.eventsFile)
  }

  if (descriptor.sourceType === 'vscode_chat' && descriptor.chatSessionFile) {
    return readVscodeChatSessionMessages(descriptor.chatSessionFile)
  }

  return []
}

function discoverCopilotSourcesForIntegration(
  backendId: string,
  cliWslRoots: string[],
  cliHostRoots: string[]
): HistorySourceDescriptor[] {
  return [
    ...cliWslRoots.flatMap((dir, index) =>
      discoverCopilotCliSource(dir, index === 0 ? 'cli_session_dir' : 'cli_history_dir', backendId)
    ),
    ...cliHostRoots.flatMap((dir, index) =>
      discoverCopilotCliSource(dir, index === 0 ? 'cli_session_dir' : 'cli_history_dir', backendId)
    ),
  ]
}

function discoverCopilotVscodeSourcesForIntegration(
  backendId: string,
  platform: 'linux' | 'mounted_host',
  historyPathHints: string[]
): HistorySourceDescriptor[] {
  return discoverVscodeCopilotSources(historyPathHints, backendId).filter(
    (source) => source.platform === platform
  )
}

function readCopilotSessionsForIntegration(
  backendId: string,
  descriptors: CopilotSessionDescriptor[],
  knownProjects: SessionProjectContext[]
): SessionSummary[] {
  const results: SessionSummary[] = []

  for (const descriptor of descriptors) {
    const project = resolveProject(descriptor.cwd, knownProjects)
    if (!project) {
      continue
    }

    const messages = readSessionDescriptorMessages(descriptor)
    if (messages.length === 0) {
      continue
    }

    results.push({
      id: descriptor.id,
      title: descriptor.title,
      updatedAt: descriptor.updatedAt,
      agentId: backendId,
      project,
      source: 'history',
    })
  }

  return results
}

function getCopilotSessionForIntegration(
  backendId: string,
  sessionId: string,
  descriptors: CopilotSessionDescriptor[],
  knownProjects: SessionProjectContext[]
): SessionDetails | null {
  for (const descriptor of descriptors) {
    if (descriptor.id !== sessionId) {
      continue
    }

    const project = resolveProject(descriptor.cwd, knownProjects)
    if (!project) {
      continue
    }

    return {
      id: sessionId,
      title: descriptor.title,
      updatedAt: descriptor.updatedAt,
      agentId: backendId,
      project,
      source: 'history',
      messages: readSessionDescriptorMessages(descriptor),
    }
  }

  return null
}

function knownCliWslRoots(cliHistoryPathHints: string[]): string[] {
  const hinted = cliHistoryPathHints.filter(
    (path) => path.startsWith('/') && !path.startsWith('/mnt/')
  )
  return hinted.length > 0 ? hinted : [COPILOT_SESSION_STATE_DIR, COPILOT_HISTORY_SESSION_STATE_DIR]
}

function knownCliHostRoots(cliHistoryPathHints: string[]): string[] {
  const hinted = cliHistoryPathHints.filter((path) => path.startsWith('/mnt/'))
  if (hinted.length > 0) {
    return hinted
  }

  const hostHome = join('/mnt/c/Users', process.env['USER'] ?? process.env['USERNAME'] ?? '')
  return [
    join(hostHome, '.copilot', 'session-state'),
    join(hostHome, '.copilot', 'history-session-state'),
  ]
}

function listCliDescriptors(baseDirs: string[]): CopilotSessionDescriptor[] {
  const descriptors = new Map<string, CopilotSessionDescriptor>()
  for (const baseDir of baseDirs) {
    for (const descriptor of listCopilotSessionDescriptorsFrom(baseDir)) {
      descriptors.set(descriptor.id, descriptor)
    }
  }
  return Array.from(descriptors.values())
}

function filteredWorkspaceRoots(
  platform: 'linux' | 'mounted_host',
  historyPathHints: string[]
): Array<{ path: string; platform: 'linux' | 'mounted_host' }> {
  return discoverWorkspaceStorageRoots(historyPathHints).filter(
    (root) => root.platform === platform
  )
}

function readSessionMessages(eventsFile: string): SessionMessage[] {
  if (!existsSync(eventsFile)) return []

  const messages: SessionMessage[] = []
  const interactionToMessage = new Map<string, SessionMessage>()
  const toolCallToMessage = new Map<string, SessionMessage>()
  const turnStartByInteraction = new Map<string, number>()
  const pendingTurnEndByInteraction = new Map<string, number>()
  let currentModelId: string | undefined
  let activeTurnInteractionId: string | null = null

  try {
    const raw = readFileSync(eventsFile, 'utf8')
    let messageIndex = 0

    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue

      const event = JSON.parse(line) as CopilotAnyEvent

      if (event.type === 'user.message') {
        const content = (event.data?.['content'] as string | undefined)?.trim()
        if (content) {
          messages.push({ id: event.id ?? `user-${messageIndex}`, role: 'user', content })
          messageIndex++
        }
      } else if (event.type === 'session.model_change') {
        const nextModel =
          typeof event.data?.['newModel'] === 'string' ? event.data['newModel'] : undefined
        if (nextModel) {
          currentModelId = nextModel
        }
      } else if (event.type === 'session.truncation') {
        const data = event.data ?? {}
        messages.push({
          id: event.id ?? `truncation-${messageIndex}`,
          role: 'assistant',
          content: '',
          structuredBlocks: [
            {
              kind: 'truncation_notice',
              payload: {
                tokenLimit: typeof data['tokenLimit'] === 'number' ? data['tokenLimit'] : undefined,
                tokensRemoved:
                  typeof data['tokensRemovedDuringTruncation'] === 'number'
                    ? data['tokensRemovedDuringTruncation']
                    : undefined,
                messagesRemoved:
                  typeof data['messagesRemovedDuringTruncation'] === 'number'
                    ? data['messagesRemovedDuringTruncation']
                    : undefined,
              },
            },
          ],
        })
        messageIndex++
      } else if (event.type === 'assistant.turn_start') {
        const interactionId: string | null =
          typeof event.data?.['interactionId'] === 'string'
            ? event.data['interactionId']
            : typeof event.data?.['turnId'] === 'string'
              ? `turn:${event.data['turnId']}`
              : null
        const timestamp = parseTimestamp(event.timestamp)
        if (interactionId && timestamp !== undefined) {
          turnStartByInteraction.set(interactionId, timestamp)
          activeTurnInteractionId = interactionId
        }
      } else if (event.type === 'assistant.message') {
        const content = (event.data?.['content'] as string | undefined)?.trim()
        const interactionId: string | null =
          typeof event.data?.['interactionId'] === 'string'
            ? event.data['interactionId']
            : activeTurnInteractionId
        const reasoningText =
          typeof event.data?.['reasoningText'] === 'string'
            ? event.data['reasoningText'].trim()
            : ''
        const toolRequests = Array.isArray(event.data?.['toolRequests'])
          ? (event.data?.['toolRequests'] as CopilotToolRequest[])
          : []

        const structuredBlocks: StructuredBlock[] = []
        if (reasoningText) {
          structuredBlocks.push({
            kind: 'reasoning',
            payload: {
              title: deriveReasoningTitle(reasoningText),
              text: reasoningText,
            },
          })
        }

        for (const request of toolRequests) {
          const callId = typeof request.toolCallId === 'string' ? request.toolCallId : null
          const toolName = typeof request.name === 'string' ? request.name : null
          if (!callId || !toolName) {
            continue
          }

          structuredBlocks.push({
            kind: 'tool_call',
            payload: {
              callId,
              toolName,
              args: request.arguments,
              done: false,
            },
          })
        }

        if (content || structuredBlocks.length > 0) {
          const message: SessionMessage = {
            id:
              (event.data?.['messageId'] as string | undefined) ??
              event.id ??
              `assistant-${messageIndex}`,
            role: 'assistant',
            content: content ?? '',
            structuredBlocks: structuredBlocks.length > 0 ? structuredBlocks : undefined,
            turnInfo: currentModelId
              ? { modelId: currentModelId, patches: [], modifiedFiles: [] }
              : undefined,
          }

          if (interactionId) {
            interactionToMessage.set(interactionId, message)
            for (const block of message.structuredBlocks ?? []) {
              if (block.kind === 'tool_call') {
                toolCallToMessage.set(block.payload.callId, message)
              }
            }

            const startedAtMs = turnStartByInteraction.get(interactionId)
            if (startedAtMs !== undefined) {
              message.turnInfo = {
                ...(message.turnInfo ?? { modifiedFiles: [], patches: [] }),
                startedAtMs,
              }
            }

            const completedAtMs = pendingTurnEndByInteraction.get(interactionId)
            if (completedAtMs !== undefined) {
              message.turnInfo = {
                ...(message.turnInfo ?? { modifiedFiles: [], patches: [] }),
                startedAtMs: message.turnInfo?.startedAtMs,
                completedAtMs,
                durationMs:
                  message.turnInfo?.startedAtMs !== undefined
                    ? completedAtMs - message.turnInfo.startedAtMs
                    : undefined,
              }
              pendingTurnEndByInteraction.delete(interactionId)
            }
          }

          messages.push(message)
          messageIndex++
        }
      } else if (event.type === 'tool.execution_complete') {
        const toolCallId =
          typeof event.data?.['toolCallId'] === 'string' ? event.data['toolCallId'] : null
        if (!toolCallId) {
          continue
        }

        const message = toolCallToMessage.get(toolCallId)
        if (!message?.structuredBlocks) {
          continue
        }

        const success = event.data?.['success'] !== false
        const result = stringifyToolResult(event.data)
        const model = typeof event.data?.['model'] === 'string' ? event.data['model'] : undefined
        if (model) {
          message.turnInfo = {
            ...(message.turnInfo ?? { modifiedFiles: [], patches: [] }),
            modelId: model,
          }
        }

        message.structuredBlocks = message.structuredBlocks.map((block) =>
          block.kind === 'tool_call' && block.payload.callId === toolCallId
            ? {
                ...block,
                payload: {
                  ...block.payload,
                  done: true,
                  result: success ? (result ?? undefined) : (result ?? 'Tool call failed.'),
                },
              }
            : block
        )
      } else if (event.type === 'assistant.turn_end') {
        const interactionId: string | null =
          typeof event.data?.['interactionId'] === 'string'
            ? event.data['interactionId']
            : (activeTurnInteractionId ??
              (typeof event.data?.['turnId'] === 'string' ? `turn:${event.data['turnId']}` : null))
        const completedAtMs = parseTimestamp(event.timestamp)
        if (!interactionId || completedAtMs === undefined) {
          continue
        }

        const message = interactionToMessage.get(interactionId)
        if (!message) {
          pendingTurnEndByInteraction.set(interactionId, completedAtMs)
          continue
        }

        const startedAtMs =
          message.turnInfo?.startedAtMs ?? turnStartByInteraction.get(interactionId)
        message.turnInfo = {
          ...(message.turnInfo ?? { modifiedFiles: [], patches: [] }),
          startedAtMs,
          completedAtMs,
          durationMs:
            startedAtMs !== undefined ? Math.max(0, completedAtMs - startedAtMs) : undefined,
        }
        if (activeTurnInteractionId === interactionId) {
          activeTurnInteractionId = null
        }
      }
    }
  } catch {
    return messages
  }

  return messages
}

function readWorkspaceMetadata(filePath: string): CopilotWorkspaceMeta {
  try {
    const raw = readFileSync(filePath, 'utf8')
    const result: CopilotWorkspaceMeta = {}

    for (const line of raw.split(/\r?\n/)) {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex <= 0) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = stripYamlScalar(line.slice(separatorIndex + 1).trim())

      switch (key) {
        case 'id':
          result.id = value
          break
        case 'cwd':
          result.cwd = value
          break
        case 'created_at':
          result.created_at = value
          break
        case 'updated_at':
          result.updated_at = value
          break
        case 'summary':
          result.summary = value
          break
        default:
          break
      }
    }

    return result
  } catch {
    return {}
  }
}

function stripYamlScalar(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function resolveProject(
  projectPath: string,
  knownProjects: SessionProjectContext[]
): SessionProjectContext | null {
  const normalized = projectPath.replace(/\/+$/, '')
  return knownProjects.find((project) => project.path.replace(/\/+$/, '') === normalized) ?? null
}

function deriveTitle(baseDir: string, sessionDir: string, metadata: CopilotWorkspaceMeta): string {
  const summary = metadata.summary?.trim()
  if (summary) {
    return truncateTitle(summary)
  }

  const firstUserMessage = readFirstUserMessage(baseDir, sessionDir)
  if (firstUserMessage) {
    return truncateTitle(firstUserMessage)
  }

  return 'Copilot session'
}

function readFirstUserMessage(baseDir: string, sessionDir: string): string | null {
  const eventsFile = join(baseDir, sessionDir, 'events.jsonl')
  if (!existsSync(eventsFile)) {
    return null
  }

  try {
    const raw = readFileSync(eventsFile, 'utf8')

    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue
      }

      const parsed = JSON.parse(line) as CopilotUserMessageEvent
      if (parsed.type !== 'user.message') {
        continue
      }

      const text = parsed.data?.content?.trim()
      if (text) {
        return text
      }
    }
  } catch {
    return null
  }

  return null
}

function truncateTitle(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'Copilot session'
  }

  if (compact.length <= 60) {
    return compact
  }

  return `${compact.slice(0, 57).trimEnd()}...`
}

function listCopilotSessionDescriptorsFrom(baseDir: string): CopilotSessionDescriptor[] {
  if (!existsSync(baseDir)) {
    return []
  }

  const descriptors = new Map<string, CopilotSessionDescriptor>()

  try {
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const workspaceFile = join(baseDir, entry.name, 'workspace.yaml')
        const eventsFile = join(baseDir, entry.name, 'events.jsonl')
        if (!existsSync(workspaceFile) || !existsSync(eventsFile)) {
          continue
        }

        const metadata = readWorkspaceMetadata(workspaceFile)
        const sessionId = metadata.id ?? entry.name
        const updatedAt = metadata.updated_at ?? metadata.created_at
        if (!sessionId || !metadata.cwd || !updatedAt) {
          continue
        }

        descriptors.set(sessionId, {
          id: sessionId,
          cwd: metadata.cwd,
          updatedAt,
          title: deriveTitle(baseDir, entry.name, metadata),
          sourceType: 'cli_events',
          eventsFile,
        })
        continue
      }

      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
        continue
      }

      const descriptor = describeRootSessionFile(join(baseDir, entry.name))
      if (descriptor) {
        descriptors.set(descriptor.id, descriptor)
      }
    }
  } catch {
    return []
  }

  return Array.from(descriptors.values())
}

function describeRootSessionFile(filePath: string): CopilotSessionDescriptor | null {
  try {
    const raw = readFileSync(filePath, 'utf8')
    let sessionId: string | null = null
    let cwd: string | null = null
    let updatedAt: string | null = null
    let firstUserMessage: string | null = null

    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue
      }

      const event = JSON.parse(line) as CopilotAnyEvent
      if (event.timestamp) {
        updatedAt = event.timestamp
      }

      if (event.type === 'session.start') {
        const data = event.data ?? {}
        sessionId = typeof data['sessionId'] === 'string' ? data['sessionId'] : sessionId
        const context =
          typeof data['context'] === 'object' && data['context'] !== null
            ? (data['context'] as Record<string, unknown>)
            : null
        cwd =
          typeof context?.['cwd'] === 'string'
            ? context['cwd']
            : typeof context?.['gitRoot'] === 'string'
              ? context['gitRoot']
              : cwd
      }

      if (event.type === 'user.message' && !firstUserMessage) {
        const text = typeof event.data?.['content'] === 'string' ? event.data['content'].trim() : ''
        if (text) {
          firstUserMessage = text
        }
      }
    }

    if (!sessionId || !cwd || !updatedAt) {
      return null
    }

    return {
      id: sessionId,
      cwd,
      updatedAt,
      title: firstUserMessage ? truncateTitle(firstUserMessage) : 'Copilot session',
      sourceType: 'cli_events',
      eventsFile: filePath,
    }
  } catch {
    return null
  }
}

function listVscodeCopilotSessionDescriptors(
  historyPathHints: string[] = []
): CopilotSessionDescriptor[] {
  const descriptors = new Map<string, CopilotSessionDescriptor>()

  for (const root of discoverWorkspaceStorageRoots(historyPathHints)) {
    if (!existsSync(root.path)) {
      continue
    }

    try {
      for (const workspaceEntry of readdirSync(root.path, { withFileTypes: true })) {
        if (!workspaceEntry.isDirectory()) {
          continue
        }

        const workspaceDir = join(root.path, workspaceEntry.name)
        const workspaceMetaPath = join(workspaceDir, 'workspace.json')
        const workspaceFolder = readWorkspaceFolder(workspaceMetaPath)
        const chatSessionsDir = join(workspaceDir, 'chatSessions')
        if (!workspaceFolder || !existsSync(chatSessionsDir)) {
          continue
        }

        for (const sessionEntry of readdirSync(chatSessionsDir, { withFileTypes: true })) {
          if (!sessionEntry.isFile() || !sessionEntry.name.endsWith('.json')) {
            continue
          }

          const filePath = join(chatSessionsDir, sessionEntry.name)
          const descriptor = describeVscodeChatSessionFile(filePath, workspaceFolder, workspaceDir)
          if (descriptor) {
            descriptors.set(descriptor.id, descriptor)
          }
        }
      }
    } catch {
      continue
    }
  }

  return Array.from(descriptors.values())
}

function readWorkspaceFolder(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { folder?: string }
    return normalizeWorkspaceFolder(parsed.folder)
  } catch {
    return null
  }
}

function normalizeWorkspaceFolder(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const decoded = decodeURIComponent(value)
  const remoteMatch = decoded.match(/^[a-z-]+:\/\/[^/]+(\/.*)$/i)
  if (remoteMatch?.[1]) {
    return remoteMatch[1]
  }

  return decoded
}

function describeVscodeChatSessionFile(
  filePath: string,
  workspaceFolder: string,
  workspaceStorageRoot: string
): CopilotSessionDescriptor | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as VscodeChatSessionFile
    const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : null
    const updatedAtMs = typeof parsed.lastMessageDate === 'number' ? parsed.lastMessageDate : null
    const requests = Array.isArray(parsed.requests) ? parsed.requests : []

    if (!sessionId || !updatedAtMs || requests.length === 0) {
      return null
    }

    const firstRequest = requests.find((request) => readRequestText(request).trim())
    const title =
      typeof parsed.customTitle === 'string' && parsed.customTitle.trim()
        ? truncateTitle(parsed.customTitle)
        : firstRequest
          ? truncateTitle(readRequestText(firstRequest))
          : 'Copilot session'

    return {
      id: sessionId,
      cwd: workspaceFolder,
      updatedAt: new Date(updatedAtMs).toISOString(),
      title,
      sourceType: 'vscode_chat',
      chatSessionFile: filePath,
      workspaceStorageRoot,
    }
  } catch {
    return null
  }
}

function readVscodeChatSessionMessages(filePath: string): SessionMessage[] {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
    const requests = Array.isArray(parsed['requests'])
      ? (parsed['requests'] as Array<Record<string, unknown>>)
      : []
    const messages: SessionMessage[] = []

    for (const request of requests) {
      const requestId =
        typeof request['requestId'] === 'string' ? request['requestId'] : `req-${messages.length}`
      const requestText = readRequestText(request)
      if (requestText.trim()) {
        messages.push({ id: `${requestId}-user`, role: 'user', content: requestText.trim() })
      }

      const assistantMessage = buildVscodeAssistantMessage(request)
      if (assistantMessage) {
        messages.push({ id: `${requestId}-assistant`, role: 'assistant', ...assistantMessage })
      }
    }

    return messages
  } catch {
    return []
  }
}

function buildVscodeAssistantMessage(
  request: Record<string, unknown>
): Pick<SessionMessage, 'content' | 'structuredBlocks' | 'turnInfo'> | null {
  const response = Array.isArray(request['response'])
    ? (request['response'] as Array<Record<string, unknown>>)
    : []
  const structuredBlocks: StructuredBlock[] = []
  const markdown: string[] = []
  const modifiedFiles = new Set<string>()
  const toolCalls: Array<{
    callId: string
    toolName: string
    result?: string
    done: boolean
    args?: unknown
  }> = []
  const turnInfo: SessionMessage['turnInfo'] = {
    modelId: typeof request['modelId'] === 'string' ? (request['modelId'] as string) : undefined,
    startedAtMs:
      typeof request['timestamp'] === 'number' ? (request['timestamp'] as number) : undefined,
    durationMs: readElapsedDuration(request),
    modifiedFiles: [],
    patches: [],
  }

  if (turnInfo.startedAtMs !== undefined && turnInfo.durationMs !== undefined) {
    turnInfo.completedAtMs = turnInfo.startedAtMs + turnInfo.durationMs
  }

  for (const item of response) {
    const kind = typeof item['kind'] === 'string' ? item['kind'] : null
    if (!kind) {
      const text = readMarkdownValue(item)
      if (text) markdown.push(text)
      continue
    }

    if (kind === 'thinking') {
      const text = typeof item['value'] === 'string' ? item['value'].trim() : ''
      if (text) {
        structuredBlocks.push({
          kind: 'reasoning',
          payload: { title: deriveReasoningTitle(text), text },
        })
      }
      continue
    }

    if (kind === 'prepareToolInvocation') {
      const toolName = typeof item['toolName'] === 'string' ? item['toolName'] : 'tool'
      toolCalls.push({ callId: `${toolName}-${toolCalls.length}`, toolName, done: false })
      continue
    }

    if (kind === 'toolInvocationSerialized') {
      const active = toolCalls.at(-1)
      if (active) {
        active.args = readNestedMarkdownValue(item['invocationMessage']) ?? undefined
        active.result = readNestedMarkdownValue(item['pastTenseMessage']) ?? undefined
        active.done = item['isComplete'] !== false
      }
      continue
    }

    if (kind === 'textEditGroup') {
      const path = readUriPath(item['uri'])
      if (path) {
        modifiedFiles.add(path)
        structuredBlocks.push({
          kind: 'file_operation',
          payload: { path, operation: 'edit', source: 'vscode_text_edit' },
        })
      }
      continue
    }

    if (kind === 'inlineReference') {
      const path = readUriPath(item['inlineReference'])
      if (path) {
        structuredBlocks.push({
          kind: 'file_operation',
          payload: { path, operation: 'reference', source: 'vscode_inline_reference' },
        })
      }
      continue
    }

    if (kind === 'confirmation' || kind === 'elicitation') {
      const title =
        kind === 'confirmation'
          ? typeof item['title'] === 'string'
            ? item['title']
            : 'Confirmation requested'
          : (readNestedMarkdownValue(item['title']) ?? 'Confirmation requested')
      const stateValue = typeof item['state'] === 'string' ? item['state'] : undefined
      structuredBlocks.push({
        kind: 'approval_notice',
        payload: {
          title,
          message: readNestedMarkdownValue(item['message']) ?? undefined,
          state:
            stateValue === 'accepted'
              ? 'approved'
              : stateValue === 'rejected'
                ? 'rejected'
                : 'pending',
        },
      })
      continue
    }

    if (kind === 'progressTaskSerialized') {
      const text = readNestedMarkdownValue(item['content'])
      if (text) {
        markdown.push(text)
      }
      continue
    }
  }

  for (const attachment of readRequestAttachments(request)) {
    structuredBlocks.push(attachment)
  }

  for (const toolCall of toolCalls) {
    structuredBlocks.push({
      kind: 'tool_call',
      payload: toolCall,
    })
  }

  for (const event of readEditedFileEvents(request)) {
    modifiedFiles.add(event.path)
    structuredBlocks.push({
      kind: 'file_operation',
      payload: event,
    })
  }

  const resultText = readResultText(request)
  if (resultText) {
    markdown.push(resultText)
  }

  turnInfo.modifiedFiles = Array.from(modifiedFiles)

  if (structuredBlocks.length === 0 && markdown.join('\n\n').trim() === '') {
    return null
  }

  return {
    content: markdown.join('\n\n').trim(),
    structuredBlocks: structuredBlocks.length > 0 ? structuredBlocks : undefined,
    turnInfo,
  }
}

function readRequestText(request: Record<string, unknown>): string {
  const message =
    typeof request['message'] === 'object' && request['message'] !== null
      ? (request['message'] as Record<string, unknown>)
      : null
  return typeof message?.['text'] === 'string' ? message['text'] : ''
}

function readMarkdownValue(item: Record<string, unknown>): string | null {
  return typeof item['value'] === 'string' ? item['value'].trim() : null
}

function readNestedMarkdownValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['value'] === 'string'
  ) {
    const nested = ((value as Record<string, unknown>)['value'] as string).trim()
    return nested || null
  }

  return null
}

function readUriPath(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  if (typeof record['path'] === 'string' && record['path']) {
    return record['path']
  }

  if (typeof record['fsPath'] === 'string' && record['fsPath']) {
    return record['fsPath'].replaceAll('\\', '/')
  }

  return null
}

function readResultText(request: Record<string, unknown>): string | null {
  if (typeof request['result'] !== 'object' || request['result'] === null) {
    return null
  }

  const metadata = (request['result'] as Record<string, unknown>)['metadata']
  if (typeof metadata !== 'object' || metadata === null) {
    return null
  }

  const rounds = Array.isArray((metadata as Record<string, unknown>)['toolCallRounds'])
    ? ((metadata as Record<string, unknown>)['toolCallRounds'] as Array<Record<string, unknown>>)
    : []
  const texts = rounds
    .map((round) => (typeof round['response'] === 'string' ? round['response'].trim() : ''))
    .filter(Boolean)

  return texts.join('\n\n').trim() || null
}

function readElapsedDuration(request: Record<string, unknown>): number | undefined {
  if (typeof request['result'] !== 'object' || request['result'] === null) {
    return undefined
  }

  const timings = (request['result'] as Record<string, unknown>)['timings']
  if (typeof timings !== 'object' || timings === null) {
    return undefined
  }

  return typeof (timings as Record<string, unknown>)['totalElapsed'] === 'number'
    ? ((timings as Record<string, unknown>)['totalElapsed'] as number)
    : undefined
}

function readRequestAttachments(request: Record<string, unknown>): StructuredBlock[] {
  const variableData =
    typeof request['variableData'] === 'object' && request['variableData'] !== null
      ? (request['variableData'] as Record<string, unknown>)
      : null
  const variables = Array.isArray(variableData?.['variables'])
    ? (variableData?.['variables'] as Array<Record<string, unknown>>)
    : []

  return variables.flatMap((variable, index) => {
    const path = readUriPath(variable['value'])
    if (!path) {
      return []
    }

    const name = typeof variable['name'] === 'string' ? variable['name'] : `attachment-${index}`
    const kind = typeof variable['kind'] === 'string' ? variable['kind'] : 'attachment'
    return [
      {
        kind: 'attachment' as const,
        payload: {
          mime: kind === 'file' ? 'text/plain' : 'application/octet-stream',
          filename: name,
          url: path,
        },
      },
    ]
  })
}

function readEditedFileEvents(
  request: Record<string, unknown>
): Array<{ path: string; operation: 'create' | 'edit' | 'delete'; source: string }> {
  const events = Array.isArray(request['editedFileEvents'])
    ? (request['editedFileEvents'] as Array<Record<string, unknown>>)
    : []

  return events.flatMap((event) => {
    const path = readUriPath(event['uri'])
    const eventKind = typeof event['eventKind'] === 'number' ? event['eventKind'] : null
    if (!path || eventKind === null) {
      return []
    }

    return [
      {
        path,
        operation: eventKind === 1 ? 'create' : eventKind === 2 ? 'delete' : 'edit',
        source: 'vscode_edited_file_event',
      },
    ]
  })
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function deriveReasoningTitle(text: string): string | undefined {
  const match = text.match(/^\*\*(.+?)\*\*/)
  return match?.[1]?.trim() || undefined
}

function stringifyToolResult(data: Record<string, unknown> | undefined): string | null {
  if (!data) {
    return null
  }

  const result =
    typeof data['result'] === 'object' && data['result'] !== null
      ? (data['result'] as Record<string, unknown>)
      : null
  const error =
    typeof data['error'] === 'object' && data['error'] !== null
      ? (data['error'] as Record<string, unknown>)
      : null

  if (result) {
    const content = typeof result['content'] === 'string' ? result['content'] : null
    const detailedContent =
      typeof result['detailedContent'] === 'string' ? result['detailedContent'] : null
    return (
      [content, detailedContent].filter(Boolean).join('\n\n') || JSON.stringify(result, null, 2)
    )
  }

  if (error) {
    const message = typeof error['message'] === 'string' ? error['message'] : null
    const code = typeof error['code'] === 'string' ? error['code'] : null
    return (
      [message, code ? `Code: ${code}` : null].filter(Boolean).join('\n') ||
      JSON.stringify(error, null, 2)
    )
  }

  return null
}

function discoverCopilotCliSource(
  dir: string,
  kind: 'cli_session_dir' | 'cli_history_dir',
  backendId: string
): HistorySourceDescriptor[] {
  const descriptorBase = {
    id: `${backendId}:${kind}:${dir}`,
    backendId,
    providerId: backendId,
    kind,
    path: dir,
    platform: classifyPlatform(dir),
    discoveredBy: 'auto' as const,
  }

  if (!existsSync(dir)) {
    return [{ ...descriptorBase, access: 'missing', signal: 'unknown' }]
  }

  try {
    const sessionCount = listCopilotSessionDescriptorsFrom(dir).length
    return [
      {
        ...descriptorBase,
        access: 'readable',
        signal: sessionCount > 0 ? 'contains_history' : 'empty',
        lastModifiedMs: statSync(dir).mtimeMs,
        sessionCount,
      },
    ]
  } catch {
    return [{ ...descriptorBase, access: 'invalid', signal: 'unknown' }]
  }
}

function discoverVscodeCopilotSources(
  historyPathHints: string[] = [],
  backendId = 'copilot-vscode-host'
): HistorySourceDescriptor[] {
  const results: HistorySourceDescriptor[] = []
  const roots = discoverWorkspaceStorageRoots(historyPathHints)

  for (const root of roots) {
    if (!existsSync(root.path)) {
      continue
    }

    try {
      for (const entry of readdirSync(root.path, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue
        }

        const workspaceDir = join(root.path, entry.name)
        const stateDb = join(workspaceDir, 'state.vscdb')
        if (existsSync(stateDb)) {
          const stat = statSync(stateDb)
          results.push({
            id: `${backendId}:vscode_workspace_db:${stateDb}`,
            backendId,
            providerId: backendId,
            kind: 'vscode_workspace_db',
            path: stateDb,
            platform: root.platform,
            access: 'readable',
            signal: stat.size > 0 ? 'contains_history' : 'empty',
            discoveredBy: 'auto',
            lastModifiedMs: stat.mtimeMs,
          })
        }

        const chatSessionsDir = join(workspaceDir, 'chatSessions')
        if (existsSync(chatSessionsDir)) {
          const stat = statSync(chatSessionsDir)
          const sessionFiles = safeCountMatchingEntries(chatSessionsDir, '.json')
          results.push({
            id: `${backendId}:vscode_chat_sessions:${chatSessionsDir}`,
            backendId,
            providerId: backendId,
            kind: 'vscode_chat_sessions',
            path: chatSessionsDir,
            platform: root.platform,
            access: 'readable',
            signal: sessionFiles > 0 ? 'contains_history' : 'empty',
            discoveredBy: 'auto',
            lastModifiedMs: stat.mtimeMs,
            sessionCount: sessionFiles,
          })
        }

        const chatEditingDir = join(workspaceDir, 'chatEditingSessions')
        if (existsSync(chatEditingDir)) {
          const stat = statSync(chatEditingDir)
          const sessionDirs = safeCountDirectoryOnlyEntries(chatEditingDir)
          results.push({
            id: `${backendId}:vscode_chat_editing:${chatEditingDir}`,
            backendId,
            providerId: backendId,
            kind: 'vscode_chat_editing_sessions',
            path: chatEditingDir,
            platform: root.platform,
            access: 'readable',
            signal: sessionDirs > 0 ? 'contains_history' : 'empty',
            discoveredBy: 'auto',
            lastModifiedMs: stat.mtimeMs,
            sessionCount: sessionDirs,
          })
        }

        const extensionResources = join(workspaceDir, 'GitHub.copilot-chat')
        if (existsSync(extensionResources)) {
          const stat = statSync(extensionResources)
          const resourceEntries = safeCountDirectoryEntries(extensionResources)
          results.push({
            id: `${backendId}:vscode_extension_resources:${extensionResources}`,
            backendId,
            providerId: backendId,
            kind: 'vscode_extension_resources',
            path: extensionResources,
            platform: root.platform,
            access: 'readable',
            signal: resourceEntries > 0 ? 'contains_history' : 'empty',
            discoveredBy: 'auto',
            lastModifiedMs: stat.mtimeMs,
          })
        }
      }
    } catch {
      results.push({
        id: `${backendId}:vscode_root:${root.path}`,
        backendId,
        providerId: backendId,
        kind: 'vscode_workspace_db',
        path: root.path,
        platform: root.platform,
        access: 'invalid',
        signal: 'unknown',
        discoveredBy: 'auto',
      })
    }
  }

  return results
}

function discoverWorkspaceStorageRoots(historyPathHints: string[] = []): Array<{
  path: string
  platform: 'linux' | 'mounted_host'
}> {
  const roots = new Map<string, { path: string; platform: 'linux' | 'mounted_host' }>()

  for (const path of historyPathHints) {
    if (!path.trim()) {
      continue
    }

    roots.set(path, {
      path,
      platform: path.startsWith('/mnt/') ? 'mounted_host' : 'linux',
    })
  }

  if (COPILOT_VSCODE_WORKSPACE_STORAGE_DIRS?.trim()) {
    for (const path of COPILOT_VSCODE_WORKSPACE_STORAGE_DIRS.split(':').filter(Boolean)) {
      roots.set(path, {
        path,
        platform: path.startsWith('/mnt/') ? 'mounted_host' : 'linux',
      })
    }
    return Array.from(roots.values())
  }

  for (const path of [
    join(homedir(), '.config', 'Code', 'User', 'workspaceStorage'),
    join(homedir(), '.config', 'Code - Insiders', 'User', 'workspaceStorage'),
  ]) {
    roots.set(path, { path, platform: 'linux' })
  }

  const mntRoot = '/mnt'
  if (!existsSync(mntRoot)) {
    return Array.from(roots.values())
  }

  try {
    const candidateUsers = Array.from(
      new Set(
        [process.env['USER'], process.env['USERNAME']].filter((value): value is string => !!value)
      )
    )

    for (const drive of readdirSync(mntRoot, { withFileTypes: true })) {
      if (!drive.isDirectory()) {
        continue
      }

      const usersDir = join(mntRoot, drive.name, 'Users')
      if (!existsSync(usersDir)) {
        continue
      }

      for (const userName of candidateUsers) {
        const userDir = join(usersDir, userName)
        if (!existsSync(userDir)) {
          continue
        }

        for (const productDir of ['Code', 'Code - Insiders']) {
          const workspaceStorageRoot = join(
            userDir,
            'AppData',
            'Roaming',
            productDir,
            'User',
            'workspaceStorage'
          )
          roots.set(workspaceStorageRoot, { path: workspaceStorageRoot, platform: 'mounted_host' })
        }
      }
    }
  } catch {
    return Array.from(roots.values())
  }

  return Array.from(roots.values())
}

function safeCountDirectoryEntries(dir: string): number {
  try {
    return readdirSync(dir).length
  } catch {
    return 0
  }
}

function safeCountMatchingEntries(dir: string, suffix: string): number {
  try {
    return readdirSync(dir).filter((entry) => entry.endsWith(suffix)).length
  } catch {
    return 0
  }
}

function safeCountDirectoryOnlyEntries(dir: string): number {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
  } catch {
    return 0
  }
}

function classifyPlatform(path: string): 'linux' | 'mounted_host' | 'windows' | 'unknown' {
  if (path.startsWith('/mnt/')) {
    return 'mounted_host'
  }

  if (path.startsWith('/')) {
    return 'linux'
  }

  if (/^[A-Za-z]:\\/.test(path)) {
    return 'windows'
  }

  return 'unknown'
}
