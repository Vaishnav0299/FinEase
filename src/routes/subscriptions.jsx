import { createFileRoute } from '@tanstack/react-router'
import { Records } from '../components/records.jsx'
import { WorkspacePage } from '../components/workspace.jsx'

export const Route = createFileRoute('/subscriptions')({
  component: () => <WorkspacePage><Records type="subscriptions" /></WorkspacePage>,
})
