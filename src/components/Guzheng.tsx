import { memo, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { keyboardRow, notesForRegister } from '../lib/catalog'
import type { AudioEngine } from '../lib/audio-engine'
import { usePlayable } from '../lib/usePlayable'
import { useI18n } from '../i18n'

type Props = {
  engine: AudioEngine | null
  register: number
  bNotes: boolean
  enabled: boolean
}

const base = import.meta.env.BASE_URL
const bridgeSrc = `${base}images/yanzhu.webp`

/** Soundboard photographs, and where the bone nut on the front bridge (岳山) sits as a fraction of the width. */
const boards = {
  portrait: { src: `${base}images/soundboard-portrait.webp`, w: 1024, h: 1536, ridge: 0.869 },
  landscape: { src: `${base}images/soundboard-landscape.webp`, w: 1536, h: 1024, ridge: 0.876 },
  // Phones held sideways stand the strings upright: the portrait photo turned a quarter, bridge at the bottom.
  upright: { src: `${base}images/soundboard-upright.webp`, w: 1536, h: 1024, ridge: 0.869 },
}
const uprightQuery = '(max-height: 559px) and (orientation: landscape)'

/**
 * Pick the photograph that suits the board's shape and work out where its
 * front bridge lands once CSS has scaled it to cover, so the drawn strings end
 * exactly on the carved ridge at every size.
 */
function useBoardArt(board: React.RefObject<HTMLElement | null>, root: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = board.current
    const host = root.current
    if (!el || !host) return
    const media = matchMedia(uprightQuery)
    const update = () => {
      const { width: W, height: H } = el.getBoundingClientRect()
      if (!W || !H) return
      const upright = media.matches
      const art = upright ? boards.upright : W / H > 1.05 ? boards.landscape : boards.portrait
      const scale = Math.max(W / art.w, H / art.h)
      // Upright art is the portrait photo rotated, so its bridge runs along the bottom.
      const fromEdge = upright ? (1 - art.ridge) * 1024 * scale : (1 - art.ridge) * art.w * scale
      // Absolute, because Safari resolves url() inside a custom property against the stylesheet, not the page.
      host.style.setProperty('--board-art', `url("${new URL(art.src, document.baseURI).href}")`)
      host.style.setProperty('--yue', `${fromEdge.toFixed(1)}px`)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    media.addEventListener('change', update)
    update()
    return () => {
      ro.disconnect()
      media.removeEventListener('change', update)
    }
  }, [board, root])
}

/**
 * A photographed soundboard with the strings and bridges drawn over it, so the
 * strings stay real buttons. Note names sit off the wood, like pencil marks in a score.
 */
export const Guzheng = memo(function Guzheng({ engine, register, bNotes, enabled }: Props) {
  const { t } = useI18n()
  const strings = useRef<HTMLDivElement>(null)
  const notes = useMemo(() => notesForRegister(register, bNotes), [register, bNotes])
  usePlayable(strings, engine, enabled, notes)
  const board = useRef<HTMLDivElement>(null)
  useBoardArt(board, strings)
  const last = notes.length - 1

  return (
    <div ref={strings} className="zheng instrument" role="group" aria-label={t('guzhengBoard')} data-testid="guzheng">
      <div ref={board} className="zheng-board" aria-hidden="true" />
      {notes.map((note, i) => (
        <button
          key={note}
          type="button"
          data-note={note}
          className={`string ${note[0] === 'g' ? 'green-string' : ''}`}
          style={
            {
              // Treble strings are short, so their bridges sit near the front bridge; bass bridges walk back.
              '--bridge': `${78 - (i / last) * 54}%`,
              '--gauge': `${1.1 + (i / last) * 1.1}px`,
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
            <span className="string-shadow" />
            <span className="string-line" />
            <img className="bridge" src={bridgeSrc} alt="" draggable={false} />
            <span className="key-label" aria-hidden="true">
              {keyboardRow[i] ?? ''}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
})
