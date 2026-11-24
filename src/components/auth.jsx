import { useState } from 'react'
import { Link, Navigate, useSearch } from '@tanstack/react-router'
import { platformClient } from '../lib/platform.js'
import { ErrorLine, Field, useAction } from './forms.jsx'
import { StatusScreen, ThemeToggle, useWorkspace, Wordmark } from './workspace.jsx'

const titles = { login: 'Welcome back.', register: 'Create an account.', verify: 'Check your email.', forgot: 'Reset your password.', reset: 'Set a new password.', mfa: 'Verify your sign-in.' }
const actions = { login: 'Sign in', register: 'Create account', verify: 'Verify code', forgot: 'Send reset email', reset: 'Save new password', mfa: 'Open secure sign-in' }

export function AuthPage({ view }) {
  const { mode, user } = useWorkspace()
  const search = useSearch({ strict: false })
  const [verify, setVerify] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const { busy, error, run } = useAction()
  const stage = verify ? 'verify' : view
  if (!mode) return <StatusScreen />
  if (mode !== 'cloud' || user) return <Navigate to="/" replace />
  async function submit(data) {
    const { auth } = await platformClient()
    setMessage('')
    if (stage === 'mfa') {
      if (!import.meta.env.VITE_BASE44_APP_URL) throw new Error('Configure the Base44 app URL to open hosted sign-in.')
      auth.redirectToLogin('/')
    } else if (stage === 'login') {
      const result = await auth.loginViaEmailPassword(email, data.get('password'))
      if (!result.access_token) {
        if (import.meta.env.VITE_BASE44_APP_URL) auth.redirectToLogin('/')
        else throw new Error('Sign-in requires additional verification in Base44.')
      } else window.location.assign('/')
    } else if (stage === 'register') {
      await auth.register({ email, password: data.get('password') }); setVerify(true)
    } else if (stage === 'verify') {
      await auth.verifyOtp({ email, otpCode: data.get('otp').trim() })
      window.location.assign('/login')
    } else if (stage === 'forgot') {
      await auth.resetPasswordRequest(email)
      setMessage('Check your email for the password reset link.')
    } else {
      if (!search.token) throw new Error('Open the reset link in your email to set a new password.')
      await auth.resetPassword({ resetToken: search.token, newPassword: data.get('password') })
      window.location.assign('/login')
    }
  }
  return <div className="setup-page"><header className="setup-bar"><Wordmark /><ThemeToggle /></header>
    <main className="auth-card" key={view}><h1>{titles[stage]}</h1>
      {stage === 'verify' && <p>Enter the verification code sent to {email}.</p>}
      {stage === 'mfa' && <p>Continue with your configured verification method in Base44.</p>}
      <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => submit(data)) }}>
        {['login', 'register', 'forgot'].includes(stage) && <Field label="Email"><input autoComplete="email" type="email" required
          value={email} onChange={(event) => setEmail(event.target.value)} /></Field>}
        {['login', 'register', 'reset'].includes(stage) && <Field label={stage === 'reset' ? 'New password' : 'Password'}>
          <input name="password" type="password" required minLength={stage === 'login' ? 1 : 8} autoComplete={stage === 'login' ? 'current-password' : 'new-password'} /></Field>}
        {stage === 'verify' && <Field label="Verification code"><input name="otp" autoComplete="one-time-code" inputMode="numeric" required /></Field>}
        <ErrorLine>{error}</ErrorLine>{message && <p className="success-line" role="status">{message}</p>}
        <button className="button primary" disabled={busy}>{busy ? 'Working…' : actions[stage]}</button>
      </form>
      {stage === 'login' && <><button className="button outline" disabled={busy}
        onClick={() => run(async () => (await platformClient()).auth.loginWithProvider('google', '/'))}>Sign in with Google</button>
        <div className="auth-links"><Link to="/register">Create account</Link><Link to="/forgot-password">Forgot password?</Link>
          {import.meta.env.VITE_BASE44_APP_URL && <Link to="/mfa">Use two-factor sign-in</Link>}</div></>}
      {stage !== 'login' && <Link to="/login" className="action-link">Back to sign in</Link>}
    </main></div>
}
