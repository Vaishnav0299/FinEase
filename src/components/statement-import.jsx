import { useState } from 'react'
import { FileUp, Upload } from 'lucide-react'
import { parseCsv, planImport } from '../lib/statements.js'
import { changePlan } from '../lib/local-store.js'
import { money } from '../lib/finance.js'
import { useWorkspace } from './workspace.jsx'
import { ErrorLine, Field, Modal, useAction } from './forms.jsx'

function ImportDialog({ onClose, onComplete }) {
  const { mode, workspace, refresh } = useWorkspace()
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState(null)
  const [renewals] = useState([])
  const [positive, setPositive] = useState(true)
  const [visible, setVisible] = useState(25)
  const { busy, error, run } = useAction()
  const preview = rows ? planImport(workspace, rows, file.name, renewals) : null
  const noChanges = preview && !preview.transactions.length && !preview.subscriptions.length
  const isCsv = file?.name.toLowerCase().endsWith('.csv')
  async function read() {
    if (!file || !file.size || file.size > 8 * 1024 * 1024) throw new Error('Choose a nonempty file under 8 MB.')
    if (isCsv) setRows(parseCsv(await file.text(), positive))
    else throw new Error('Choose a CSV statement for this browser workspace.')
  }
  async function commit() {
    const change = await changePlan(mode, (plan) => {
      const result = planImport(plan, rows, file.name, renewals)
      plan.transactions = plan.transactions.concat(result.transactions.map((row) => ({ ...row, id: crypto.randomUUID() })))
      for (const item of result.subscriptions) {
        if (item.id) Object.assign(plan.subscriptions.find((record) => record.id === item.id), item.values)
        else plan.subscriptions.push({ ...item.values, id: crypto.randomUUID() })
      }
      return result
    })
    await refresh()
    const count = change.transactions.length, subs = change.subscriptions.length
    onComplete(count + (count === 1 ? ' transaction imported. ' : ' transactions imported. ') +
      subs + (subs === 1 ? ' subscription' : ' subscriptions') + ' added or updated.')
  }
  return <Modal title={rows ? 'Review statement' : 'Import a statement'} onClose={onClose} busy={busy}>
    <form onSubmit={(event) => { event.preventDefault(); run(rows ? commit : read) }}><fieldset className="modal-fields" disabled={busy}>
      {rows ? <><p><strong>{file.name}</strong></p>
        <p>{preview.transactions.length} new transactions · {preview.subscriptions.length} subscription changes</p>
        {noChanges && <p>These transactions are already in your plan.</p>}
        {preview.subscriptions.length > 0 && <ul className="import-preview" aria-label="Subscription changes">
          {preview.subscriptions.map(({ merchant_key, values }) => <li key={merchant_key}><span>{values.name}
            <small>{values.flagged_reason || 'Refresh renewal'} · {values.next_charge_date}</small></span>
            <strong>{money(values.amount, workspace.profile.currency)}</strong></li>)}</ul>}
        {preview.transactions.length > 0 && <ul className="import-preview" aria-label="Transactions">{preview.transactions.slice(0, visible).map((row) => <li key={row.import_key}>
            <span>{row.merchant}<small>{row.date} · {row.direction === 'credit' ? 'Credit' : 'Debit'}</small></span>
            <strong>{money(row.amount, workspace.profile.currency)}</strong></li>)}</ul>}
        {visible < preview.transactions.length && <button type="button" className="text-button" onClick={() => setVisible(visible + 25)}>Show more transactions</button>}</>
        : <><Field label="Bank statement (CSV)">
          <input type="file" required accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field>
          {(!file || isCsv) && <><p className="form-note">Include date (YYYY-MM-DD), merchant and amount columns. Category, direction and cycle are optional.</p>
            <Field label="When the CSV has no direction column"><select value={positive ? 'positive' : 'negative'} onChange={(event) => setPositive(event.target.value === 'positive')}>
              <option value="positive">Positive amounts are spending</option><option value="negative">Negative amounts are spending</option></select></Field></>}</>}
    </fieldset><ErrorLine>{error}</ErrorLine><div className="modal-actions"><button type="button" className="button outline" disabled={busy} onClick={onClose}>Close</button>
      <button className="button primary" disabled={busy || !file || noChanges}>{busy ? 'Working…' : rows ? (preview.transactions.length ? 'Import transactions' : 'Import renewals') : 'Review transactions'}</button>
    </div></form>
  </Modal>
}

export function StatementImport() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState('')
  return <><div className="import-bar"><FileUp size={21} /><span>Find recurring charges in a bank statement.</span>
    <button className="button outline" onClick={() => { setOpen(true); setResult('') }}><Upload size={15} />Import statement</button></div>
    {result && <p className="success-line" role="status">{result}</p>}
    {open && <ImportDialog onClose={() => setOpen(false)} onComplete={(message) => { setResult(message); setOpen(false) }} />}</>
}
