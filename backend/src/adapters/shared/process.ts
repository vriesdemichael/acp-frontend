import { spawn, type ChildProcess } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import {
  ClientSideConnection,
  PROTOCOL_VERSION,
  RequestError,
  ndJsonStream,
  type Client,
  type ClientCapabilities,
  type CreateTerminalRequest,
  type CreateTerminalResponse,
  type InitializeResponse,
  type KillTerminalRequest,
  type KillTerminalResponse,
  type NewSessionRequest,
  type NewSessionResponse,
  type PromptRequest,
  type PromptResponse,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type ReleaseTerminalRequest,
  type ReleaseTerminalResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type TerminalOutputRequest,
  type TerminalOutputResponse,
  type WaitForTerminalExitRequest,
  type WaitForTerminalExitResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
} from '@agentclientprotocol/sdk'

export interface AcpSessionClient {
  initialize(): Promise<InitializeResponse>
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>
  prompt(params: PromptRequest): Promise<PromptResponse>
  close(): Promise<void>
  readonly info: InitializeResponse | null
}

export interface StdioAcpProcessOptions {
  command: string
  args: string[]
  clientFactory?: () => Client
  clientCapabilities?: ClientCapabilities
  onSessionUpdate?: (sessionNotification: SessionNotification) => void
  onExit?: (code: number | null) => void
  stderrLabel?: string
}

export class StdioAcpProcess {
  private proc: ChildProcess | null = null
  private connection: ClientSideConnection | null = null
  private initializedInfo: InitializeResponse | null = null

  constructor(private readonly options: StdioAcpProcessOptions) {}

  async start(): Promise<AcpSessionClient> {
    this.proc = spawn(this.options.command, this.options.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim()
      if (line.length > 0) {
        console.debug(`[${this.options.stderrLabel ?? this.options.command} stderr]`, line)
      }
    })

    this.proc.on('exit', (code) => {
      this.options.onExit?.(code)
    })

    const stdin = this.proc.stdin
    const stdout = this.proc.stdout

    if (!stdin || !stdout) {
      throw new Error(`StdioAcpProcess: failed to open stdio streams for ${this.options.command}`)
    }

    const stream = ndJsonStream(Writable.toWeb(stdin), Readable.toWeb(stdout))
    this.connection = new ClientSideConnection(
      () => this.options.clientFactory?.() ?? new DefaultClient(this.options.onSessionUpdate),
      stream
    )

    this.initializedInfo = await this.connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: this.options.clientCapabilities ?? {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: {
        name: 'acp-frontend',
        title: 'ACP Frontend',
        version: '1.0.0',
      },
    })

    return {
      initialize: async () => {
        if (!this.initializedInfo) {
          throw new Error('StdioAcpProcess: connection not initialized')
        }

        return this.initializedInfo
      },
      newSession: async (params) => {
        if (!this.connection) {
          throw new Error('StdioAcpProcess: connection not initialized')
        }

        return this.connection.newSession(params)
      },
      prompt: async (params) => {
        if (!this.connection) {
          throw new Error('StdioAcpProcess: connection not initialized')
        }

        return this.connection.prompt(params)
      },
      close: async () => {
        this.stop()
      },
      info: this.initializedInfo,
    }
  }

  stop(): void {
    if (this.proc !== null && !this.proc.killed) {
      this.proc.kill('SIGTERM')
    }
  }

  async probeInitialize(): Promise<InitializeResponse> {
    const client = await this.start()

    try {
      return await client.initialize()
    } finally {
      await client.close()
    }
  }
}

class DefaultClient implements Client {
  constructor(
    private readonly onSessionUpdate?: (sessionNotification: SessionNotification) => void
  ) {}

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    throw RequestError.internalError({
      message: 'Permission handling is not implemented yet',
      request: params,
    })
  }

  async sessionUpdate(params: SessionNotification): Promise<void> {
    this.onSessionUpdate?.(params)
  }

  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    throw RequestError.internalError({
      message: 'ACP file reads are not implemented yet',
      request: params,
    })
  }

  async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    void params
    return {}
  }

  async createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    void params
    throw RequestError.internalError({
      message: 'ACP terminal integration is not implemented yet',
    })
  }

  async terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    void params
    return { output: '', truncated: false }
  }

  async releaseTerminal(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse> {
    void params
    return {}
  }

  async waitForTerminalExit(
    params: WaitForTerminalExitRequest
  ): Promise<WaitForTerminalExitResponse> {
    void params
    return { exitCode: 0 }
  }

  async killTerminal(params: KillTerminalRequest): Promise<KillTerminalResponse> {
    void params
    return {}
  }
}
