import { createFileRoute } from '@tanstack/react-router'
import { Vault } from '../components/vault.jsx'
import { WorkspacePage } from '../components/workspace.jsx'

export const Route = createFileRoute('/vault')({
  validateSearch: ({ item }) => typeof item === 'string' ? { item } : {},
  component: () => <WorkspacePage><Vault /></WorkspacePage>,
})
