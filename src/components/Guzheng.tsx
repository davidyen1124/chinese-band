import { memo, useMemo, useRef, type CSSProperties } from 'react'
import { keyboardRow, noteNumber, notesForRegister } from '../lib/catalog'
import type { AudioEngine } from '../lib/audio-engine'
import { usePlayable } from '../lib/usePlayable'
import { useI18n } from '../i18n'

type Props = {
  engine: AudioEngine | null
  register: number
  setRegister: (r: number) => void
  bNotes: boolean
  enabled: boolean
}

const registers = [
  [3, 'regHigh'],
  [2, 'regMid'],
  [1, 'regLow'],
] as const

/** The guzheng drawn as an object: end cap with the register switch, pegs, strings and bridges. */
export const Guzheng = memo(function Guzheng({ engine, register, setRegister, bNotes, enabled }: Props) {
  const { t } = useI18n()
  const strings = useRef<HTMLDivElement>(null)
  const notes = useMemo(() => notesForRegister(register, bNotes), [register, bNotes])
  usePlayable(strings, engine, enabled, notes)
  const last = notes.length - 1

  return (
    <div className="zheng" data-testid="guzheng">
      <div className="zheng-cap">
        <div className="register" role="group" aria-label={t('register')}>
          {registers.map(([value, key], i) => (
            <span className="register-stop" key={value}>
              {i > 0 && <i aria-hidden="true" />}
              <button
                type="button"
                aria-pressed={register === value}
                aria-label={t('regLabel', { name: t(key) })}
                onClick={() => setRegister(value)}
              >
                {t(key)}
              </button>
            </span>
          ))}
        </div>
      </div>
      <div ref={strings} className="zheng-strings instrument" role="group" aria-label={t('guzhengBoard')}>
        {notes.map((note, i) => (
          <button
            key={note}
            type="button"
            data-note={note}
            className={`string ${note[0] === 'g' ? 'green-string' : ''}`}
            style={
              {
                // Treble strings are short, so their bridges sit near the far end; bass bridges walk back.
                '--bridge': `${88 - (i / last) * 62}%`,
                '--gauge': `${1 + (i / last) * 0.9}px`,
              } as CSSProperties
            }
            aria-label={t('pluck', { note: note.toUpperCase() })}
            disabled={!enabled}
            onClick={(e) => {
              if (e.detail === 0) engine?.play(note)
            }}
          >
            <span className="peg" aria-hidden="true" />
            <span className="note-name">{note.toUpperCase()}</span>
            <span className="string-track">
              <span className="string-line" />
              <span className="bridge" />
            </span>
            <span className="scale-number" aria-hidden="true">
              {noteNumber[note[0]]}
            </span>
            <span className="key-label" aria-hidden="true">
              {keyboardRow[i] ?? ''}
            </span>
          </button>
        ))}
      </div>
      <div className="zheng-tail" aria-hidden="true" />
    </div>
  )
})
