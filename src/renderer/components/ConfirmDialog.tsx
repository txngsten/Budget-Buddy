import React, { useEffect, useRef } from 'react'

interface Props {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-small" onClick={e => e.stopPropagation()}>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
          <div className="form-actions">
            <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
            <button className="btn" ref={cancelRef} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
