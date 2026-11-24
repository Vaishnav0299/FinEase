import { createFileRoute } from '@tanstack/react-router'
import { Records } from '../components/records.jsx'
import { WorkspacePage } from '../components/workspace.jsx'

export const Route = createFileRoute('/bills')({
  validateSearch: ({ item }) => typeof item === 'string' ? { item } : {},
  component: () => <WorkspacePage><Records type="bills" /></WorkspacePage>,
})
