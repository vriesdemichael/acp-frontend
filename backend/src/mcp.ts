import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { McpServer } from '@agentclientprotocol/sdk'

export interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>
}

const MCP_CONFIG_PATH =
  process.env['ACP_MCP_CONFIG_PATH'] ?? join(process.cwd(), '.acp', 'mcp.json')

function readMcpConfigFile(): McpConfig | null {
  if (!existsSync(MCP_CONFIG_PATH)) {
    return null
  }

  try {
    const raw = readFileSync(MCP_CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw) as unknown

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }

    const config = parsed as Record<string, unknown>

    if (
      'mcpServers' in config &&
      (typeof config['mcpServers'] !== 'object' ||
        config['mcpServers'] === null ||
        Array.isArray(config['mcpServers']))
    ) {
      return null
    }

    return config as McpConfig
  } catch {
    return null
  }
}

export function loadMcpServers(): McpServer[] {
  const config = readMcpConfigFile()

  if (!config) {
    return []
  }

  return Object.entries(config.mcpServers ?? {}).map(([name, server]) => ({
    name,
    command: server.command,
    args: server.args ?? [],
    env: Object.entries(server.env ?? {}).map(([envName, value]) => ({ name: envName, value })),
  }))
}
