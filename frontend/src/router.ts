import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { ChatPage } from './routes/chat.js'
import { SettingsPage } from './routes/settings.js'

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

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

const mcpSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/mcp',
  beforeLoad: () => {
    throw redirect({ to: '/settings' })
  },
})

const backendSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/backends',
  beforeLoad: () => {
    throw redirect({ to: '/settings' })
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  chatRoute,
  settingsRoute,
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
