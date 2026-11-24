import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '../components/auth.jsx'

export const Route = createFileRoute('/mfa')({
  component: () => <AuthPage view="mfa" />,
})
