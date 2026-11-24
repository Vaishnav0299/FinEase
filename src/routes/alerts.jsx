import { createFileRoute } from '@tanstack/react-router'
import { Alerts } from '../components/dashboard.jsx'
import { WorkspacePage } from '../components/workspace.jsx'

export const Route = createFileRoute('/alerts')({
  component: () => <WorkspacePage><Alerts /></WorkspacePage>,
})
