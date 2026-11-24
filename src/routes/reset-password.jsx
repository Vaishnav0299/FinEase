import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '../components/auth.jsx'

export const Route = createFileRoute('/reset-password')({
  validateSearch: ({ token, reset_token }) => ({ token: typeof (token ?? reset_token) === 'string' ? (token ?? reset_token) : '' }),
  component: () => <AuthPage view="reset" />,
})
