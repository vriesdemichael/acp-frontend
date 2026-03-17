import { RouterProvider } from '@tanstack/react-router'
import { router, type AppRouter } from './router.js'

interface AppProps {
  routerInstance?: AppRouter
}

export function App({ routerInstance = router }: AppProps) {
  return <RouterProvider router={routerInstance} />
}
