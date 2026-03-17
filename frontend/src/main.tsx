import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
} from '@tanstack/react-router'
import './index.css'

const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">ACP Frontend</h1>
    </div>
  ),
})

const routeTree = rootRoute.addChildren([indexRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
