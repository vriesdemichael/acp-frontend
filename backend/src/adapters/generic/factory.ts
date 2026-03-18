import { GenericAcpAdapter } from '../shared/adapter.js'
import { StdioAcpProcess } from '../shared/process.js'

export interface GenericAgentDefinition {
  id: string
  name: string
  command: string
  args: string[]
}

export function createGenericAcpAdapter(definition: GenericAgentDefinition): GenericAcpAdapter {
  return new GenericAcpAdapter({
    agentId: definition.id,
    agentName: definition.name,
    createProcess: ({ onExit, onSessionUpdate }) =>
      new StdioAcpProcess({
        command: definition.command,
        args: definition.args,
        onExit,
        onSessionUpdate,
        stderrLabel: definition.id,
      }),
  })
}
