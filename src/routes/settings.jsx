import { createFileRoute } from '@tanstack/react-router'
import { Settings } from '../components/profile.jsx'
import { WorkspacePage } from '../components/workspace.jsx'

export const Route = createFileRoute('/settings')({
  component: () => <WorkspacePage><Settings /></WorkspacePage>,
})
