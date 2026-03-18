import type { Client, ClientCapabilities, SessionNotification } from '@agentclientprotocol/sdk'
import { detectAvailableCommand } from '../../agents/discovery.js'
import { StdioAcpProcess, type AcpSessionClient } from '../shared/process.js'

/**
 * Default command to start the Copilot CLI in official ACP mode.
 * Override with COPILOT_ACP_CMD and COPILOT_ACP_ARGS env vars.
 */
const DEFAULT_CMD = process.env['COPILOT_ACP_CMD'] ?? 'copilot'
const DEFAULT_ARGS = (process.env['COPILOT_ACP_ARGS'] ?? '--acp').split(' ').filter(Boolean)

export function isCopilotAvailable(): boolean {
  return detectAvailableCommand([DEFAULT_CMD]).detected
}

export type CopilotSessionClient = AcpSessionClient

export interface CopilotProcessOptions {
  command?: string
  args?: string[]
  clientFactory?: () => Client
  clientCapabilities?: ClientCapabilities
  onSessionUpdate?: (sessionNotification: SessionNotification) => void
  onExit?: (code: number | null) => void
}

export class CopilotProcess {
  private readonly delegate: StdioAcpProcess

  constructor(private readonly options: CopilotProcessOptions = {}) {
    this.delegate = new StdioAcpProcess({
      command: this.options.command ?? DEFAULT_CMD,
      args: this.options.args ?? DEFAULT_ARGS,
      clientFactory: this.options.clientFactory,
      clientCapabilities: this.options.clientCapabilities,
      onSessionUpdate: this.options.onSessionUpdate,
      onExit: this.options.onExit,
      stderrLabel: 'copilot',
    })
  }

  async start(): Promise<CopilotSessionClient> {
    return this.delegate.start()
  }

  stop(): void {
    this.delegate.stop()
  }
}
