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
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter+Tight:wght@400;500;600;700&display=swap' },
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
