import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionProjectContext } from '../agents/types.js'

const envKey = 'COPILOT_SESSION_STATE_DIR'
const historyEnvKey = 'COPILOT_HISTORY_SESSION_STATE_DIR'
const vscodeEnvKey = 'COPILOT_VSCODE_WORKSPACE_STORAGE_DIRS'

afterEach(() => {
  vi.resetModules()
  delete process.env[envKey]
  delete process.env[historyEnvKey]
  delete process.env[vscodeEnvKey]
})

describe('readCopilotCliWslSessions', () => {
  it('discovers both current and legacy copilot cli roots', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const historyDir = mkdtempSync(join(tmpdir(), 'acp-copilot-legacy-'))

    process.env[envKey] = tempDir
    process.env[historyEnvKey] = historyDir

    const { discoverCopilotCliWslHistorySources } = await import('./copilot.js')

    expect(discoverCopilotCliWslHistorySources()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'cli_session_dir',
          path: tempDir,
          access: 'readable',
        }),
        expect.objectContaining({
          kind: 'cli_history_dir',
          path: historyDir,
          access: 'readable',
        }),
      ])
    )
  })

  it('discovers mounted host vscode workspace storage sources', async () => {
    const hostRoot = mkdtempSync(join(tmpdir(), 'acp-mounted-host-'))
    const workspaceRoot = join(hostRoot, 'workspaceStorage')
    const workspaceDir = join(workspaceRoot, 'workspace-1')
    mkdirSync(join(workspaceDir, 'GitHub.copilot-chat'), { recursive: true })
    writeFileSync(join(workspaceDir, 'state.vscdb'), 'sqlite')
    process.env[vscodeEnvKey] = `/mnt/c/fake:${workspaceRoot}:/mnt/c/fake-workspace`

    const { discoverCopilotVscodeWslHistorySources } = await import('./copilot.js')
    const sources = discoverCopilotVscodeWslHistorySources([workspaceRoot])

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'vscode_workspace_db',
          path: join(workspaceDir, 'state.vscdb'),
          platform: 'linux',
        }),
        expect.objectContaining({
          kind: 'vscode_extension_resources',
          path: join(workspaceDir, 'GitHub.copilot-chat'),
          platform: 'linux',
        }),
      ])
    )
  })

  it('returns project-scoped sessions from workspace.yaml metadata', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-1')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-1',
        'cwd: /work/acp-frontend',
        'git_root: /work/acp-frontend',
        'repository: example/acp-frontend',
        'branch: main',
        'created_at: 2026-03-19T13:08:17.588Z',
        'updated_at: 2026-03-19T13:08:34.665Z',
        'summary: Review the ACP session wiring',
        '',
      ].join('\n')
    )

    writeFileSync(
      join(sessionDir, 'events.jsonl'),
      [
        JSON.stringify({
          id: 'msg-u-1',
          type: 'user.message',
          data: { content: 'Review the ACP session wiring' },
        }),
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { readCopilotCliWslSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readCopilotCliWslSessions(knownProjects)).toEqual([
      {
        id: 'session-1',
        title: 'Review the ACP session wiring',
        updatedAt: '2026-03-19T13:08:34.665Z',
        agentId: 'copilot-cli-wsl',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])
  })

  it('falls back to the first user message when summary is absent', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-2')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-2',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-19T13:08:17.588Z',
        'updated_at: 2026-03-19T13:08:34.665Z',
        '',
      ].join('\n')
    )

    writeFileSync(
      join(sessionDir, 'events.jsonl'),
      [
        JSON.stringify({ type: 'session.start', data: { sessionId: 'session-2' } }),
        JSON.stringify({
          type: 'user.message',
          data: { content: 'Investigate how Copilot links sessions to folders' },
        }),
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { readCopilotCliWslSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readCopilotCliWslSessions(knownProjects)).toEqual([
      {
        id: 'session-2',
        title: 'Investigate how Copilot links sessions to folders',
        updatedAt: '2026-03-19T13:08:34.665Z',
        agentId: 'copilot-cli-wsl',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])
  })

  it('hides Copilot sessions that have no readable messages', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-empty')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-empty',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-19T13:08:17.588Z',
        'updated_at: 2026-03-19T13:08:34.665Z',
        'summary: Empty Copilot session',
        '',
      ].join('\n')
    )

    writeFileSync(join(sessionDir, 'events.jsonl'), '')

    process.env[envKey] = tempDir
    const { readCopilotCliWslSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readCopilotCliWslSessions(knownProjects)).toEqual([])
  })

  it('ignores sessions that do not match a known project', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-3')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-3',
        'cwd: /work/other-project',
        'created_at: 2026-03-19T13:08:17.588Z',
        'updated_at: 2026-03-19T13:08:34.665Z',
        'summary: Should be hidden',
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { readCopilotCliWslSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readCopilotCliWslSessions(knownProjects)).toEqual([])
  })

  it('discovers root-level Copilot jsonl sessions with truncation events', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))

    writeFileSync(
      join(tempDir, 'session-root-1.jsonl'),
      [
        JSON.stringify({
          type: 'session.start',
          timestamp: '2026-03-21T09:00:00.000Z',
          data: {
            sessionId: 'session-root-1',
            context: { cwd: '/work/acp-frontend' },
          },
        }),
        JSON.stringify({
          type: 'user.message',
          timestamp: '2026-03-21T09:00:02.000Z',
          data: { content: 'Summarize the current status.' },
        }),
        JSON.stringify({
          type: 'session.truncation',
          timestamp: '2026-03-21T09:00:03.000Z',
          data: {
            tokenLimit: 128000,
            tokensRemovedDuringTruncation: 2400,
            messagesRemovedDuringTruncation: 4,
          },
        }),
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { readCopilotCliWslSessions, getCopilotCliWslSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(readCopilotCliWslSessions(knownProjects)).toEqual([
      {
        id: 'session-root-1',
        title: 'Summarize the current status.',
        updatedAt: '2026-03-21T09:00:03.000Z',
        agentId: 'copilot-cli-wsl',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])

    expect(getCopilotCliWslSession('session-root-1', knownProjects)?.messages).toEqual([
      { id: 'user-0', role: 'user', content: 'Summarize the current status.' },
      {
        id: 'truncation-1',
        role: 'assistant',
        content: '',
        structuredBlocks: [
          {
            kind: 'truncation_notice',
            payload: {
              tokenLimit: 128000,
              tokensRemoved: 2400,
              messagesRemoved: 4,
            },
          },
        ],
      },
    ])
  }, 15000)
})

describe('unified copilot provider (readCopilotSessions / getCopilotSession / discoverCopilotHistorySources)', () => {
  it('routes non-/mnt/ cliHistoryPathHints to WSL CLI roots and returns sessions', async () => {
    const cliDir = mkdtempSync(join(tmpdir(), 'acp-unified-wsl-'))
    const sessionDir = join(cliDir, 'unified-wsl-1')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: unified-wsl-1',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-25T10:00:00.000Z',
        'updated_at: 2026-03-25T10:05:00.000Z',
        'summary: Unified WSL session',
        '',
      ].join('\n')
    )
    writeFileSync(
      join(sessionDir, 'events.jsonl'),
      JSON.stringify({ type: 'user.message', data: { content: 'Unified WSL session' } }) + '\n'
    )

    const { readCopilotSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    // Pass cliDir as a WSL CLI hint (starts with '/' but not '/mnt/')
    const sessions = readCopilotSessions(knownProjects, [], [cliDir])

    expect(sessions).toEqual([
      expect.objectContaining({
        id: 'unified-wsl-1',
        agentId: 'copilot',
        source: 'history',
        project: expect.objectContaining({ path: '/work/acp-frontend' }),
      }),
    ])
  })

  it('routes /mnt/ cliHistoryPathHints to Host CLI roots and returns sessions', async () => {
    // We create the dir under /tmp but tell knownCliHostRoots to look there by
    // making the path *appear* to start with /mnt/ via symlink — instead, we
    // test via discoverCopilotHistorySources which returns HistorySourceDescriptors.
    // For a pure unit test we verify that a /mnt/-prefixed path is picked up as
    // a host source (missing dir → access:'missing', platform:'mounted_host').
    const { discoverCopilotHistorySources } = await import('./copilot.js')

    const sources = discoverCopilotHistorySources([], ['/mnt/c/fake-cli-host'])

    // The dir doesn't exist, so we expect access:'missing' but platform:'mounted_host'
    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'cli_session_dir',
          path: '/mnt/c/fake-cli-host',
          platform: 'mounted_host',
          access: 'missing',
        }),
      ])
    )
  })

  it('does NOT route /mnt/ cliHistoryPathHints to WSL roots', async () => {
    const { discoverCopilotHistorySources } = await import('./copilot.js')

    const sources = discoverCopilotHistorySources([], ['/mnt/c/fake-cli-host'])

    // None of the returned sources should have platform:'linux' for a /mnt/ hint
    const linuxSources = sources.filter(
      (s) => s.platform === 'linux' && s.path === '/mnt/c/fake-cli-host'
    )
    expect(linuxSources).toHaveLength(0)
  })

  it('includes VS Code sources from historyPathHints in discoverCopilotHistorySources', async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), 'acp-unified-vscode-'))
    const workspaceDir = join(storageRoot, 'workspace-unified')
    mkdirSync(join(workspaceDir, 'GitHub.copilot-chat'), { recursive: true })
    writeFileSync(join(workspaceDir, 'state.vscdb'), 'sqlite')

    const { discoverCopilotHistorySources } = await import('./copilot.js')

    // storageRoot is a linux path → will be platform:'linux'
    const sources = discoverCopilotHistorySources([storageRoot], [])

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'vscode_workspace_db',
          path: join(workspaceDir, 'state.vscdb'),
          platform: 'linux',
          backendId: 'copilot',
        }),
        expect.objectContaining({
          kind: 'vscode_extension_resources',
          path: join(workspaceDir, 'GitHub.copilot-chat'),
          platform: 'linux',
          backendId: 'copilot',
        }),
      ])
    )
  })

  it('getCopilotSession finds a session via non-/mnt/ cliHistoryPathHints', async () => {
    const cliDir = mkdtempSync(join(tmpdir(), 'acp-unified-get-'))
    const sessionDir = join(cliDir, 'unified-get-1')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: unified-get-1',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-25T11:00:00.000Z',
        'updated_at: 2026-03-25T11:05:00.000Z',
        'summary: Get by hint',
        '',
      ].join('\n')
    )
    writeFileSync(
      join(sessionDir, 'events.jsonl'),
      JSON.stringify({ id: 'msg-u-1', type: 'user.message', data: { content: 'Get by hint' } }) +
        '\n'
    )

    const { getCopilotSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    const detail = getCopilotSession('unified-get-1', knownProjects, [], [cliDir])

    expect(detail).toMatchObject({
      id: 'unified-get-1',
      agentId: 'copilot',
      source: 'history',
      messages: [{ role: 'user', content: 'Get by hint' }],
    })
  })

  it('CLI session wins over VS Code session with the same id in readCopilotSessions', async () => {
    // Create a CLI session directory
    const cliDir = mkdtempSync(join(tmpdir(), 'acp-dedup-cli-'))
    const sessionDir = join(cliDir, 'dedup-session')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: dedup-session',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-26T09:00:00.000Z',
        'updated_at: 2026-03-26T09:10:00.000Z',
        'summary: CLI title wins',
        '',
      ].join('\n')
    )
    writeFileSync(
      join(sessionDir, 'events.jsonl'),
      JSON.stringify({ type: 'user.message', data: { content: 'CLI title wins' } }) + '\n'
    )

    // Create a VS Code storage root with the same session id
    const storageRoot = mkdtempSync(join(tmpdir(), 'acp-dedup-vscode-'))
    const workspaceDir = join(storageRoot, 'ws-1')
    const chatSessionsDir = join(workspaceDir, 'chatSessions')
    mkdirSync(chatSessionsDir, { recursive: true })
    writeFileSync(
      join(workspaceDir, 'workspace.json'),
      JSON.stringify({ folder: 'vscode-remote://wsl%2Bubuntu/work/acp-frontend' })
    )
    writeFileSync(
      join(chatSessionsDir, 'dedup-session.json'),
      JSON.stringify({
        sessionId: 'dedup-session',
        customTitle: 'VS Code title (should lose)',
        lastMessageDate: Date.parse('2026-03-26T09:00:00.000Z'),
        requests: [
          {
            requestId: 'req-1',
            message: { text: 'VS Code title (should lose)' },
            response: [],
            result: { timings: { totalElapsed: 100 }, metadata: { toolCallRounds: [] } },
          },
        ],
      })
    )

    const { readCopilotSessions } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    const sessions = readCopilotSessions(knownProjects, [storageRoot], [cliDir])

    // Only one session with the CLI title
    const dedupSessions = sessions.filter((s) => s.id === 'dedup-session')
    expect(dedupSessions).toHaveLength(1)
    expect(dedupSessions[0]).toMatchObject({
      id: 'dedup-session',
      title: 'CLI title wins',
      agentId: 'copilot',
    })
  })

  it('getCopilotSession parses vscode chat session files into history messages', async () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'acp-vscode-chat-'))
    const storageRoot = join(workspaceRoot, 'workspaceStorage')
    const workspaceDir = join(storageRoot, 'workspace-1')
    const chatSessionsDir = join(workspaceDir, 'chatSessions')
    mkdirSync(chatSessionsDir, { recursive: true })
    writeFileSync(
      join(workspaceDir, 'workspace.json'),
      JSON.stringify({ folder: 'vscode-remote://wsl%2Bubuntu/work/acp-frontend' })
    )
    writeFileSync(
      join(chatSessionsDir, 'vscode-session-1.json'),
      JSON.stringify({
        sessionId: 'vscode-session-1',
        customTitle: 'Review Dockerfile session',
        lastMessageDate: Date.parse('2026-03-27T12:00:00.000Z'),
        requests: [
          {
            requestId: 'request-1',
            timestamp: Date.parse('2026-03-27T11:59:00.000Z'),
            modelId: 'copilot/gpt-5',
            message: { text: 'Review the Dockerfile' },
            variableData: {
              variables: [
                {
                  kind: 'file',
                  name: 'file:Dockerfile',
                  value: { path: '/work/acp-frontend/Dockerfile' },
                },
              ],
            },
            response: [
              { kind: 'thinking', value: '**Planning**\n\nInspecting edits first.' },
              { kind: 'prepareToolInvocation', toolName: 'copilot_readFile' },
              {
                kind: 'toolInvocationSerialized',
                invocationMessage: { value: 'Reading Dockerfile' },
                pastTenseMessage: { value: 'Read Dockerfile' },
                isComplete: true,
              },
              {
                kind: 'textEditGroup',
                uri: { path: '/work/acp-frontend/Dockerfile' },
              },
              {
                kind: 'confirmation',
                title: 'Continue to iterate?',
                message: { value: 'Copilot has been working on this problem for a while.' },
              },
            ],
            editedFileEvents: [{ eventKind: 3, uri: { path: '/work/acp-frontend/Dockerfile' } }],
            result: {
              timings: { totalElapsed: 1500 },
              metadata: {
                toolCallRounds: [{ response: 'Updated Dockerfile recommendations.' }],
              },
            },
          },
        ],
      })
    )

    // Pin the workspace storage dirs to the test root to prevent /mnt crawl
    process.env[vscodeEnvKey] = storageRoot
    const { readCopilotSessions, getCopilotSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    // Pass storageRoot as historyPathHints (VS Code workspace storage root)
    expect(readCopilotSessions(knownProjects, [storageRoot], [])).toEqual([
      {
        id: 'vscode-session-1',
        title: 'Review Dockerfile session',
        updatedAt: '2026-03-27T12:00:00.000Z',
        agentId: 'copilot',
        project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
        source: 'history',
      },
    ])

    expect(getCopilotSession('vscode-session-1', knownProjects, [storageRoot], [])).toEqual(
      expect.objectContaining({
        id: 'vscode-session-1',
        agentId: 'copilot',
        messages: [
          { id: 'request-1-user', role: 'user', content: 'Review the Dockerfile' },
          expect.objectContaining({
            id: 'request-1-assistant',
            role: 'assistant',
            content: 'Updated Dockerfile recommendations.',
            structuredBlocks: expect.arrayContaining([
              expect.objectContaining({ kind: 'reasoning' }),
              expect.objectContaining({ kind: 'attachment' }),
              expect.objectContaining({ kind: 'tool_call' }),
              expect.objectContaining({ kind: 'file_operation' }),
              expect.objectContaining({ kind: 'approval_notice' }),
            ]),
            turnInfo: expect.objectContaining({
              modelId: 'copilot/gpt-5',
              durationMs: 1500,
              modifiedFiles: ['/work/acp-frontend/Dockerfile'],
            }),
          }),
        ],
      })
    )
  })
})

describe('getCopilotCliWslSession', () => {
  it('returns full session details with messages for a known session id', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-detail-1')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-detail-1',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-20T08:00:00.000Z',
        'updated_at: 2026-03-20T08:30:00.000Z',
        'summary: Detail session',
        '',
      ].join('\n')
    )

    writeFileSync(
      join(sessionDir, 'events.jsonl'),
      [
        JSON.stringify({ type: 'session.start', data: { sessionId: 'session-detail-1' } }),
        JSON.stringify({
          type: 'session.model_change',
          timestamp: '2026-03-20T08:00:05.000Z',
          data: { newModel: 'gpt-5-mini' },
        }),
        JSON.stringify({
          id: 'msg-u-1',
          type: 'user.message',
          data: { content: 'What is a hook?' },
        }),
        JSON.stringify({
          id: 'turn-start-1',
          type: 'assistant.turn_start',
          timestamp: '2026-03-20T08:00:10.000Z',
          data: { turnId: '0', interactionId: 'int-1' },
        }),
        JSON.stringify({
          id: 'msg-a-1',
          type: 'assistant.message',
          data: {
            messageId: 'msg-a-1',
            interactionId: 'int-1',
            content: 'A hook is a function that...',
            reasoningText: '**Explaining hooks**\n\nA concise explanation helps here.',
            toolRequests: [
              {
                toolCallId: 'tool-1',
                name: 'view',
                arguments: { path: '/work/acp-frontend/src/hooks.ts' },
              },
            ],
          },
        }),
        JSON.stringify({
          id: 'tool-complete-1',
          type: 'tool.execution_complete',
          timestamp: '2026-03-20T08:00:11.000Z',
          data: {
            toolCallId: 'tool-1',
            model: 'gpt-5-mini',
            success: true,
            result: { content: 'Viewed file', detailedContent: 'src/hooks.ts contents' },
          },
        }),
        JSON.stringify({
          id: 'turn-end-1',
          type: 'assistant.turn_end',
          timestamp: '2026-03-20T08:00:16.000Z',
          data: { turnId: '0' },
        }),
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { getCopilotCliWslSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(getCopilotCliWslSession('session-detail-1', knownProjects)).toEqual({
      id: 'session-detail-1',
      title: 'Detail session',
      updatedAt: '2026-03-20T08:30:00.000Z',
      agentId: 'copilot-cli-wsl',
      project: { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
      source: 'history',
      modelState: null,
      messages: [
        { id: 'msg-u-1', role: 'user', content: 'What is a hook?' },
        {
          id: 'msg-a-1',
          role: 'assistant',
          content: 'A hook is a function that...',
          structuredBlocks: [
            {
              kind: 'reasoning',
              payload: {
                title: 'Explaining hooks',
                text: '**Explaining hooks**\n\nA concise explanation helps here.',
              },
            },
            {
              kind: 'tool_call',
              payload: {
                callId: 'tool-1',
                toolName: 'view',
                args: { path: '/work/acp-frontend/src/hooks.ts' },
                done: true,
                result: 'Viewed file\n\nsrc/hooks.ts contents',
              },
            },
          ],
          turnInfo: {
            modelId: 'gpt-5-mini',
            startedAtMs: Date.parse('2026-03-20T08:00:10.000Z'),
            completedAtMs: Date.parse('2026-03-20T08:00:16.000Z'),
            durationMs: 6000,
            modifiedFiles: [],
            patches: [],
          },
        },
      ],
    })
  })

  it('does not return VS Code sessions — CLI-only function ignores VS Code storage paths', async () => {
    // Set up a VS Code workspace storage root (the old buggy code would scan this)
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'acp-vscode-chat-'))
    const storageRoot = join(workspaceRoot, 'workspaceStorage')
    const workspaceDir = join(storageRoot, 'workspace-1')
    const chatSessionsDir = join(workspaceDir, 'chatSessions')
    mkdirSync(chatSessionsDir, { recursive: true })
    writeFileSync(
      join(workspaceDir, 'workspace.json'),
      JSON.stringify({ folder: 'vscode-remote://wsl%2Bubuntu/work/acp-frontend' })
    )
    writeFileSync(
      join(chatSessionsDir, 'vscode-session-1.json'),
      JSON.stringify({
        sessionId: 'vscode-session-1',
        customTitle: 'Review Dockerfile session',
        lastMessageDate: Date.parse('2026-03-27T12:00:00.000Z'),
        requests: [
          {
            requestId: 'request-1',
            message: { text: 'Review the Dockerfile' },
            response: [],
          },
        ],
      })
    )

    const { readCopilotCliWslSessions, getCopilotCliWslSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    // Passing a VS Code workspace storage path as a cliHistoryPathHint must NOT return VS Code sessions
    expect(readCopilotCliWslSessions(knownProjects, [storageRoot])).toEqual([])
    expect(getCopilotCliWslSession('vscode-session-1', knownProjects, [storageRoot])).toBeNull()
  })

  it('returns null when the session id is not found', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-other')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-other',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-20T08:00:00.000Z',
        'updated_at: 2026-03-20T08:30:00.000Z',
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { getCopilotCliWslSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(getCopilotCliWslSession('session-not-found', knownProjects)).toBeNull()
  })

  it('returns null when no Copilot event log is present', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-copilot-history-'))
    const sessionDir = join(tempDir, 'session-no-events')
    mkdirSync(sessionDir, { recursive: true })

    writeFileSync(
      join(sessionDir, 'workspace.yaml'),
      [
        'id: session-no-events',
        'cwd: /work/acp-frontend',
        'created_at: 2026-03-20T09:00:00.000Z',
        'updated_at: 2026-03-20T09:05:00.000Z',
        'summary: No events yet',
        '',
      ].join('\n')
    )

    process.env[envKey] = tempDir
    const { getCopilotCliWslSession } = await import('./copilot.js')

    const knownProjects: SessionProjectContext[] = [
      { id: 'repo-1', name: 'ACP Frontend', path: '/work/acp-frontend' },
    ]

    expect(getCopilotCliWslSession('session-no-events', knownProjects)).toBeNull()
  })
})
