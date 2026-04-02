import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readBackendConfig } from './config.js'
import { readHistorySourcesConfig } from '../history/sources-config.js'

function makeTempDir(): string {
  const dir = join(tmpdir(), `acp-config-test-${Date.now()}-${Math.random()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('readBackendConfig — legacy historyPathHints migration', () => {
  let tempDir: string
  let origBackendsEnv: string | undefined
  let origSourcesEnv: string | undefined

  beforeEach(() => {
    tempDir = makeTempDir()
    origBackendsEnv = process.env['ACP_BACKENDS_CONFIG_PATH']
    origSourcesEnv = process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']
    process.env['ACP_BACKENDS_CONFIG_PATH'] = join(tempDir, 'backends.json')
    process.env['ACP_HISTORY_SOURCES_CONFIG_PATH'] = join(tempDir, 'history-sources.json')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    if (origBackendsEnv === undefined) {
      delete process.env['ACP_BACKENDS_CONFIG_PATH']
    } else {
      process.env['ACP_BACKENDS_CONFIG_PATH'] = origBackendsEnv
    }
    if (origSourcesEnv === undefined) {
      delete process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']
    } else {
      process.env['ACP_HISTORY_SOURCES_CONFIG_PATH'] = origSourcesEnv
    }
  })

  it('migrates legacy copilot historyPathHints into history-sources.json on first read', () => {
    writeFileSync(
      process.env['ACP_BACKENDS_CONFIG_PATH']!,
      JSON.stringify({
        backends: [
          {
            id: 'copilot-vscode-host',
            name: 'GitHub Copilot VS Code (Host)',
            enabled: true,
            commandCandidates: ['copilot'],
            command: null,
            args: ['--acp'],
            historyPathHints: ['/mnt/c/Users/test/AppData/Roaming/Code/User/workspaceStorage'],
            cliHistoryPathHints: [],
          },
        ],
      }),
      'utf8'
    )

    readBackendConfig()

    const sources = readHistorySourcesConfig()
    const copilot = sources.find((s) => s.provider === 'copilot')
    expect(copilot?.paths).toEqual(['/mnt/c/Users/test/AppData/Roaming/Code/User/workspaceStorage'])
  })

  it('migrates legacy copilot cliHistoryPathHints into history-sources.json on first read', () => {
    writeFileSync(
      process.env['ACP_BACKENDS_CONFIG_PATH']!,
      JSON.stringify({
        backends: [
          {
            id: 'copilot-cli-wsl',
            name: 'GitHub Copilot CLI (WSL)',
            enabled: true,
            commandCandidates: ['copilot'],
            command: null,
            args: ['--acp'],
            historyPathHints: [],
            cliHistoryPathHints: ['/home/user/.copilot/sessions'],
          },
        ],
      }),
      'utf8'
    )

    readBackendConfig()

    const sources = readHistorySourcesConfig()
    const copilot = sources.find((s) => s.provider === 'copilot')
    expect(copilot?.cliPaths).toEqual(['/home/user/.copilot/sessions'])
  })

  it('migrates legacy gemini-cli historyPathHints into history-sources.json on first read', () => {
    writeFileSync(
      process.env['ACP_BACKENDS_CONFIG_PATH']!,
      JSON.stringify({
        backends: [
          {
            id: 'gemini-cli',
            name: 'Gemini CLI',
            enabled: true,
            commandCandidates: ['gemini'],
            command: null,
            args: ['--acp'],
            historyPathHints: ['/home/user/.gemini/history'],
            cliHistoryPathHints: [],
          },
        ],
      }),
      'utf8'
    )

    readBackendConfig()

    const sources = readHistorySourcesConfig()
    const gemini = sources.find((s) => s.provider === 'gemini')
    expect(gemini?.paths).toEqual(['/home/user/.gemini/history'])
  })

  it('does not overwrite existing non-default history-sources.json during migration', () => {
    writeFileSync(
      process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']!,
      JSON.stringify({
        sources: [
          { provider: 'copilot', paths: ['/already/configured'], cliPaths: [] },
          { provider: 'gemini', paths: [] },
          { provider: 'opencode', paths: [] },
        ],
      }),
      'utf8'
    )

    writeFileSync(
      process.env['ACP_BACKENDS_CONFIG_PATH']!,
      JSON.stringify({
        backends: [
          {
            id: 'copilot-vscode-host',
            name: 'Copilot',
            enabled: true,
            commandCandidates: ['copilot'],
            command: null,
            args: ['--acp'],
            historyPathHints: ['/should-not-overwrite'],
            cliHistoryPathHints: [],
          },
        ],
      }),
      'utf8'
    )

    readBackendConfig()

    const sources = readHistorySourcesConfig()
    const copilot = sources.find((s) => s.provider === 'copilot')
    expect(copilot?.paths).toEqual(['/already/configured'])
  })
})
