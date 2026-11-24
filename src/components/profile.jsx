import { useState } from 'react'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { CalendarDays, Check, CircleDollarSign, LogOut } from 'lucide-react'
import { bankLink, computeSummary, formatDay, money } from '../lib/finance.js'
import { defaultProfile } from '../lib/workspace.js'
import { platformClient } from '../lib/platform.js'
import { PageTitle, StatusScreen, ThemeToggle, useWorkspace, Wordmark } from './workspace.jsx'
import { ErrorLine, Field, useAction } from './forms.jsx'

const currencies = { INR: 'Indian rupee', USD: 'US dollar', GBP: 'British pound', EUR: 'Euro', CAD: 'Canadian dollar', AUD: 'Australian dollar' }
const splits = [['savings_pct', 'Savings'], ['investments_pct', 'Investments'], ['bills_pct', 'Bills']]
const numericFields = ['monthly_income', 'payday_day', 'alert_window_days', ...splits.map(([key]) => key)]

function PlanPreview({ draft, workspace, today }) {
  const example = !Number(draft.monthly_income)
  const profile = { ...draft, monthly_income: example ? 50000 : Number(draft.monthly_income), payday_day: Number(draft.payday_day) || 1 }
  const summary = computeSummary(profile, workspace?.bills ?? [], workspace?.subscriptions ?? [], today)
  const format = (value) => money(value, profile.currency)
  return <aside className="plan-preview" aria-label="Payday preview">
    <div className="preview-header"><span><CircleDollarSign size={18} />Payday preview</span><span>{profile.currency}</span></div>
    <div className="preview-amount"><span>Safe to spend</span><strong>{format(summary.remaining)}</strong>
      <span>{example ? 'Example with ' + format(50000) + ' take-home pay' : 'From your current plan'}</span></div>
    <div className="engraving" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} style={{ '--n': i }} />)}</div>
    <div className="preview-bottom"><div className="receipt-head"><h2>Income breakdown</h2><span>Monthly</span></div>
      <dl className="ledger">
        <div><dt>Take-home pay</dt><dd>{format(profile.monthly_income)}</dd></div>
        <div><dt>Savings</dt><dd>{format(summary.savings)}</dd></div>
        <div><dt>Investments</dt><dd>{format(summary.investments)}</dd></div>
        <div><dt>Bills reserve</dt><dd>{format(summary.reserve)}</dd></div>
        {summary.renewals > 0 && <div><dt>Renewals before payday</dt><dd>{format(summary.renewals)}</dd></div>}
      </dl><div className="preview-payday"><CalendarDays aria-hidden="true" size={17} /> Next payday <strong>{formatDay(summary.payday)}</strong></div>
    </div>
  </aside>
}

function ProfileForm({ setup }) {
  const { workspace, today, save, selectExample, mode } = useWorkspace()
  const [draft, setDraft] = useState(() => ({ ...defaultProfile, ...workspace.profile }))
  const [step, setStep] = useState(1)
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAction()
  const navigate = useNavigate()
  const total = splits.reduce((sum, [key]) => sum + Number(draft[key]), 0)
  function field(key) {
    return { name: key, value: draft[key] ?? '', onChange: (event) => {
      setDraft({ ...draft, [key]: event.target.value }); setSaved(false)
    } }
  }
  function submit(event) {
    event.preventDefault()
    if (setup && step === 1) { setStep(2); return }
    run(async () => {
      if (total > 100) throw new Error('Your allocations must add up to 100% or less.')
      if (draft.bank_link_template && !bankLink(draft.bank_link_template.trim(), 1, draft.currency)) {
        throw new Error('Use an HTTPS or payment app link and include {amount} where the amount belongs.')
      }
      const profile = Object.fromEntries(Object.keys(defaultProfile).map((key) =>
        [key, numericFields.includes(key) ? Number(draft[key]) : draft[key].trim()]))
      await save('profile', profile)
      if (setup) await navigate({ to: '/' })
      else setSaved(true)
    })
  }
  const details = !setup || step === 1
  const allocations = !setup || step === 2
  return <div className={'profile-layout ' + (setup ? 'setup-profile' : '')}>
    <form onSubmit={submit} className="profile-form">
      {setup && <div className="step-marker"><span>Payday setup</span><span>Step {step} of 2</span><div aria-hidden="true"><i /><i className={step === 2 ? 'filled' : ''} /></div></div>}
      {setup && <header className="form-heading"><h1>{step === 1 ? 'Plan around payday.' : 'Set money aside.'}</h1>
        <p>{step === 1 ? 'Start with your take-home pay. FinEase uses it to work out what you can spend before your next payday.'
          : 'Choose how much of each paycheque goes to savings, investments and bills.'}</p></header>}
      {details && <fieldset><legend>{setup ? 'Your income' : 'Payday profile'}</legend>
        <Field label="Monthly take-home pay"><input type="number" min="0.01" max="999999999999" step="0.01" inputMode="decimal" required
          placeholder="e.g. 50,000" {...field('monthly_income')} /></Field>
        <div className="field-grid"><Field label="Currency"><select {...field('currency')}>
          {Object.entries(currencies).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
        </select></Field><Field label="Payday each month"><select {...field('payday_day')}>
          {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>Day {i + 1}</option>)}</select></Field></div>
      </fieldset>}
      {allocations && <><fieldset><legend>Monthly allocations</legend><div className="field-grid thirds">
        {splits.map(([key, label]) => <Field key={key} label={label + ' (%)'}><input required type="number"
          min="0" max="100" step="0.01" {...field(key)} /></Field>)}</div>
        <span className={'form-note ' + (total > 100 ? 'negative' : '')}>
          {total > 100 ? 'Reduce allocations by ' + (total - 100).toFixed(2) + ' percentage points.'
            : Number((100 - total).toFixed(2)) + '% left before renewals.'}</span>
      </fieldset><fieldset><legend>Reminders and payments</legend>
        <Field label="Remind me before an item is due"><select {...field('alert_window_days')}>
          {[1, 3, 7, 14, 30].map((days) => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'} ahead</option>)}
        </select></Field>
        <Field label="Bank app link (optional)" hint="Put {amount} in the link where your banking app expects the payment amount.">
          <input type="text" maxLength="2000" placeholder="upi://pay?…&am={amount}" {...field('bank_link_template')} />
        </Field>
        {mode === 'cloud' && <Field label="WhatsApp number (optional)" hint="Include your country code.">
          <input type="tel" pattern={'\\+[1-9][0-9]{6,14}'} {...field('whatsapp_number')} /></Field>}
      </fieldset></>}
      <ErrorLine>{error}</ErrorLine>
      <div className="form-actions">{setup && step === 2 && <button type="button" className="button outline"
        onClick={() => setStep(1)} disabled={busy}>Back</button>}
        <button className="button primary" disabled={busy || (allocations && total > 100)}>
          {busy ? 'Saving…' : setup ? (step === 1 ? 'Continue to allocations' : 'Create my plan') : 'Save changes'}</button>
        {saved && <span className="saved" role="status"><Check size={16} />Changes saved</span>}
      </div>
      {setup && mode === 'local' && <div className="example-link"><span>Just looking around?</span>
        <button type="button" className="text-button" onClick={() => { selectExample(true); navigate({ to: '/' }) }}>Explore an example plan</button></div>}
    </form><PlanPreview draft={draft} workspace={workspace} today={today} />
  </div>
}

export function Setup() {
  const { workspace, signedOut, error, retry, mode } = useWorkspace()
  if (signedOut) return <Navigate to="/login" replace />
  if (error || !workspace) return <StatusScreen error={error} retry={retry} />
  if (workspace.profile) return <Navigate to="/" replace />
  return <div className="setup-page"><header className="setup-bar"><Wordmark /><div>
    <span>{mode === 'cloud' ? 'Account setup' : 'Local workspace'}</span><ThemeToggle /></div></header>
    <main className="setup-main"><ProfileForm setup /></main></div>
}

export function Settings() {
  const { mode, user } = useWorkspace()
  return <><PageTitle title="Settings">Adjust your payday plan and reminder window.</PageTitle><ProfileForm />
    {mode === 'cloud' && <div className="account-row"><span>{user?.email}</span>
      <button className="button outline" onClick={async () => (await platformClient()).auth.logout('/login')}><LogOut size={16} />Sign out</button></div>}
  </>
}
