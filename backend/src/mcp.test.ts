import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const envKey = 'ACP_MCP_CONFIG_PATH'

afterEach(() => {
  vi.resetModules()
  delete process.env[envKey]
})

function tempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'acp-mcp-'))
  return join(dir, 'mcp.json')
}

async function loadMcpServers() {
  const { loadMcpServers: fn } = await import('./mcp.js')
  return fn()
}

describe('loadMcpServers', () => {
  it('returns empty array when config file is missing', async () => {
    process.env[envKey] = join(tmpdir(), 'nonexistent-acp-mcp', 'mcp.json')
    const servers = await loadMcpServers()
    expect(servers).toEqual([])
  })

  it('returns empty array when file contains invalid JSON', async () => {
    const path = tempConfigPath()
    writeFileSync(path, 'not json at all')
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toEqual([])
  })

  it('returns empty array when top-level value is not an object', async () => {
    const path = tempConfigPath()
    writeFileSync(path, JSON.stringify([{ name: 'bad' }]))
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toEqual([])
  })

  it('returns empty array when mcpServers is an array instead of object', async () => {
    const path = tempConfigPath()
    writeFileSync(path, JSON.stringify({ mcpServers: ['bad'] }))
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toEqual([])
  })

  it('returns empty array when mcpServers key is missing', async () => {
    const path = tempConfigPath()
    writeFileSync(path, JSON.stringify({}))
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toEqual([])
  })

  it('returns empty array when mcpServers is an empty object', async () => {
    const path = tempConfigPath()
    writeFileSync(path, JSON.stringify({ mcpServers: {} }))
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toEqual([])
  })

  it('returns a single server with only command (minimal entry)', async () => {
    const path = tempConfigPath()
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: {
          myTool: { command: 'my-tool' },
        },
      })
    )
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toEqual([{ name: 'myTool', command: 'my-tool', args: [], env: [] }])
  })

  it('maps args and env correctly for a full entry', async () => {
    const path = tempConfigPath()
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: {
          fullTool: {
            command: 'full-tool',
            args: ['--verbose', '--output=json'],
            env: { API_KEY: 'secret', REGION: 'us-east-1' },
          },
        },
      })
    )
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toEqual([
      {
        name: 'fullTool',
        command: 'full-tool',
        args: ['--verbose', '--output=json'],
        env: [
          { name: 'API_KEY', value: 'secret' },
          { name: 'REGION', value: 'us-east-1' },
        ],
      },
    ])
  })

  it('returns multiple servers preserving all entries', async () => {
    const path = tempConfigPath()
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: {
          toolA: { command: 'tool-a' },
          toolB: { command: 'tool-b', args: ['--flag'] },
        },
      })
    )
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toHaveLength(2)
    expect(servers).toEqual(
      expect.arrayContaining([
        { name: 'toolA', command: 'tool-a', args: [], env: [] },
        { name: 'toolB', command: 'tool-b', args: ['--flag'], env: [] },
      ])
    )
  })

  it('respects ACP_MCP_CONFIG_PATH env override', async () => {
    const path = tempConfigPath()
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: {
          envOverrideTool: { command: 'env-tool' },
        },
      })
    )
    process.env[envKey] = path

    const servers = await loadMcpServers()
    expect(servers).toEqual([{ name: 'envOverrideTool', command: 'env-tool', args: [], env: [] }])
  })
})
