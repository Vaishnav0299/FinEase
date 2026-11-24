import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '../components/auth.jsx'

export const Route = createFileRoute('/forgot-password')({
  component: () => <AuthPage view="forgot" />,
})
