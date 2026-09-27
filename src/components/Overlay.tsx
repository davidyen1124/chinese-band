import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../i18n'

type Props = {
  open: boolean
  onClose: () => void
  kind: 'sheet' | 'dialog'
  title: ReactNode
  description?: ReactNode
  className?: string
  /** Selector of the element to focus on open; defaults to the panel itself. */
  initialFocus?: string
  children: ReactNode
}

/**
 * One native <dialog> for both the library sheet and the small confirmation
 * dialogs: the browser handles focus trapping, Escape and inert backgrounds.
 */
export function Overlay({ open, onClose, kind, title, description, className = '', initialFocus, children }: Props) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [id] = useState(() => `ov-${Math.random().toString(36).slice(2, 8)}`)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      d.classList.remove('closing')
      if (!d.open) {
        d.showModal()
        // Land on the panel itself (or a requested field) instead of ringing the close button.
        const target = initialFocus ? d.querySelector<HTMLElement>(initialFocus) : panel.current
        target?.focus({ preventScroll: true })
      }
      return
    }
    if (!d.open) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d.close()
      return
    }
    // Let the exit animation play before the dialog leaves the top layer.
    d.classList.add('closing')
    const timer = setTimeout(() => {
      d.classList.remove('closing')
      d.close()
    }, 230)
    return () => clearTimeout(timer)
  }, [open, initialFocus])

  // Drag the grabber down to dismiss a sheet on phones.
  const drag = useRef<{ y: number; id: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (kind !== 'sheet' || !matchMedia('(max-width: 720px)').matches) return
    drag.current = { y: e.clientY, id: e.pointerId }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    panel.current?.classList.add('dragging')
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return
    const dy = Math.max(0, e.clientY - drag.current.y)
    panel.current.style.transform = `translateY(${dy}px)`
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return
    const dy = Math.max(0, e.clientY - drag.current.y)
    drag.current = null
    panel.current.classList.remove('dragging')
    panel.current.style.transform = ''
    if (dy > 90) onClose()
  }

  return (
    <dialog
      ref={ref}
      className={`overlay overlay-${kind} ${className}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-desc` : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="overlay-panel" ref={panel} tabIndex={-1}>
        <header
          className="overlay-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {kind === 'sheet' && <span className="grabber" aria-hidden="true" />}
          <div className="overlay-heading">
            <h2 id={`${id}-title`}>{title}</h2>
            {description && <p id={`${id}-desc`}>{description}</p>}
          </div>
          <button
            type="button"
            className="icon-button overlay-close"
            aria-label={t('close')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
          >
            <X size={20} strokeWidth={1.6} />
          </button>
        </header>
        <div className="overlay-body">{children}</div>
      </div>
    </dialog>
  )
}
