import { Link } from '@tanstack/react-router'
import { Bell, CalendarDays, Clock3, FileText, ListChecks, ReceiptText, Repeat2 } from 'lucide-react'
import { Cell, Pie, PieChart } from 'recharts'
import { addDays, computeSummary, decisions, dueLabel, formatDay, money, parseDay, spendingByCategory } from '../lib/finance.js'
import { EmptyState, PageTitle, useWorkspace } from './workspace.jsx'

const targets = { Bill: '/bills', Subscription: '/subscriptions', Document: '/vault', Trial: '/subscriptions' }
const icons = { Bill: ReceiptText, Subscription: Repeat2, Document: FileText, Trial: Clock3 }

function DecisionList({ items, today, currency, empty }) {
  if (!items.length) return <EmptyState icon={CalendarDays}>{empty}</EmptyState>
  return <ul className="decision-list">{items.map((item) => {
    const Icon = icons[item.kind]
    const amount = item.amount != null ? money(item.amount, currency) : null
    const days = dueLabel(today, item.due)
    return <li key={item.kind + ':' + item.id}><Link to={targets[item.kind]} className="decision-row">
      <span className={'row-icon ' + (item.kind === 'Trial' ? 'ochre' : '')}><Icon size={19} /></span>
      <span className="row-name"><strong>{item.name}</strong><small>{item.category || item.kind}{item.extra ? ' · ' + item.extra : ''}</small></span>
      <span className="row-value">{amount && <strong>{amount}</strong>}<small className={item.due <= addDays(today, 3) ? 'soon' : ''}>{days}</small></span>
    </Link></li>
  })}</ul>
}

function CategoryDonut({ workspace, today, currency }) {
  const { entries } = spendingByCategory(workspace, today)
  const palette = ['var(--chart-0)', 'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
  if (!entries.length) {
    return <EmptyState icon={ReceiptText}>No spending recorded for the last 30 days.</EmptyState>
  }
  return <div className="category-chart"><div className="donut"><PieChart width={136} height={136}>
    <Pie data={entries} dataKey="amount" innerRadius={42} outerRadius={64} paddingAngle={2} isAnimationActive={false}>
      {entries.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
    </Pie></PieChart><ReceiptText size={22} /></div>
    <ul className="chart-legend">{entries.map((entry, index) => <li key={entry.name}>
      <span className="swatch" style={{ background: palette[index % palette.length] }} />
      <span>{entry.name}</span><strong>{money(entry.amount, currency)}</strong>
    </li>)}</ul>
    <div className="chart-total"><span>30-day spending</span><strong>{money(total, currency)}</strong></div>
  </div>
}

function SplitTiles({ summary, currency }) {
  const tiles = [
    ['takeHome', 'Take-home pay', summary.monthlyIncome, 'var(--muted)'],
    ['savings', 'Savings target', summary.savings, 'var(--chart-2)'],
    ['investments', 'Investments target', summary.investments, 'var(--chart-1)'],
    ['reserve', 'Bills reserve', summary.reserve, 'var(--chart-0)'],
  ]
  const shares = [
    { label: 'Savings', width: summary.savingsPct, color: 'var(--chart-2)' },
    { label: 'Investments', width: summary.investmentsPct, color: 'var(--chart-1)' },
    { label: 'Bills reserve', width: summary.billsPct, color: 'var(--chart-0)' },
    { label: 'Free spend', width: Math.max(0, 100 - summary.savingsPct - summary.investmentsPct - summary.billsPct), color: 'var(--paper)' },
  ]
  return <section className="panel income-panel"><div className="panel-heading"><h2>Income allocations</h2><span>Monthly plan</span></div>
    <div className="split-body"><div className="split-bar" aria-label="Income allocation bar">
      {shares.map((share) => <span key={share.label} title={share.label + ' ' + share.width + '%'}
        style={{ width: share.width + '%', background: share.color }} />)}
    </div><dl className="split-figures">{tiles.map(([key, label, value, color]) => <div key={key}>
      <dt><span className="swatch" style={{ background: color }} />{label}</dt>
      <dd>{money(value, currency)}</dd>
    </div>)}</dl></div>
  </section>
}

export function Dashboard() {
  const { workspace, today } = useWorkspace()
  const { profile, bills, subscriptions, documents } = workspace
  const summary = computeSummary(profile, bills, subscriptions, today)
  const currency = profile.currency
  const nextPayday = formatDay(summary.payday)
  const daysUntil = summary.daysUntilPayday
  const upcoming = decisions(workspace, today, summary.payday)
  const reviews = subscriptions.filter((item) => item.status === 'review')
  const expiringDocs = documents.filter((doc) => doc.expiry_date && parseDay(doc.expiry_date) <= addDays(today, 30))
  return <>
    <section className={'spend-hero ' + (summary.remaining < 0 ? 'over-budget' : '')} aria-label="Safe to spend summary">
      <div className="hero-main"><div className="hero-value">
        <h2>Safe to spend until payday</h2>
        <strong>{money(summary.remaining, currency)}</strong>
        <p>{summary.remaining < 0 ? 'Upcoming commitments exceed your unallocated income by ' + money(Math.abs(summary.remaining), currency) + '.' : 'After planned savings, reserve and upcoming renewals.'}</p>
      </div><div className="countdown"><strong>{daysUntil}</strong><span>{daysUntil === 1 ? 'day to payday' : 'days to payday'}</span></div></div>
      <dl className="hero-ledger">
        <div><dt>Next payday</dt><dd>{nextPayday}</dd></div>
        <div><dt>Savings & investments</dt><dd>{money(summary.savings + summary.investments, currency)}</dd></div>
        <div><dt>Bills reserve</dt><dd>{money(summary.reserve, currency)}</dd></div>
        <div><dt>Renewals before payday</dt><dd>{money(summary.renewals, currency)}</dd></div>
      </dl>
    </section>
    <SplitTiles summary={summary} currency={currency} />
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><h2>Due before payday</h2><span>{upcoming.length} {upcoming.length === 1 ? 'commitment' : 'commitments'}</span></div>
        <DecisionList items={upcoming} today={today} currency={currency} empty="No bills or renewals are due before payday." />
      </section>
      <section className="panel"><div className="panel-heading"><h2>Spending by category</h2><span>Last 30 days</span></div>
        <CategoryDonut workspace={workspace} today={today} currency={currency} />
      </section>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><h2>Renewal watch</h2><span>{reviews.length} flagged</span></div>
        {!reviews.length ? <EmptyState icon={ListChecks}>Every recurring charge is confirmed.</EmptyState>
          : <ul className="simple-list">{reviews.map((sub) => <li key={sub.id}><Link to="/subscriptions">
            <span><strong>{sub.name}</strong><small>{sub.flagged_reason || 'Needs review'} · {sub.next_charge_date}</small></span>
            <span>Review</span></Link></li>)}</ul>}
      </section>
      <section className="panel"><div className="panel-heading"><h2>Expiring documents</h2><span>Next 30 days</span></div>
        {!expiringDocs.length ? <EmptyState icon={FileText}>No documents are expiring soon.</EmptyState>
          : <ul className="simple-list">{expiringDocs.map((doc) => <li key={doc.id}><Link to="/vault" search={{ item: doc.id }}>
            <span><strong>{doc.title}</strong><small>{doc.doc_type} · Expires {formatDay(parseDay(doc.expiry_date))}</small></span>
            <span>View</span></Link></li>)}</ul>}
      </section>
    </div>
  </>
}

export function Alerts() {
  const { workspace, today } = useWorkspace()
  const { profile } = workspace
  const days = profile.alert_window_days
  const items = decisions(workspace, today, addDays(today, days + 1))
  return <><PageTitle title="Alerts" action={<Link className="button outline" to="/settings">Reminder settings</Link>}>
    Bills, renewals and document expiries through {formatDay(addDays(today, days))}.</PageTitle>
    <section className="panel"><div className="panel-heading"><div><h2>Next {days} {days === 1 ? 'day' : 'days'}</h2><p>Sorted by due date</p></div><Bell size={20} /></div>
      <DecisionList items={items} today={today} currency={profile.currency} empty="Nothing is due in your reminder window." />
    </section>
  </>
}
