import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'

export function Field({ label, hint, children }) {
  return <label className="field"><span className="field-label">{label}</span>{children}
    {hint && <small>{hint}</small>}</label>
}

export function Modal({ title, children, onClose, busy = false }) {
  const dialog = useRef(null)
  const heading = useId()
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="modal" aria-labelledby={heading} onCancel={(event) => {
    event.preventDefault()
    if (!busy) onClose()
  }}>
    <div className="modal-header"><h2 id={heading}>{title}</h2>
      <button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
    </div>{children}
  </dialog>
}

export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function run(action) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try { await action() }
    catch (cause) { setError(cause?.message || 'Couldn’t save this change. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  return { busy, error, run }
}

export function ErrorLine({ children }) {
  return children ? <p className="error-line" role="alert">{children}</p> : null
}

export function ConfirmRemove({ name, onClose, onRemove }) {
  const { busy, error, run } = useAction()
  return <Modal title={'Delete ' + name + '?'} onClose={onClose} busy={busy}>
    <p>This removes the item from your plan.</p>
    <ErrorLine>{error}</ErrorLine>
    <div className="form-actions"><button type="button" className="button outline" disabled={busy} onClick={onClose}>Keep item</button>
      <button className="button danger" disabled={busy} onClick={() => run(async () => { await onRemove(); onClose() })}>
        {busy ? 'Deleting…' : 'Delete item'}</button></div>
  </Modal>
}
