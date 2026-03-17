import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { ChatPage } from './routes/chat.js'
import { McpSettingsPage } from './routes/mcp-settings.js'

const rootRoute = createRootRoute({
  component: Outlet,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/chat' })
  },
})

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatPage,
})

const mcpSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/mcp',
  component: McpSettingsPage,
})

const routeTree = rootRoute.addChildren([indexRoute, chatRoute, mcpSettingsRoute])

export function createAppRouter() {
  return createRouter({ routeTree })
}

export type AppRouter = ReturnType<typeof createAppRouter>

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
