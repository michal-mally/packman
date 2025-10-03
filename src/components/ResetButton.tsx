import React, { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import { itemsFromText, defaultListText } from '../lib/imports'
import type { Item } from '../types'

export default function ResetButton({ onReset }: { onReset: (items: Item[]) => void }) {
  const [open, setOpen] = useState(false)

  const handleClick = () => setOpen(true)
  const handleCancel = () => setOpen(false)
  const handleConfirm = () => {
    const text = defaultListText()
    const result = itemsFromText(text)
    onReset(result)
    try {
      localStorage.removeItem('packman.nodes.v2')
      localStorage.removeItem('packman.items.v3')
      localStorage.removeItem('packman.state.v1')
    } catch {}
    setOpen(false)
  }

  return (
    <>
      <button className="btn small ghost" onClick={handleClick} aria-label="Reset all items to initial state">
        Reset
      </button>
      <ConfirmModal
        open={open}
        title="Reset to default list?"
        message="This will remove your current items and restore the original default list. This action cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </>
  )
}
