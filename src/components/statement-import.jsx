import { useState } from 'react'
import { FileUp, Upload } from 'lucide-react'
import { parseCsv, planImport } from '../lib/statements.js'
import { changePlan } from '../lib/local-store.js'
import { platformClient, cloudPlan } from '../lib/platform.js'
import { money } from '../lib/finance.js'
import { useWorkspace } from './workspace.jsx'
import { ErrorLine, Field, Modal, useAction } from './forms.jsx'

async function persistImport(client, userId, workspace, rows, filename) {
  const change = planImport(workspace, rows, filename)
  // Commit renewals before the transaction keys that mark an import complete.
  for (const item of change.subscriptions) {
    if (item.id) await client.entities.Subscription.update(item.id, item.values)
    else await client.entities.Subscription.upsert([{ ...item.values, owner_key: userId, merchant_key: item.merchant_key }], { key: ['owner_key', 'merchant_key'] })
  }
  for (let start = 0; start < change.transactions.length; start += 100) {
    const chunk = change.transactions.slice(start, start + 100).map((item) => ({ ...item, owner_key: userId }))
    await client.entities.Transaction.upsert(chunk, { key: ['owner_key', 'import_key'] })
  }
  return change
}

function ImportDialog({ onClose, onComplete }) {
  const { mode, workspace, user, refresh } = useWorkspace()
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState(null)
  const [positive, setPositive] = useState(true)
  const { busy, error, run } = useAction()
  const preview = rows ? planImport(workspace, rows, file.name) : null
  const isCsv = file?.name.toLowerCase().endsWith('.csv')
  async function read() {
    if (!file || !file.size || file.size > 8 * 1024 * 1024) throw new Error('Choose a nonempty file under 8 MB.')
    if (isCsv) setRows(parseCsv(await file.text(), positive))
    else if (mode === 'cloud') {
      const { parseStatement } = await import('../lib/server-fns.js')
      const data = new FormData()
      data.set('file', file)
      const client = await platformClient()
      const result = await parseStatement({ data, fetch: client.fetchWithAuth })
      if (!result.length) throw new Error('No readable transactions were found in this file.')
      setRows(result)
    } else throw new Error('Choose a CSV statement for this browser workspace.')
  }
  async function commit() {
    let change
    if (mode === 'cloud') {
      const client = await platformClient()
      change = await persistImport(client, user.id, await cloudPlan(client, user.id), rows, file.name)
    } else {
      change = await changePlan(mode, (plan) => {
        const result = planImport(plan, rows, file.name)
        plan.transactions.push(...result.transactions.map((row) => ({ ...row, id: crypto.randomUUID() })))
        for (const item of result.subscriptions) {
          if (item.id) Object.assign(plan.subscriptions.find((record) => record.id === item.id), item.values)
          else plan.subscriptions.push({ ...item.values, id: crypto.randomUUID() })
        }
        return result
      })
    }
    await refresh()
    onComplete(change.transactions.length + ' transactions imported. ' + change.subscriptions.length + ' subscriptions added or updated.')
  }
  return <Modal title={rows ? 'Review statement' : 'Import a statement'} onClose={onClose} busy={busy}>
    <form onSubmit={(event) => { event.preventDefault(); run(rows ? commit : read) }}><div className="modal-fields">
      {rows ? <><p><strong>{file.name}</strong></p>
        <p>{preview.transactions.length} new transactions · {preview.subscriptions.length} subscription changes</p>
        {preview.transactions.length === 0 ? <p>These transactions are already in your plan.</p>
          : <ul className="import-preview">{preview.transactions.map((row) => <li key={row.import_key}>
            <span>{row.merchant}<small>{row.date} · {row.direction === 'credit' ? 'Credit' : 'Debit'}</small></span>
            <strong>{money(row.amount, workspace.profile.currency)}</strong></li>)}</ul>}</>
        : <><Field label={mode === 'cloud' ? 'Bank statement (CSV, PDF or image)' : 'Bank statement (CSV)'}>
          <input type="file" required accept={mode === 'cloud' ? '.csv,.pdf,.jpg,.jpeg,.png,.webp' : '.csv,text/csv'}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field>
          {(!file || isCsv) && <><p className="form-note">Include date (YYYY-MM-DD), merchant and amount columns. Category, direction and cycle are optional.</p>
            <Field label="When the CSV has no direction column"><select value={positive ? 'positive' : 'negative'} onChange={(event) => setPositive(event.target.value === 'positive')}>
              <option value="positive">Positive amounts are spending</option><option value="negative">Negative amounts are spending</option></select></Field></>}
          {file && !isCsv && mode === 'cloud' && <p className="form-note">Base44 will read this file to extract the transactions.</p>}</>}
    </div><ErrorLine>{error}</ErrorLine><div className="modal-actions"><button type="button" className="button outline" disabled={busy} onClick={onClose}>Close</button>
      <button className="button primary" disabled={busy || !file || preview?.transactions.length === 0}>{busy ? 'Working…' : rows ? 'Import transactions' : 'Review transactions'}</button>
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
