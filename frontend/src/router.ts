import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { ChatPage } from './routes/chat.js'
import { BackendSettingsPage } from './routes/backend-settings.js'
import { McpSettingsPage } from './routes/mcp-settings.js'

const rootRoute = createRootRoute({
  component: Outlet,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({
      to: '/chat',
      search: { session: undefined, project: undefined },
    })
  },
})

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  validateSearch: (search: Record<string, unknown>) => ({
    session: normalizeSearchString(search.session),
    project: normalizeSearchString(search.project),
  }),
  component: ChatPage,
})

const mcpSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/mcp',
  component: McpSettingsPage,
})

const backendSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/backends',
  component: BackendSettingsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  chatRoute,
  mcpSettingsRoute,
  backendSettingsRoute,
])

export function createAppRouter() {
  return createRouter({ routeTree })
}

export type AppRouter = ReturnType<typeof createAppRouter>

export const router = createAppRouter()

function normalizeSearchString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
