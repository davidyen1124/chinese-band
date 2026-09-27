import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { keyboardRow, noteNumber, notesForRegister, percussion } from '../lib/catalog'
import type { AudioEngine } from '../lib/audio-engine'
import { useI18n } from '../i18n'

type Props = {
  engine: AudioEngine | null
  mode: 'guzheng' | 'percussion'
  register: number
  bNotes: boolean
  group: number
  enabled: boolean
}

export const Instrument = memo(function Instrument({ engine, mode, register, bNotes, group, enabled }: Props) {
  const { t, lang } = useI18n()
  const board = useRef<HTMLDivElement>(null)
  const notes = useMemo(() => notesForRegister(register, bNotes), [register, bNotes])

  useEffect(() => {
    const el = board.current
    if (!el || !engine || !enabled) return
    const fingers = new Map<number, string>()
    const noteAt = (x: number, y: number) => {
      const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-note]')
      return target && el.contains(target) ? (target.dataset.note ?? '') : ''
    }
    const hit = (note: string) => {
      if (note) engine.play(note)
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      const note = noteAt(e.clientX, e.clientY)
      fingers.set(e.pointerId, note)
      el.setPointerCapture(e.pointerId)
      hit(note)
    }
    const move = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return
      e.preventDefault()
      const prev = fingers.get(e.pointerId)!
      const next = noteAt(e.clientX, e.clientY)
      if (next === prev) return
      // A fast glissando can skip rows between two pointer events: fill them in.
      if (mode === 'guzheng' && prev && next) {
        const a = notes.indexOf(prev)
        const b = notes.indexOf(next)
        if (a >= 0 && b >= 0) {
          const step = a < b ? 1 : -1
          for (let i = a + step; step > 0 ? i <= b : i >= b; i += step) hit(notes[i])
        } else hit(next)
      } else hit(next)
      fingers.set(e.pointerId, next)
    }
    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId)
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }
    const clear = () => fingers.clear()
    const prevent = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    el.addEventListener('contextmenu', prevent)
    window.addEventListener('blur', clear)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('lostpointercapture', up)
      el.removeEventListener('contextmenu', prevent)
      window.removeEventListener('blur', clear)
    }
  }, [engine, mode, enabled, notes])

  if (mode === 'guzheng') {
    const last = notes.length - 1
    return (
      <div
        ref={board}
        className="instrument soundboard"
        data-testid="instrument"
        role="group"
        aria-label={t('guzhengBoard')}
      >
        <div className="strings">
          <span className="ridge ridge-tail" aria-hidden="true" />
          <span className="ridge ridge-head" aria-hidden="true" />
          {notes.map((note, i) => (
            <button
              key={note}
              type="button"
              data-note={note}
              className={`string ${note[0] === 'g' ? 'green-string' : ''}`}
              style={
                {
                  // Bass strings are longer, so their bridges sit further from the head ridge.
                  '--bridge': `${40 - (i / last) * 22}%`,
                  '--gauge': `${1 + (i / last) * 0.9}px`,
                } as CSSProperties
              }
              aria-label={t('pluck', { note: note.toUpperCase() })}
              disabled={!enabled}
              onClick={(e) => {
                if (e.detail === 0) engine?.play(note)
              }}
            >
              <span className="note-name">{note.toUpperCase()}</span>
              <span className="string-track">
                <span className="string-line" />
                <span className="bridge" />
              </span>
              <span className="scale-number">{noteNumber[note[0]]}</span>
              <span className="key-label">{keyboardRow[i] ?? ''}</span>
            </button>
          ))}
        </div>
        <div className="board-signature" aria-hidden="true">
          <span>古箏</span>
          <i />
          <span className="signature-small">清音</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={board}
      className={`instrument percussion-board ${group === 1 ? 'drum-bank' : ''}`}
      data-testid="instrument"
      role="group"
      aria-label={t('percussionBoard')}
    >
      {percussion
        .filter((p) => p.group === group)
        .map((pad, i) => (
          <button
            key={pad.id}
            type="button"
            data-note={pad.id}
            className={`drum-pad ${i === 0 && group === 0 ? 'lead-pad' : ''}`}
            data-material={pad.material}
            disabled={!enabled}
            aria-label={t('strike', { name: lang === 'zh' ? pad.name : pad.en })}
            onClick={(e) => {
              if (e.detail === 0) engine?.play(pad.id)
            }}
          >
            <span className="pad-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="pad-name" lang="zh-Hant">
              {pad.name}
            </span>
            <span className="pad-english" lang="en">
              {pad.en}
            </span>
          </button>
        ))}
    </div>
  )
})
