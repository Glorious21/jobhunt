'use client'

import { useEffect, useState } from 'react'

export function useEscape(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEscape, active])
}

interface ConfirmProps {
  title: string
  body: React.ReactNode
  /** When set, the user must type this word before confirming. */
  requireText?: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 420px confirm dialog with a danger action. */
export function ConfirmDialog({ title, body, requireText, confirmLabel = 'Delete', busy, onConfirm, onCancel }: ConfirmProps) {
  const [text, setText] = useState('')
  useEscape(onCancel)
  const blocked = Boolean(requireText && text.trim().toLowerCase() !== requireText)

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title">{title}</h2>
        <p>{body}</p>
        {requireText && (
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Type ${requireText} to confirm`}
            autoFocus
            aria-label={`Type ${requireText} to confirm`}
          />
        )}
        <div className="dialog-actions">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={blocked || busy} autoFocus={!requireText}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface PanelProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Left side of the footer (e.g. Delete). */
  footerStart?: React.ReactNode
  primaryLabel: string
  onPrimary: () => void
  primaryDisabled?: boolean
  busy?: boolean
}

/** 540px right-hand side panel: header, scrollable body, footer with Cancel + primary. */
export function SidePanel({ title, onClose, children, footerStart, primaryLabel, onPrimary, primaryDisabled, busy }: PanelProps) {
  useEscape(onClose)
  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2 id="panel-title" className="truncate">
            {title}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="panel-body">{children}</div>
        <div className="panel-foot">
          {footerStart}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={onPrimary} disabled={primaryDisabled || busy}>
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
