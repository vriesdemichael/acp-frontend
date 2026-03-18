import type { CopilotAdapter } from '../adapters/copilot/adapter.js'
import type { AgentSummary, SessionAdapter, SessionDetails, SessionSummary } from './types.js'

interface RegisteredAgent {
  id: string
  name: string
  adapter?: SessionAdapter
}

export class AgentRegistry {
  constructor(private readonly agents: RegisteredAgent[]) {}

  listAgents(): AgentSummary[] {
    return this.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      status: agent.adapter ? 'active' : 'unavailable',
    }))
  }

  async createSession(agentId: string, mcpServers: Record<string, unknown>): Promise<string> {
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

export function createAgentRegistry(copilotAdapter: CopilotAdapter): AgentRegistry {
  return new AgentRegistry([
    { id: 'copilot', name: 'GitHub Copilot', adapter: copilotAdapter },
    { id: 'claude-code', name: 'Claude Code' },
    { id: 'gemini-cli', name: 'Gemini CLI' },
    { id: 'codex', name: 'OpenAI Codex' },
    { id: 'opencode', name: 'opencode' },
  ])
}
