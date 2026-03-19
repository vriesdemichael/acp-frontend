import { readFileSync, existsSync } from 'node:fs'
import type { McpServer } from '@agentclientprotocol/sdk'
import { getConfigPath } from './storage.js'

interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>
}

const MCP_JSON_PATH = process.env['MCP_JSON_PATH'] ?? getConfigPath('mcp.json')

export function loadMcpServers(): McpServer[] {
  if (!existsSync(MCP_JSON_PATH)) {
    return []
  }
  try {
    const raw = readFileSync(MCP_JSON_PATH, 'utf8')
    const config = JSON.parse(raw) as McpConfig
    return Object.entries(config.mcpServers ?? {}).map(([name, server]) => ({
      name,
      command: server.command,
      args: server.args ?? [],
      env: Object.entries(server.env ?? {}).map(([envName, value]) => ({ name: envName, value })),
    }))
  } catch {
    return []
  }
}
