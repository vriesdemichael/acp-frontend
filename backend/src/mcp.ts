import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>
}

const MCP_JSON_PATH = process.env['MCP_JSON_PATH'] ?? join(process.cwd(), 'mcp.json')

export function loadMcpServers(): Record<string, McpServerConfig> {
  if (!existsSync(MCP_JSON_PATH)) {
    return {}
  }
  try {
    const raw = readFileSync(MCP_JSON_PATH, 'utf8')
    const config = JSON.parse(raw) as McpConfig
    return config.mcpServers ?? {}
  } catch {
    return {}
  }
}
