import { spawn, type ChildProcess } from 'node:child_process'

/**
 * Default command to start the Copilot CLI in ACP server mode.
 * Override with COPILOT_ACP_CMD and COPILOT_ACP_ARGS env vars.
 *
 * NOTE: GitHub Copilot CLI ACP support is in development. The exact
 * command will be confirmed once the CLI ships ACP server mode.
 */
const DEFAULT_CMD = process.env['COPILOT_ACP_CMD'] ?? 'gh'
const DEFAULT_ARGS = (process.env['COPILOT_ACP_ARGS'] ?? 'copilot serve').split(' ')

const START_TIMEOUT_MS = 30_000

export interface CopilotProcessOptions {
  command?: string
  args?: string[]
  onExit?: (code: number | null) => void
}

export class CopilotProcess {
  private proc: ChildProcess | null = null
  public port: number | null = null

  constructor(private readonly options: CopilotProcessOptions = {}) {}

  /**
   * Spawn the Copilot CLI and wait until it reports the ACP server port.
   * The process is expected to write either:
   *   - a JSON line containing `"port": <number>`, or
   *   - a plain-text line like "listening on port <number>"
   * to stdout once the ACP server is ready.
   */
  start(): Promise<number> {
    const cmd = this.options.command ?? DEFAULT_CMD
    const args = this.options.args ?? DEFAULT_ARGS

    this.proc = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    return new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('CopilotProcess: timed out waiting for ACP server to start')),
        START_TIMEOUT_MS,
      )

      this.proc!.stdout!.on('data', (chunk: Buffer) => {
        const line = chunk.toString()
        const jsonMatch = line.match(/"port"\s*:\s*(\d+)/)
        const textMatch = line.match(/port\s+(\d+)/i)
        const portStr = jsonMatch?.[1] ?? textMatch?.[1]
        if (portStr !== undefined) {
          const port = parseInt(portStr, 10)
          this.port = port
          clearTimeout(timeout)
          resolve(port)
        }
      })

      this.proc!.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      this.proc!.on('exit', (code) => {
        this.options.onExit?.(code)
      })
    })
  }

  stop(): void {
    if (this.proc !== null && !this.proc.killed) {
      this.proc.kill('SIGTERM')
    }
  }
}
