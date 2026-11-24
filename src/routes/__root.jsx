import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router'
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
  errorComponent: ({ error }) => <main className="status-screen"><h1>Something went wrong</h1>
    <p role="alert">{error?.message || 'An unexpected error occurred.'}</p>
    <Link className="button primary" to="/">Open my plan</Link></main>,
  notFoundComponent: () => <main className="status-screen"><h1>Page not found</h1>
    <Link className="button primary" to="/">Open my plan</Link></main>,
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
