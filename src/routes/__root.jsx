import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { WorkspaceProvider } from '../components/workspace.jsx'
import stylesheet from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'FinEase | Payday planner' },
      { name: 'description', content: 'Plan your bills, renewals, and spending through payday.' },
    ],
    links: [
      { rel: 'stylesheet', href: stylesheet },
    ],
  }),
  component: Root,
})

function Root() {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        <WorkspaceProvider><Outlet /></WorkspaceProvider>
        <Scripts />
      </body>
    </html>
  )
}
