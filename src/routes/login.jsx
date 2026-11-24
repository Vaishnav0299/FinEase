import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '../components/auth.jsx'

export const Route = createFileRoute('/login')({
  component: () => <AuthPage view="login" />,
})
