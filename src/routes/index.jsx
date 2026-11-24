import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '../components/dashboard.jsx'
import { WorkspacePage } from '../components/workspace.jsx'

export const Route = createFileRoute('/')({
  component: () => <WorkspacePage><Dashboard /></WorkspacePage>,
})
