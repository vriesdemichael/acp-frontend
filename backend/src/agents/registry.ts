import type { CopilotAdapter } from '../adapters/copilot/adapter.js'
import { CopilotProcess, isCopilotAvailable } from '../adapters/copilot/process.js'
import type { McpServer } from '@agentclientprotocol/sdk'
import type {
  AgentSummary,
  BackendSummary,
  BackendTestResult,
  SessionAdapter,
  SessionDetails,
  SessionSummary,
} from './types.js'
import { detectAvailableCommand } from './discovery.js'
import {
  createBackendId,
  readBackendConfig,
  writeBackendConfig,
  type BackendDefinitionRecord,
} from './config.js'
import { createGenericAcpAdapter } from '../adapters/generic/index.js'
import { StdioAcpProcess } from '../adapters/shared/process.js'
import { deriveEndpointSupport } from '../adapters/shared/capabilities.js'

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
    'session/list',
    'session/resume',
    'session/fork',
    'fs/readTextFile',
    'fs/writeTextFile',
    'terminal/*',
    'permission/request',
  ],
}

export class AgentRegistry {
  private agents: RegisteredAgent[]
  private readonly testResults = new Map<string, BackendTestResult>()
  private readonly capabilityResults = new Map<string, BackendSummary['endpointSupport']>()

  constructor(private readonly copilotAdapter: CopilotAdapter) {
    this.agents = this.buildAgents()
  }

  listAgents(): AgentSummary[] {
    return this.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      status: this.toAgentStatus(agent),
      command: agent.command,
    }))
  }

  listBackends(): BackendSummary[] {
    return this.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      status: this.toAgentStatus(agent),
      command: agent.command,
      detectedCommand: agent.detectedCommand,
      args: agent.args,
      defaultArgs: agent.args,
      enabled: agent.enabled,
      usesCustomCommand: agent.usesCustomCommand,
      endpointSupport:
        this.capabilityResults.get(agent.id) ??
        agent.adapter?.getEndpointSupport() ??
        UNKNOWN_ENDPOINT_SUPPORT,
      lastTestResult: agent.lastTestResult,
    }))
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
    input: { enabled?: boolean; command?: string | null; args?: string[]; name?: string }
  ): BackendSummary {
    const config = readBackendConfig()
    const index = config.findIndex((backend) => backend.id === agentId)

    if (index === -1) {
      throw new Error(`Unknown backend: ${agentId}`)
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

  async testBackend(agentId: string): Promise<BackendSummary> {
    const backend = this.agents.find((item) => item.id === agentId)
    if (!backend) {
      throw new Error(`Unknown backend: ${agentId}`)
    }

    if (!backend.command) {
      throw new Error(`No command configured for backend: ${agentId}`)
    }

    const testedAt = new Date().toISOString()

    try {
      const process =
        backend.id === 'copilot' && backend.commandCandidates.includes('copilot')
          ? new CopilotProcess({ command: backend.command, args: backend.args })
          : new StdioAcpProcess({
              command: backend.command,
              args: backend.args,
              stderrLabel: backend.id,
            })

      const info = await process.start().then(async (client) => {
        try {
          return await client.initialize()
        } finally {
          await client.close()
        }
      })

      const endpointSupport = deriveEndpointSupport(info)
      this.capabilityResults.set(agentId, endpointSupport)

      this.testResults.set(agentId, {
        ok: true,
        message: 'ACP initialize succeeded.',
        testedAt,
      })

      this.agents = this.buildAgents()
      return this.requireBackend(agentId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.capabilityResults.delete(agentId)
      this.testResults.set(agentId, {
        ok: false,
        message,
        testedAt,
      })
      this.agents = this.buildAgents()
      return this.requireBackend(agentId)
    }
  }

  async createSession(agentId: string, mcpServers: McpServer[]): Promise<string> {
    return this.requireAdapter(agentId).newSession(mcpServers)
  }

  listSessions(): SessionSummary[] {
    return this.agents
      .flatMap((agent) => agent.adapter?.listSessions() ?? [])
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  getSession(sessionId: string): SessionDetails | null {
    for (const agent of this.agents) {
      const session = agent.adapter?.getSession(sessionId)
      if (session) return session
    }

    return null
  }

  async sendMessage(sessionId: string, text: string, agentId?: string): Promise<void> {
    const adapter = this.findAdapterForSession(sessionId)

    if (!adapter) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    if (agentId && agentId !== adapter.agentId) {
      throw new Error(`Agent mismatch for session ${sessionId}`)
    }

    await adapter.sendMessage(sessionId, text)
  }

  closeSession(sessionId: string): boolean {
    const adapter = this.findAdapterForSession(sessionId)
    if (!adapter) return false

    adapter.closeSession(sessionId)
    return true
  }

  eventsForSession(sessionId: string) {
    return this.findAdapterForSession(sessionId)?.events ?? null
  }

  private buildAgents(): RegisteredAgent[] {
    return readBackendConfig().map((backend) => this.buildRegisteredAgent(backend))
  }

  private buildRegisteredAgent(backend: BackendDefinitionRecord): RegisteredAgent {
    const configuredCommand = normalizeCommand(backend.command)
    const usesCustomCommand = configuredCommand !== null
    const detectedCommand = usesCustomCommand
      ? detectAvailableCommand([configuredCommand]).command
      : detectAvailableCommand(backend.commandCandidates).command
    const effectiveCommand = configuredCommand ?? detectedCommand

    let adapter: SessionAdapter | undefined
    if (backend.enabled && effectiveCommand) {
      if (backend.id === 'copilot' && backend.commandCandidates.includes('copilot')) {
        adapter = isCopilotAvailable() || usesCustomCommand ? this.copilotAdapter : undefined
      } else {
        adapter = createGenericAcpAdapter({
          id: backend.id,
          name: backend.name,
          command: effectiveCommand,
          args: backend.args,
        })
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

  private toAgentStatus(agent: RegisteredAgent): AgentSummary['status'] {
    if (!agent.enabled) return 'disabled'
    if (agent.adapter) return 'active'
    if (agent.command) return 'detected'
    return 'unavailable'
  }

  private requireBackend(agentId: string): BackendSummary {
    const backend = this.listBackends().find((item) => item.id === agentId)
    if (!backend) {
      throw new Error(`Unknown backend: ${agentId}`)
    }

    return backend
  }

  private requireAdapter(agentId: string): SessionAdapter {
    const agent = this.agents.find((item) => item.id === agentId)

    if (!agent?.adapter) {
      throw new Error(`Agent unavailable: ${agentId}`)
    }

    return agent.adapter
  }

  private findAdapterForSession(sessionId: string): SessionAdapter | null {
    for (const agent of this.agents) {
      if (agent.adapter?.getSession(sessionId)) {
        return agent.adapter
      }
    }

    return null
  }
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

export function createAgentRegistry(copilotAdapter: CopilotAdapter): AgentRegistry {
  return new AgentRegistry(copilotAdapter)
}
