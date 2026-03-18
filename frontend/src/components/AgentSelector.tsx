import type { AgentSummary } from '../hooks/useAgUiChat.js'

interface AgentSelectorProps {
  agents: AgentSummary[]
  selectedAgentId: string | null
  onSelect: (agentId: string) => void
}

export function AgentSelector({ agents, selectedAgentId, onSelect }: AgentSelectorProps) {
  const availableAgents = agents.filter((agent) => agent.status === 'active')

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">Agent</p>
      <div className="mt-3 flex flex-wrap gap-2" data-testid="agent-selector">
        {agents.map((agent) => {
          const selected = agent.id === selectedAgentId
          const disabled = agent.status !== 'active'

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelect(agent.id)}
              disabled={disabled}
              aria-pressed={selected}
              className={`rounded-full border px-3 py-2 text-left text-xs font-semibold transition ${
                selected
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : disabled
                    ? 'cursor-not-allowed border-slate-200 bg-white/70 text-slate-400'
                    : 'border-amber-300 bg-white text-slate-800 hover:border-amber-500 hover:bg-amber-100'
              }`}
            >
              <span className="block">{agent.name}</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] opacity-75">
                {disabled ? 'Unavailable' : 'Ready'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-slate-600">
        {availableAgents.length > 0
          ? 'Choose which adapter receives the next message.'
          : 'No active adapters detected yet.'}
      </p>
    </div>
  )
}
