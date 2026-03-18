import type { AgentSummary } from '../hooks/useAgUiChat.js'

interface AgentSelectorProps {
  agents: AgentSummary[]
  selectedAgentId: string | null
  onSelect: (agentId: string) => void
}

export function AgentSelector({ agents, selectedAgentId, onSelect }: AgentSelectorProps) {
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null

  function getStatusSuffix(agent: AgentSummary): string {
    if (agent.status === 'active') return ''
    if (agent.status === 'detected') return '(Detected)'
    return '(Unavailable)'
  }

  return (
    <div className="min-w-0" data-testid="agent-selector">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Agent</p>
      <div className="mt-2">
        <label className="block">
          <span className="sr-only">Active agent</span>
          <select
            value={selectedAgentId ?? ''}
            onChange={(event) => onSelect(event.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          >
            <option value="" disabled>
              Select an agent
            </option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id} disabled={agent.status !== 'active'}>
                {agent.name} {getStatusSuffix(agent)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {selectedAgent
          ? `${selectedAgent.name} is selected for the next prompt.`
          : 'Choose which adapter receives the next message.'}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {agents
          .filter((agent) => agent.command)
          .map((agent) => (
            <span
              key={agent.id}
              className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-[10px] text-slate-400"
            >
              {agent.name}: {agent.command}
            </span>
          ))}
      </div>
    </div>
  )
}
