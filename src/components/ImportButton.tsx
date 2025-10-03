import React, { useRef, useState } from 'react'
import ConfirmModal from './ConfirmModal'
import { nodesFromText } from '../lib/imports'
import type { Node } from '../types'

export type ImportButtonProps = {
  onImport: (nodes: Node[]) => void
  buttonClassName?: string
  label?: string
}

export default function ImportButton({ onImport, buttonClassName = 'btn small', label = 'Import list' }: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [pendingImport, setPendingImport] = useState<Node[] | null>(null)

  const onClickImport = () => {
    fileInputRef.current?.click()
  }

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    // Reset input value so selecting the same file again re-triggers change
    e.currentTarget.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsedNodes = nodesFromText(text)
      if (parsedNodes.length === 0) {
        window.alert('No items found in the uploaded file. Use 2-space indentation to nest groups/items.')
        return
      }
      setPendingImport(parsedNodes)
      setShowImport(true)
    } catch (err) {
      console.error(err)
      window.alert('Failed to read the file. Please ensure it is a plain text (.txt) file.')
    }
  }

  const confirmImport = () => {
    if (pendingImport && pendingImport.length > 0) {
      onImport(pendingImport)
    }
    setPendingImport(null)
    setShowImport(false)
  }

  const cancelImport = () => {
    setPendingImport(null)
    setShowImport(false)
  }

  return (
    <>
      <button className={buttonClassName} onClick={onClickImport} aria-label="Import items list from a text file">
        {label}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={onFileSelected}
        style={{ display: 'none' }}
      />
      <ConfirmModal
        open={showImport}
        title="Import new list?"
        message="Importing will replace your current list. You can still use Reset to go back to the default list."
        confirmLabel="Import"
        cancelLabel="Cancel"
        onCancel={cancelImport}
        onConfirm={confirmImport}
      />
    </>
  )
}
