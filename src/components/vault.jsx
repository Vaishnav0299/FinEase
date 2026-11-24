import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { FileText, FolderClosed, Plus } from 'lucide-react'
import { checkedFile, documentTypes, fileAccept } from '../lib/documents.js'
import { addDays, dueLabel, formatDay, parseDay, webLink } from '../lib/finance.js'
import { ConfirmRemove, ErrorLine, Field, Modal, useAction } from './forms.jsx'
import { EmptyState, PageTitle, useWorkspace } from './workspace.jsx'

const blank = { title: '', doc_type: 'Other', issuer: '', expiry_date: '', renewal_url: '', notes: '' }

function DocumentEditor({ item, onClose, onDelete }) {
  const { save, fileUrl } = useWorkspace()
  const [draft, setDraft] = useState({ ...blank, ...item })
  const [file, setFile] = useState(null)
  const [original, setOriginal] = useState('')
  const [fileError, setFileError] = useState('')
  const { busy, error, run } = useAction()
  useEffect(() => {
    if (!item) return
    let closed = false
    let objectUrl
    fileUrl(item).then((link) => {
      objectUrl = link
      if (!closed) setOriginal(link)
      else if (link.startsWith('blob:')) URL.revokeObjectURL(link)
    }).catch(() => { if (!closed) setFileError('Couldn’t open the original. Close this dialog and try again.') })
    return () => {
      closed = true
      if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl)
    }
  }, [item?.id])
  function field(key) {
    return { value: draft[key] ?? '', onChange: (event) => setDraft({ ...draft, [key]: event.target.value }) }
  }
  async function commit() {
    const values = Object.fromEntries(Object.keys(blank).map((key) => [key, String(draft[key] || '').trim()]))
    if (!values.title) throw new Error('Give this document a title.')
    if (values.renewal_url && !webLink(values.renewal_url)) throw new Error('Enter an HTTP or HTTPS renewal link.')
    let attachment
    if (!item) {
      attachment = await checkedFile(file)
      values.filename = attachment.name
    }
    await save('documents', values, { id: item?.id, file: attachment })
    onClose()
  }
  return <Modal title={item ? 'Document details' : 'Add a document'} onClose={onClose} busy={busy}>
    <form onSubmit={(event) => { event.preventDefault(); run(commit) }}><fieldset className="modal-fields" disabled={busy}>
      {!item ? <Field label="Document file"><input type="file" required accept={fileAccept} onChange={(event) => {
        const selected = event.target.files?.[0]
        setFile(selected)
        if (!draft.title && selected) setDraft({ ...draft, title: selected.name.replace(/\.[^.]+$/, '') })
      }} /></Field>
        : <>{original && <a className="action-link" href={original} target="_blank" rel="noopener noreferrer">Open original file</a>}
          {fileError && <ErrorLine>{fileError}</ErrorLine>}</>}
      <Field label="Document title"><input required maxLength="160" {...field('title')} /></Field>
      <div className="field-grid"><Field label="Document type"><select {...field('doc_type')}>
        {documentTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
        <Field label="Expiry date (optional)"><input type="date" {...field('expiry_date')} /></Field></div>
      <Field label="Issuer (optional)"><input maxLength="160" {...field('issuer')} /></Field>
      <Field label="Renewal link (optional)"><input type="url" maxLength="2000" placeholder="https://" {...field('renewal_url')} /></Field>
      {item && webLink(item.renewal_url) && <a className="action-link" href={webLink(item.renewal_url)} target="_blank" rel="noopener noreferrer">Open renewal link</a>}
      <Field label="Notes (optional)"><textarea rows="3" maxLength="2000" {...field('notes')} /></Field>
    </fieldset><ErrorLine>{error}</ErrorLine><div className="modal-actions">
      {item && <button type="button" className="text-button danger-text" disabled={busy} onClick={onDelete}>Delete document</button>}
      <button className="button primary" disabled={busy}>{busy ? 'Working…' : item ? 'Save changes' : 'Save document'}</button>
    </div></form>
  </Modal>
}

export function Vault() {
  const { workspace, today, remove } = useWorkspace()
  const { item } = useSearch({ strict: false })
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const chosen = workspace.documents.find((row) => row.id === item)
  const docs = [...workspace.documents].sort((a, b) => (a.expiry_date || '9999').localeCompare(b.expiry_date || '9999') || a.title.localeCompare(b.title))
  function select(id) {
    setAdding(false); setDeleting(false)
    navigate({ to: '/vault', search: id ? { item: id } : {} })
  }
  return <><PageTitle title="Document vault" action={<button className="button primary" onClick={() => setAdding(true)}><Plus size={17} />Add document</button>}>
    Files and renewal dates saved in this browser.</PageTitle>
    <section className="panel"><div className="panel-heading"><h2>Your documents</h2><span>{docs.length} {docs.length === 1 ? 'file' : 'files'}</span></div>
      {!docs.length ? <EmptyState icon={FolderClosed}>Add a policy, warranty or other document to track its expiry.</EmptyState>
        : <ul className="decision-list">{docs.map((doc) => <li key={doc.id}><button className="decision-row" onClick={() => select(doc.id)}>
          <span className="row-icon"><FileText size={19} /></span><span className="row-name"><strong>{doc.title}</strong><small>{doc.doc_type}{doc.issuer ? ' · ' + doc.issuer : ''}</small></span>
          <span className="row-value">{doc.expiry_date ? <><strong>{formatDay(parseDay(doc.expiry_date))}</strong>
            <small className={parseDay(doc.expiry_date) <= addDays(today, 30) ? 'soon' : ''}>{dueLabel(today, parseDay(doc.expiry_date))}</small></> : <small>No expiry</small>}</span>
        </button></li>)}</ul>}
    </section>
    {deleting && chosen ? <ConfirmRemove name={chosen.title} onClose={() => select(null)} onRemove={() => remove('documents', chosen.id)} />
      : (adding || chosen) && <DocumentEditor key={chosen?.id ?? 'new'} item={chosen} onClose={() => select(null)} onDelete={() => setDeleting(true)} />}
  </>
}
