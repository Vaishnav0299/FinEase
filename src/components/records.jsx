import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { CalendarDays, CreditCard, Pencil, Plus, ReceiptText, Repeat2 } from 'lucide-react'
import { addDays, bankLink, cycleLabels, dayInput, dueLabel, formatDay, money, monthlyEquivalent, nextChargeDate, nextOnDay, parseDay, webLink } from '../lib/finance.js'
import { ConfirmRemove, ErrorLine, Field, Modal, useAction } from './forms.jsx'
import { EmptyState, PageTitle, useWorkspace } from './workspace.jsx'
import { StatementImport } from './statement-import.jsx'

const categories = ['Housing', 'Utilities', 'Insurance', 'Transport', 'Health', 'Entertainment', 'Software', 'Education', 'Other']

function RecordEditor({ isBill, record, onClose, onDelete }) {
  const { workspace, today, save } = useWorkspace()
  const { busy, error, run } = useAction()
  const item = record ?? {}
  const kind = isBill ? 'bill' : 'subscription'
  function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    run(async () => {
      values.name = values.name.trim()
      if (!values.name) throw new Error('Enter a name for this ' + kind + '.')
      values.amount = Number(values.amount)
      const linkKey = isBill ? 'payment_link' : 'cancellation_url'
      if (values[linkKey] && !webLink(values[linkKey])) throw new Error('Enter an HTTP or HTTPS link.')
      if (isBill) {
        values.due_day = Number(values.due_day)
        values.active = values.active === 'on'
        values.autopay = values.autopay === 'on'
      } else {
        if (values.trial_end_date && values.trial_end_date > values.next_charge_date) throw new Error('Set the first charge on or after the trial end date.')
        if (!record) values.source = 'manual'
        if (values.status !== 'review') values.flagged_reason = ''
        else if (!item.flagged_reason) values.flagged_reason = values.trial_end_date ? 'Trial ending' : 'Needs a decision'
        if (record && values.amount !== record.amount) values.previous_amount = record.amount
      }
      await save(isBill ? 'bills' : 'subscriptions', values, { id: item.id })
      onClose()
    })
  }
  const payment = record && (webLink(item.payment_link) || bankLink(workspace.profile.bank_link_template, item.amount, workspace.profile.currency))
  return <Modal title={(record ? 'Edit ' : 'Add ') + kind} onClose={onClose} busy={busy}>
    <form onSubmit={submit}><fieldset className="modal-fields" disabled={busy}>
      <Field label={isBill ? 'Bill name' : 'Subscription name'}><input name="name" autoFocus required maxLength="120" defaultValue={item.name}
        placeholder={isBill ? 'e.g. Home internet' : 'e.g. Music plan'} /></Field>
      <div className="field-grid"><Field label={'Amount (' + workspace.profile.currency + ')'}><input name="amount" type="number" min="0.01" max="999999999999" step="0.01" required defaultValue={item.amount} /></Field>
        <Field label="Category"><input name="category" list="record-categories" maxLength="80" required defaultValue={item.category || 'Other'} />
          <datalist id="record-categories">{categories.map((category) => <option key={category}>{category}</option>)}</datalist></Field></div>
      {isBill ? <><Field label="Day due each month"><input type="number" name="due_day" min="1" max="31" required defaultValue={item.due_day ?? 1} /></Field>
        <div className="checks"><label><input name="active" type="checkbox" defaultChecked={item.active ?? true} />Include in my plan</label>
          <label><input name="autopay" type="checkbox" defaultChecked={item.autopay} />Paid by autopay</label></div>
        <Field label="Payment link (optional)"><input type="url" name="payment_link" maxLength="2000" defaultValue={item.payment_link} placeholder="https://" /></Field></>
        : <><div className="field-grid"><Field label="Billing cycle"><select name="cycle" defaultValue={item.cycle || 'monthly'}>
          {Object.entries(cycleLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></Field>
          <Field label="Next charge date"><input name="next_charge_date" type="date" required defaultValue={item.next_charge_date || dayInput(today)} /></Field></div>
          <div className="field-grid"><Field label="Status"><select name="status" defaultValue={item.status || 'active'}>
            <option value="active">Active</option><option value="review">Needs review</option><option value="cancelled">Cancelled</option>
          </select></Field><Field label="Trial ends (optional)"><input type="date" name="trial_end_date" defaultValue={item.trial_end_date} /></Field></div>
          <Field label="Provider cancellation link (optional)"><input type="url" name="cancellation_url" maxLength="2000" defaultValue={item.cancellation_url} placeholder="https://" /></Field>
        </>}
      <Field label="Notes (optional)"><textarea name="notes" maxLength="2000" rows="2" defaultValue={item.notes} /></Field>
      {record && isBill && payment && <a className="action-link" href={payment} target="_blank" rel="noopener noreferrer">Open payment link for {money(item.amount, workspace.profile.currency)}</a>}
      {record && !isBill && webLink(item.cancellation_url) && <a className="action-link" href={webLink(item.cancellation_url)} target="_blank" rel="noopener noreferrer">Manage with provider</a>}
    </fieldset><ErrorLine>{error}</ErrorLine><div className="modal-actions">
      {record && <button type="button" className="text-button danger-text" disabled={busy} onClick={onDelete}>Delete {kind}</button>}
      <button className="button primary" disabled={busy}>{busy ? 'Saving…' : record ? 'Save changes' : 'Add ' + kind}</button>
    </div></form>
  </Modal>
}

function RecordGroup({ title, rows, isBill, today, currency, onEdit, onStatus, busy }) {
  const [limit, setLimit] = useState(12)
  const total = rows.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100
  return <section className="panel record-group"><div className="panel-heading"><h2>{title}</h2>
    <span>{!isBill && title !== 'Cancelled' ? money(total, currency) + ' in charges' : rows.length + (rows.length === 1 ? ' item' : ' items')}</span></div>
    <ul className="record-list">{rows.slice(0, limit).map((row) => {
      const active = isBill ? row.active : row.status !== 'cancelled'
      const trial = parseDay(row.trial_end_date) >= today
      const date = active && Number.isFinite(row.due) ? formatDay(row.due) + ' · ' + dueLabel(today, row.due) : ''
      const Icon = isBill ? ReceiptText : CreditCard
      return <li key={row.id}><div className="record-overview"><span className={'row-icon ' + (isBill ? 'ochre' : '')}><Icon size={19} /></span>
        <button className="row-name edit-name" onClick={() => onEdit(row.id)}><strong>{row.name}</strong><small>{row.category || 'Other'}{isBill && row.autopay ? ' · Autopay' : ''}</small></button>
        <span className="row-value"><strong>{money(row.amount, currency)}</strong><small>{isBill ? 'Monthly' : cycleLabels[row.cycle]}</small></span>
        <button className="icon-button edit-button" onClick={() => onEdit(row.id)} aria-label={'Edit ' + row.name}><Pencil size={16} /></button></div>
        {(date || row.status === 'review' || trial) && <div className="record-details">
          {date && <span><CalendarDays size={14} />{date}</span>}{trial && active && <span>Trial ends {formatDay(parseDay(row.trial_end_date))}</span>}
          {row.status === 'review' && <span className="review-label">{row.flagged_reason || 'Needs review'}
            {row.previous_amount > 0 && row.amount > row.previous_amount ? ' from ' + money(row.previous_amount, currency) : ''}</span>}
        </div>}
        {!isBill && row.status === 'review' && <div className="row-actions"><button className="mini-button" disabled={busy} onClick={() => onStatus(row, 'active')}>Keep subscription</button>
          <button className="text-button" disabled={busy} onClick={() => onStatus(row, 'cancelled')}>Mark cancelled</button></div>}
      </li>
    })}</ul>{limit < rows.length && <button className="text-button load-more" onClick={() => setLimit(limit + 12)}>Show more</button>}
  </section>
}

export function Records({ type }) {
  const isBill = type === 'bills'
  const { workspace, today, save, remove } = useWorkspace()
  const { item } = useSearch({ strict: false })
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [filter, setFilter] = useState('all')
  const { error, busy, run } = useAction()
  const currency = workspace.profile.currency
  const activeRecord = item && workspace[type].find((row) => row.id === item)
  function select(id) {
    setDeleting(false)
    setAdding(false)
    navigate({ to: '/' + type, search: id ? { item: id } : {} })
  }
  const filters = isBill ? [['all', 'All bills'], ['active', 'Active'], ['paused', 'Paused']]
    : [['all', 'All'], ['review', 'Needs review'], ['active', 'Active'], ['cancelled', 'Cancelled']]
  const rows = workspace[type].filter((row) => filter === 'all' || (isBill ? (row.active ? 'active' : 'paused') === filter : row.status === filter))
    .map((row) => ({ ...row, due: isBill ? nextOnDay(today, row.due_day) : nextChargeDate(row, today) }))
    .sort((a, b) => a.due - b.due || a.name.localeCompare(b.name))
  const groups = isBill ? [['Active bills', rows.filter((row) => row.active)], ['Paused bills', rows.filter((row) => !row.active)]]
    : [
      ['Next 7 days', rows.filter((row) => row.status !== 'cancelled' && row.due < addDays(today, 7))],
      ['Next 30 days', rows.filter((row) => row.status !== 'cancelled' && row.due >= addDays(today, 7) && row.due < addDays(today, 30))],
      ['Later', rows.filter((row) => row.status !== 'cancelled' && row.due >= addDays(today, 30))],
      ['Cancelled', rows.filter((row) => row.status === 'cancelled')],
    ]
  const monthly = workspace[type].reduce((sum, row) => sum + (isBill ? (row.active ? row.amount : 0)
    : (row.status === 'cancelled' ? 0 : monthlyEquivalent(row))), 0)
  return <><PageTitle title={isBill ? 'Bills' : 'Subscriptions'} action={<button className="button primary" onClick={() => setAdding(true)}><Plus size={17} />
    {isBill ? 'Add bill' : 'Add subscription'}</button>}>
    {isBill ? 'Recurring payments and the dates they’re due.' : 'Review your renewals, free trials and price changes.'}</PageTitle>
    <div className="summary-strip"><Repeat2 size={19} /><span>{isBill ? 'Monthly bills' : 'Monthly equivalent'}</span><strong>{money(monthly, currency)}</strong></div>
    {!isBill && <StatementImport />}
    <div className="filter-bar" aria-label={isBill ? 'Bill status' : 'Subscription status'}>
      {filters.map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
    </div><ErrorLine>{error}</ErrorLine>
    {!rows.length && <section className="panel"><EmptyState icon={isBill ? ReceiptText : CreditCard}>
      {workspace[type].length ? 'No items match this filter.' : isBill ? 'Add your first recurring bill to track its due date.' : 'Add a subscription or import a statement to see your renewals.'}
    </EmptyState></section>}
    {groups.filter(([, items]) => items.length).map(([title, items]) => <RecordGroup key={title} title={title} rows={items} currency={currency}
      today={today} isBill={isBill} onEdit={select} busy={busy} onStatus={(row, status) => run(() => save(type, { status, flagged_reason: '' }, { id: row.id }))} />)}
    {deleting && activeRecord ? <ConfirmRemove name={activeRecord.name} onClose={() => select(null)} onRemove={() => remove(type, activeRecord.id)} />
      : (adding || activeRecord) && <RecordEditor key={activeRecord?.id ?? 'new'} isBill={isBill} record={activeRecord} onClose={() => select(null)} onDelete={() => setDeleting(true)} />}
  </>
}
