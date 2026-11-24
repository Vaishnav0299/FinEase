import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { createClient } from '@base44/sdk'
import { appId } from './platform.js'

export const authenticated = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const header = getRequestHeader('authorization') ?? ''
  if (!appId || !header.startsWith('Bearer ')) throw new Error('Sign in to use this service.')
  const client = createClient({ appId, token: header.slice(7), requiresAuth: false })
  const user = await client.auth.me()
  if (!user?.id) throw new Error('Your session has expired. Please sign in again.')
  return next({ context: { getBase44: () => client, user } })
})
