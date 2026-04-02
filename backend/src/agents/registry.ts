import type {
  AgentSummary,
  BackendSummary,
  BackendTestResult,
  HistorySourceDescriptor,
  HistorySupport,
  RegistryErrorCode,
  SessionAdapter,
  SessionDetails,
  SessionSummary,
} from './types.js'
import { RegistryError } from './types.js'
import { detectAvailableCommand } from './discovery.js'
import {
  createBackendId,
  readBackendConfig,
  writeBackendConfig,
  type BackendDefinitionRecord,
} from './config.js'
import { AcpxSessionManager } from '../acpx/session-manager.js'
import type { SessionProjectContext } from './types.js'
import { listProjects, toSessionProjectContext } from '../projects/service.js'
import {
  getHistorySourceDescriptors,
  listHistorySessions,
  mergeSessions,
  getHistorySession,
  HISTORY_AGENT_IDS,
} from '../history/index.js'
import { getHistoryHintsForProvider } from '../history/sources-config.js'
import type { HistoryProvider } from '../history/sources-config.js'
import { FakeSessionAdapter } from '../testing/fakeAdapter.js'

interface RegisteredAgent {
  id: string
  name: string
  command: string | null
  detectedCommand: string | null
  args: string[]
  defaultArgs: string[]
  enabled: boolean
  usesCustomCommand: boolean
  adapter?: SessionAdapter
  commandCandidates: string[]
  lastTestResult: BackendTestResult | null
}

const UNKNOWN_ENDPOINT_SUPPORT = {
  source: 'unknown' as const,
  implemented: [],
  unknown: [
    'session/new',
    'session/prompt',
    'session/update',
    'session/load',
    'session/list',
    'session/resume',
    'session/fork',
    'fs/readTextFile',
    'fs/writeTextFile',
    'terminal/*',
    'permission/request',
  ],
}

/** Agent IDs that map to a `HistoryProvider` for path-hint lookups. */
const HISTORY_PROVIDER_IDS = new Set<string>(['copilot', 'gemini-cli', 'opencode'])

/** Map from backend agent ID to the HistoryProvider key used in sources-config. */
function toHistoryProvider(agentId: string): HistoryProvider | null {
  if (agentId === 'copilot') return 'copilot'
  if (agentId === 'gemini-cli') return 'gemini'
  if (agentId === 'opencode') return 'opencode'
  return null
}

export class AgentRegistry {
  private agents: RegisteredAgent[]

  constructor() {
    this.agents = this.buildAgents()
  }

  listAgents(): AgentSummary[] {
    return this.agents.map((agent) => {
      const status = this.toAgentStatus(agent)
      const endpointSupport = agent.adapter?.getEndpointSupport() ?? UNKNOWN_ENDPOINT_SUPPORT
      return {
        id: agent.id,
        name: agent.name,
        status,
        command: agent.command,
        canResume: agent.adapter !== undefined,
        canLoad: endpointSupport.implemented.includes('session/load'),
      }
    })
  }

  listBackends(): BackendSummary[] {
    return this.agents.map((agent) => {
      const status = this.toAgentStatus(agent)
      const endpointSupport = agent.adapter?.getEndpointSupport() ?? UNKNOWN_ENDPOINT_SUPPORT
      return {
        id: agent.id,
        name: agent.name,
        status,
        command: agent.command,
        canResume: agent.adapter !== undefined,
        canLoad: endpointSupport.implemented.includes('session/load'),
        detectedCommand: agent.detectedCommand,
        args: agent.args,
        defaultArgs: agent.args,
        enabled: agent.enabled,
        usesCustomCommand: agent.usesCustomCommand,
        endpointSupport,
        historySupport: getHistorySupport(agent.id),
        lastTestResult: agent.lastTestResult,
      }
    })
  }

  addBackend(input: { name: string; command: string; args?: string[] }): BackendSummary {
    const config = readBackendConfig()
    const id = uniqueBackendId(config, createBackendId(input.name))

    config.push({
      id,
      name: input.name.trim(),
      enabled: true,
      commandCandidates: [],
      command: input.command.trim(),
      args: input.args?.filter(Boolean) ?? [],
    })

    writeBackendConfig(config)
    this.agents = this.buildAgents()

    return this.requireBackend(id)
  }

  updateBackend(
    agentId: string,
    input: {
      enabled?: boolean
      command?: string | null
      args?: string[]
      name?: string
    }
  ): BackendSummary {
    const config = readBackendConfig()
    const index = config.findIndex((backend) => backend.id === agentId)

    if (index === -1) {
      throw new RegistryError('unknown_backend', `Unknown backend: ${agentId}`)
    }

    const current = config[index]!
    config[index] = {
      ...current,
      name: input.name?.trim() || current.name,
      enabled: input.enabled ?? current.enabled,
      command: normalizeCommand(input.command ?? current.command),
      args: Array.isArray(input.args) ? input.args.filter(Boolean) : current.args,
    }

    writeBackendConfig(config)
    this.agents = this.buildAgents()
    return this.requireBackend(agentId)
  }

  async createSession(agentId: string, project: SessionProjectContext | null): Promise<string> {
    const adapter = this.requireAdapter(agentId)
    const sessionId = await adapter.newSession(project)
    return sessionId
  }

  /**
   * Resume a source session on the target agent. Prefers native `continueSession` (acpx
   * `--from`) when both the source and target adapters support it, otherwise falls back to
   * creating a blank session and injecting the prior transcript via `sendHandoff`.
   *
   * Returns the new internal session ID.
   */
  async resumeSession(
    sourceSessionId: string,
    sourceSession: SessionDetails,
    targetAgentId: string,
    project: SessionProjectContext | null
  ): Promise<string> {
    const targetAdapter = this.requireAdapter(targetAgentId)

    // Attempt native continuation only when we can provide a valid agent-side source session ID.
    if (targetAdapter.continueSession) {
      const sourceAdapter = this.findAdapterForSession(sourceSessionId)

      // History sessions are not owned by a live adapter, so their session id is already the
      // original agent-side id. Live sessions must come from the owning adapter, and only
      // adapters that expose `getAgentSessionId` can safely provide an id for native
      // continuation. If the source is a live session but the adapter does not implement
      // `getAgentSessionId`, we have no reliable agent-side id and must fall back.
      const fromId = sourceAdapter
        ? (sourceAdapter.getAgentSessionId?.(sourceSessionId) ?? null)
        : sourceSessionId

      if (fromId) {
        try {
          return await targetAdapter.continueSession(fromId, project)
        } catch {
          // Native continuation failed (e.g. acpx returned no session id) — fall through to
          // the sendHandoff fallback below so the user still gets a working session.
        }
      }
    }

    // Fallback: blank new session + transcript handoff
    const newSessionId = await targetAdapter.newSession(project)
    if (sourceSession.messages.length > 0) {
      await targetAdapter.sendHandoff(newSessionId, sourceSession.messages)
    }
    return newSessionId
  }

  listSessions(): SessionSummary[] {
    const liveSessions = this.agents.flatMap((agent) => agent.adapter?.listSessions() ?? [])

    const knownProjects = listProjects().map(toSessionProjectContext)
    const historySessions = listHistorySessions(
      knownProjects,
      this.agents.map((agent) => {
        const provider = toHistoryProvider(agent.id)
        const hints = provider ? getHistoryHintsForProvider(provider) : null
        return {
          id: agent.id,
          historyPathHints: hints?.historyPathHints ?? [],
          cliHistoryPathHints: hints?.cliHistoryPathHints ?? [],
        }
      })
    )

    return mergeSessions(liveSessions, historySessions)
  }

  getSession(sessionId: string, agentId?: string): SessionDetails | null {
    for (const agent of this.agents) {
      const session = agent.adapter?.getSession(sessionId)
      if (session) return session
    }

    const knownProjects = listProjects().map(toSessionProjectContext)
    return getHistorySession(
      sessionId,
      knownProjects,
      this.agents.map((agent) => {
        const provider = toHistoryProvider(agent.id)
        const hints = provider ? getHistoryHintsForProvider(provider) : null
        return {
          id: agent.id,
          historyPathHints: hints?.historyPathHints ?? [],
          cliHistoryPathHints: hints?.cliHistoryPathHints ?? [],
        }
      }),
      agentId
    )
  }

  async sendMessage(sessionId: string, text: string, agentId?: string): Promise<void> {
    const adapter = this.findAdapterForSession(sessionId)

    if (!adapter) {
      throw new RegistryError('session_not_found', `Session not found: ${sessionId}`)
    }

    if (agentId && agentId !== adapter.agentId) {
      throw new RegistryError('agent_mismatch', `Agent mismatch for session ${sessionId}`)
    }

    await adapter.sendMessage(sessionId, text)
  }

  async sendHandoff(
    sessionId: string,
    messages: SessionDetails['messages'],
    agentId?: string
  ): Promise<void> {
    const adapter = this.findAdapterForSession(sessionId)

    if (!adapter) {
      throw new RegistryError('session_not_found', `Session not found: ${sessionId}`)
    }

    if (agentId && agentId !== adapter.agentId) {
      throw new RegistryError('agent_mismatch', `Agent mismatch for session ${sessionId}`)
    }

    await adapter.sendHandoff(sessionId, messages)
  }

  closeSession(sessionId: string): boolean {
    const adapter = this.findAdapterForSession(sessionId)
    if (!adapter) return false

    adapter.closeSession(sessionId)
    return true
  }

  resetSessions(): void {
    for (const agent of this.agents) {
      if (agent.adapter instanceof FakeSessionAdapter) {
        agent.adapter.reset()
      }
    }
  }

  eventsForSession(sessionId: string) {
    return this.findAdapterForSession(sessionId)?.events ?? null
  }

  private buildAgents(): RegisteredAgent[] {
    return readBackendConfig().map((backend) => this.buildRegisteredAgent(backend))
  }

  private buildRegisteredAgent(backend: BackendDefinitionRecord): RegisteredAgent {
    const useFakeBackend = process.env['ACP_FAKE_BACKEND'] === '1'
    const configuredCommand = normalizeCommand(backend.command)
    const usesCustomCommand = configuredCommand !== null
    const detectedCommand = useFakeBackend
      ? (configuredCommand ?? backend.commandCandidates[0] ?? backend.id)
      : usesCustomCommand
        ? detectAvailableCommand([configuredCommand]).command
        : detectAvailableCommand(backend.commandCandidates).command
    const effectiveCommand = configuredCommand ?? detectedCommand

    let adapter: SessionAdapter | undefined
    if (backend.enabled && (effectiveCommand || useFakeBackend)) {
      if (useFakeBackend) {
        adapter = new FakeSessionAdapter(backend.id, backend.name)
      } else {
        adapter = new AcpxSessionManager(backend.id, backend.name, effectiveCommand!)
      }
    }

    return {
      id: backend.id,
      name: backend.name,
      command: effectiveCommand,
      detectedCommand,
      args: backend.args,
      defaultArgs: backend.args,
      enabled: backend.enabled,
      usesCustomCommand,
      adapter,
      commandCandidates: backend.commandCandidates,
      lastTestResult: this.testResults.get(backend.id) ?? null,
    }
  }

  private readonly testResults = new Map<string, BackendTestResult>()

  private toAgentStatus(agent: RegisteredAgent): AgentSummary['status'] {
    if (!agent.enabled) return 'disabled'
    if (agent.adapter) return 'active'
    // Agents with a history provider are treated as active even without a live
    // adapter — they can serve past sessions for browsing and handoff.
    if (HISTORY_AGENT_IDS.has(agent.id)) return 'active'
    if (agent.command) return 'detected'
    return 'unavailable'
  }

  private requireBackend(agentId: string): BackendSummary {
    const backend = this.listBackends().find((item) => item.id === agentId)
    if (!backend) {
      throw new RegistryError('unknown_backend', `Unknown backend: ${agentId}`)
    }

    return backend
  }

  private requireAdapter(agentId: string): SessionAdapter {
    const agent = this.agents.find((item) => item.id === agentId)

    if (!agent?.adapter) {
      throw new RegistryError('agent_unavailable', `Agent unavailable: ${agentId}`)
    }

    return agent.adapter
  }

  private findAdapterForSession(sessionId: string): SessionAdapter | null {
    for (const agent of this.agents) {
      if (agent.adapter?.ownsSession(sessionId)) {
        return agent.adapter
      }
    }

    return null
  }
}

function getHistorySupport(agentId: string): HistorySupport {
  const provider = toHistoryProvider(agentId)
  const hints = provider ? getHistoryHintsForProvider(provider) : null
  const discoveredSources = getHistorySourceDescriptors(
    agentId,
    hints?.historyPathHints ?? [],
    hints?.cliHistoryPathHints ?? []
  )
  const discoverySummary = summarizeDiscoveredSources(discoveredSources)

  switch (agentId) {
    case 'opencode':
      return {
        source: 'native',
        supported: [
          'text',
          'markdown',
          'reasoning',
          'tool_calls',
          'skills',
          'subagents',
          'attachments',
          'rich_media',
          'file_operations',
          'patches',
          'compaction',
        ],
        discoveredSources,
        discoverySummary,
      }
    case 'copilot':
      return {
        source: 'derived',
        supported: ['text', 'markdown', 'reasoning', 'tool_calls', 'truncation'],
        discoveredSources,
        discoverySummary,
      }
    case 'gemini-cli':
      return {
        source: 'derived',
        supported: ['text', 'markdown'],
        discoveredSources,
        discoverySummary,
      }
    default:
      return {
        source: 'none',
        supported: [],
        discoveredSources,
        discoverySummary,
      }
  }
}

function summarizeDiscoveredSources(sources: HistorySourceDescriptor[]) {
  const families = new Map<
    string,
    {
      family: string
      readable: number
      missing: number
      invalid: number
      containsHistory: number
    }
  >()

  for (const source of sources) {
    const family = source.kind.startsWith('vscode_')
      ? 'vscode'
      : source.kind.startsWith('cli_')
        ? 'cli'
        : source.kind.startsWith('gemini_')
          ? 'gemini'
          : source.kind.startsWith('opencode_')
            ? 'opencode'
            : 'other'
    const summary = families.get(family) ?? {
      family,
      readable: 0,
      missing: 0,
      invalid: 0,
      containsHistory: 0,
    }

    if (source.access === 'readable') summary.readable += 1
    if (source.access === 'missing') summary.missing += 1
    if (source.access === 'invalid' || source.access === 'permission_error') summary.invalid += 1
    if (source.signal === 'contains_history') summary.containsHistory += 1

    families.set(family, summary)
  }

  return Array.from(families.values())
}

export function isRegistryError(error: unknown, code?: RegistryErrorCode): error is RegistryError {
  return error instanceof RegistryError && (code === undefined || error.code === code)
}

function normalizeCommand(command: string | null | undefined): string | null {
  const value = command?.trim()
  return value ? value : null
}

function uniqueBackendId(backends: BackendDefinitionRecord[], baseId: string): string {
  let candidate = baseId
  let count = 2

  while (backends.some((backend) => backend.id === candidate)) {
    candidate = `${baseId}-${count}`
    count += 1
  }

  return candidate
}

export function createAgentRegistry(): AgentRegistry {
  return new AgentRegistry()
}

// Export for use from routes
export { HISTORY_PROVIDER_IDS, toHistoryProvider }
