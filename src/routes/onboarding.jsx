import { createFileRoute } from '@tanstack/react-router'
import { Setup } from '../components/profile.jsx'

export const Route = createFileRoute('/onboarding')({ component: Setup })
