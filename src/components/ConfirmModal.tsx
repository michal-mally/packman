import React from 'react'

export type ConfirmModalProps = {
  open: boolean
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal(props: ConfirmModalProps) {
  const { open, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel } = props
  if (!open) return null
  const titleId = 'modal-title-' + Math.random().toString(36).slice(2, 9)
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} style={{ marginTop: 0 }}>{title}</h3>
        {message && (
          <div style={{ marginTop: 0 }}>
            {typeof message === 'string' ? <p style={{ marginTop: 0 }}>{message}</p> : message}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
