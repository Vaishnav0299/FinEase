import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bell, CalendarDays, CircleDollarSign, Clock3, FileText, ListChecks, Mail, ReceiptText, Repeat2, TriangleAlert } from 'lucide-react'
import { Cell, Pie, PieChart } from 'recharts'
import { addDays, computeSummary, dayInput, decisions, dueLabel, formatDay, money, parseDay, spendingByCategory } from '../lib/finance.js'
import { EmptyState, PageTitle, useWorkspace } from './workspace.jsx'
import { ErrorLine, useAction } from './forms.jsx'

const targets = { Bill: '/bills', Subscription: '/subscriptions', Document: '/vault', Trial: '/subscriptions' }
const icons = { Bill: ReceiptText, Subscription: Repeat2, Document: FileText, Trial: Clock3 }

function DecisionList({ items, today, currency, empty }) {
  if (!items.length) return <EmptyState icon={CalendarDays}>{empty}</EmptyState>
  return <ul className="decision-list">{items.map((item) => {
    const Icon = icons[item.kind]
    const trial = item.kind === 'Trial' || (item.kind === 'Subscription' && parseDay(item.trial_end_date) === item.due)
    return <li key={[item.kind, item.id, item.due].join('-')}><Link to={targets[item.kind]} search={{ item: item.id }} className="decision-row">
      <span className={'row-icon ' + (item.kind === 'Bill' ? 'ochre' : '')}><Icon aria-hidden="true" size={19} /></span>
      <span className="row-name"><strong>{item.name}</strong><small>{trial ? 'Trial ends' : item.kind} · {formatDay(item.due)}</small></span>
      <span className="row-value">{item.amount !== undefined && <strong>{money(item.amount, currency)}</strong>}
        <small className={item.due <= addDays(today, 2) ? 'soon' : ''}>{dueLabel(today, item.due)}</small></span>
    </Link></li>
  })}</ul>
}

function CategoryChart({ workspace, today, currency }) {
  const { imported, entries } = spendingByCategory(workspace, today)
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
  const buckets = entries.length > 5
    ? [...entries.slice(0, 4), { name: 'Remaining categories', amount: entries.slice(4).reduce((sum, entry) => sum + entry.amount, 0) }]
    : entries
  return <section className="panel"><div className="panel-heading"><div><h2>Spending by category</h2>
    <p>{imported ? 'Transactions from the last 30 days' : 'Monthly equivalent of recurring charges'}</p></div></div>
    {buckets.length ? <div className="category-chart">
      <div className="donut" aria-hidden="true"><PieChart width={136} height={136} accessibilityLayer={false}>
        <Pie data={buckets} dataKey="amount" startAngle={90} endAngle={-270} outerRadius={64} innerRadius={47} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
          {buckets.map((entry, i) => <Cell key={entry.name} fill={'var(--chart-' + i + ')'} />)}
        </Pie></PieChart><CircleDollarSign size={24} /></div>
      <ul className="chart-legend">{buckets.map(({ name, amount }, i) => <li key={name}>
        <span className="swatch" style={{ backgroundColor: 'var(--chart-' + i + ')' }} />
        <span>{name}</span><strong>{money(amount, currency)}</strong>
      </li>)}</ul><div className="chart-total"><span>Total</span><strong>{money(total, currency)}</strong></div>
    </div> : <EmptyState icon={ReceiptText}>{imported ? 'No spending in the last 30 days.' : 'Add a bill or subscription to see the breakdown.'}</EmptyState>}
  </section>
}

export function Dashboard() {
  const { workspace, today } = useWorkspace()
  const { profile } = workspace
  const summary = computeSummary(profile, workspace.bills, workspace.subscriptions, today)
  const format = (amount) => money(amount, profile.currency)
  const upcoming = decisions(workspace, today, summary.payday).filter((item) => item.kind !== 'Document')
  const watch = workspace.subscriptions.filter((item) => item.status === 'review')
  const expiries = workspace.documents.filter((item) => {
    const due = parseDay(item.expiry_date)
    return due >= today && due <= addDays(today, 30)
  }).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
  return <><PageTitle title="Payday overview">Your spending plan through {formatDay(summary.payday)}.</PageTitle>
    <section className={'spend-hero ' + (summary.remaining < 0 ? 'over-budget' : '')}>
      <div className="hero-main"><div className="hero-value"><h2><CircleDollarSign size={19} />Safe to spend</h2>
        <strong>{format(summary.remaining)}</strong>
        <p>{summary.remaining < 0 ? 'Your commitments exceed your take-home pay.' : 'Available after your planned commitments.'}</p>
      </div><div className="countdown"><CalendarDays size={18} /><strong>{summary.days}</strong>
        <span>{summary.days === 1 ? 'day' : 'days'} to payday</span></div></div>
      <dl className="hero-ledger">{[
        ['Savings', summary.savings], ['Investments', summary.investments], ['Bills reserve', summary.reserve], ['Renewals', summary.renewals],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{format(value)}</dd></div>)}</dl>
    </section>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h2>Before payday</h2>
      <p>Bills, renewals and trials due before {formatDay(summary.payday)}</p></div></div>
      <DecisionList items={upcoming} today={today} currency={profile.currency} empty="You have no charges due before payday." />
    </section><CategoryChart workspace={workspace} today={today} currency={profile.currency} /></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h2>Renewal watch</h2><p>Subscriptions waiting for a decision</p></div></div>
      {watch.length ? <ul className="simple-list">{watch.map((item) => <li key={item.id}><Link to="/subscriptions" search={{ item: item.id }}>
        <span><strong>{item.name}</strong><small>{item.flagged_reason || 'Needs review'}</small></span><span>Review</span></Link></li>)}</ul>
        : <EmptyState icon={ListChecks}>All subscriptions are reviewed.</EmptyState>}
    </section><section className="panel"><div className="panel-heading"><div><h2>Expiring documents</h2><p>Renewals in the next 30 days</p></div></div>
      <DecisionList items={expiries.map((item) => ({ ...item, name: item.title, kind: 'Document', due: parseDay(item.expiry_date) }))}
        today={today} currency={profile.currency} empty="No documents expire in the next 30 days." />
    </section></div>
  </>
}

export function Alerts() {
  const { workspace, today, mode, user } = useWorkspace()
  const { profile } = workspace
  const days = profile.alert_window_days
  const items = decisions(workspace, today, addDays(today, days + 1))
  const { busy, error, run } = useAction()
  const [message, setMessage] = useState('')
  async function send() {
    setMessage('')
    const { sendAlerts } = await import('../lib/server-fns.js')
    const { platformClient } = await import('../lib/platform.js')
    const client = await platformClient()
    const result = await sendAlerts({ data: { today: dayInput(today) }, fetch: client.fetchWithAuth })
    setMessage(result.message)
  }
  return <><PageTitle title="Alerts" action={<Link className="button outline" to="/settings">Reminder settings</Link>}>
    Bills, renewals and document expiries through {formatDay(addDays(today, days))}.</PageTitle>
    <section className="panel"><div className="panel-heading"><div><h2>Next {days} {days === 1 ? 'day' : 'days'}</h2><p>Sorted by due date</p></div><Bell size={20} /></div>
      <DecisionList items={items} today={today} currency={profile.currency} empty="Nothing is due in your reminder window." />
    </section>
    {mode === 'cloud' && <section className="delivery-row"><div><h2>Reminder digest</h2><p>Send these reminders to {user.email}.</p></div>
      <button className="button primary" disabled={busy || !items.length} onClick={() => run(send)}><Mail size={17} />{busy ? 'Sending…' : 'Send digest'}</button>
    </section>}
    <ErrorLine>{error}</ErrorLine>{message && <p role="status" className="success-line">{message}</p>}
  </>
}
