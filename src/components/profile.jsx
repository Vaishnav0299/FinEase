import { useState } from 'react'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { CalendarDays, Check, CircleDollarSign } from 'lucide-react'
import { bankLink, computeSummary, formatDay, money } from '../lib/finance.js'
import { defaultProfile } from '../lib/workspace.js'
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

export function ProfileForm({ setup = false }) {
  const { workspace, save, mode, selectExample, today } = useWorkspace()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => ({ ...defaultProfile, ...workspace?.profile }))
  const [step, setStep] = useState(1)
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAction()
  const total = splits.reduce((sum, [key]) => sum + (Number(draft[key]) || 0), 0)
  function field(key) {
    return {
      value: draft[key] ?? '',
      onChange: (event) => {
        setSaved(false)
        const next = numericFields.includes(key) ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value
        setDraft({ ...draft, [key]: next })
      },
    }
  }
  async function submit() {
    if (setup && step === 1) {
      if (!Number(draft.monthly_income) || Number(draft.monthly_income) <= 0) throw new Error('Enter your monthly take-home pay.')
      setStep(2); return
    }
    if (total > 100) throw new Error('Allocations must total 100% or less.')
    if (draft.bank_link_template && !bankLink(draft.bank_link_template, 100, draft.currency)) {
      throw new Error('Check the bank link template: use {amount} and an http, https or approved payment scheme.')
    }
    const values = {
      ...draft,
      monthly_income: Math.round(Number(draft.monthly_income)),
      payday_day: Math.min(31, Math.max(1, Number(draft.payday_day) || 1)),
      alert_window_days: Number(draft.alert_window_days) || 7,
      bank_link_template: String(draft.bank_link_template || '').trim(),
    }
    for (const [key] of splits) values[key] = Math.max(0, Math.min(100, Number(draft[key]) || 0))
    await save('profile', values)
    setSaved(true)
    if (setup) navigate({ to: '/' })
  }
  const income = setup ? step === 1 : true
  const allocations = setup ? step === 2 : true
  return <div className="profile-layout">
    <form className="profile-form" onSubmit={(event) => { event.preventDefault(); run(submit) }}>
      {setup && <div className="step-marker" aria-label={'Step ' + step + ' of 2'}>
        <span>Step {step} of 2</span><span>{step === 1 ? 'Income & payday' : 'Allocations'}</span>
        <div><i className="filled" /><i className={step === 2 ? 'filled' : ''} /></div>
      </div>}
      <header className="form-heading">
        <h1>{setup ? (step === 1 ? 'Set up your payday profile' : 'Divide your income') : 'Your payday profile'}</h1>
        <p>{setup ? (step === 1 ? 'FinEase calculates what is genuinely safe to spend between paydays.'
          : 'Choose what percentage of take-home pay is set aside before you spend.')
          : 'Your safe-to-spend figure adjusts as you change your income, payday or allocations.'}</p>
      </header>
      {income && <fieldset disabled={busy}><legend>Income details</legend>
        <div className="field-grid"><Field label="Monthly take-home pay"><input required type="number" min="1" max="999999999" step="1"
          placeholder="e.g. 75000" {...field('monthly_income')} /></Field>
          <Field label="Currency"><select {...field('currency')}>
            {Object.entries(currencies).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
          </select></Field></div>
        <Field label="Payday"><select {...field('payday_day')}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => <option key={day} value={day}>{day === 1 ? '1st of every month' : day === 2 ? '2nd' : day === 3 ? '3rd' : day + 'th of every month'}</option>)}
        </select></Field>
      </fieldset>}
      {allocations && <><fieldset disabled={busy}><legend>Monthly split</legend>
        <div className="field-grid thirds">{splits.map(([key, label]) => <Field key={key} label={label + ' (%)'}>
          <input required type="number" min="0" max="100" step="1" {...field(key)} /></Field>)}</div>
        <span className={total > 100 ? 'danger-text' : 'form-note'}>{total}% allocated{total > 100 ? ' · total must be 100% or less.'
          : Number((100 - total).toFixed(2)) + '% left before renewals.'}</span>
      </fieldset><fieldset disabled={busy}><legend>Reminders and payments</legend>
        <Field label="Remind me before an item is due"><select {...field('alert_window_days')}>
          {[1, 3, 7, 14, 30].map((days) => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'} ahead</option>)}
        </select></Field>
        <Field label="Bank app link (optional)" hint="Put {amount} in the link where your banking app expects the payment amount.">
          <input type="text" maxLength="2000" placeholder="upi://pay?…&am={amount}" {...field('bank_link_template')} />
        </Field>
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
  const { workspace, signedOut, error, retry } = useWorkspace()
  if (signedOut) return <Navigate to="/login" replace />
  if (error || !workspace) return <StatusScreen error={error} retry={retry} />
  if (workspace.profile) return <Navigate to="/" replace />
  return <div className="setup-page"><header className="setup-bar"><Wordmark /><div>
    <span>Local workspace</span><ThemeToggle /></div></header>
    <main className="setup-main"><ProfileForm setup /></main></div>
}

export function Settings() {
  return <><PageTitle title="Settings">Adjust your payday plan and reminder window.</PageTitle><ProfileForm /></>
}
