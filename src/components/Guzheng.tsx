import { memo, useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { keyboardRow, zhengStrings } from '../lib/catalog'
import type { AudioEngine } from '../lib/audio-engine'
import { usePlayable } from '../lib/usePlayable'
import { zhengArt, type ZhengArt } from '../lib/zhengArt'
import { useI18n } from '../i18n'

type Props = {
  engine: AudioEngine | null
  enabled: boolean
}

const bridgeSrc = `${import.meta.env.BASE_URL}images/yanzhu.webp`
const uprightQuery = '(max-height: 559px) and (orientation: landscape)'
const last = zhengStrings.length - 1

/** Absolute, because Safari resolves url() inside a custom property against the stylesheet. */
const cssUrl = (src: string) => `url("${new URL(src, document.baseURI).href}")`

/**
 * Lay the drawn strings onto the photographed instrument: pick the photo for
 * the board's shape, scale it so the rims meet the board edges, then end every
 * string exactly on the curved front bridge (岳山) traced in that photo.
 */
function useZhengGeometry(board: RefObject<HTMLElement | null>, root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = board.current
    const host = root.current
    if (!el || !host) return
    const media = matchMedia(uprightQuery)
    const update = () => {
      const { width: W, height: H } = el.getBoundingClientRect()
      if (!W || !H) return
      const upright = media.matches
      const art: ZhengArt = upright ? zhengArt.upright : W / H > 1.05 ? zhengArt.landscape : zhengArt.portrait
      // The rims run along the board's long edges, so fit the photo across the strings.
      const scale = (upright ? W : H) / art.across
      host.style.setProperty('--board-art', cssUrl(art.src))
      host.style.setProperty('--board-fill', cssUrl(art.fill))
      host.style.setProperty('--art-len', `${(art.w * scale).toFixed(1)}px`)
      host.style.setProperty('--rim-a', `${(art.rimA * scale).toFixed(1)}px`)
      host.style.setProperty('--rim-b', `${(art.rimB * scale).toFixed(1)}px`)
      host.querySelectorAll<HTMLElement>('.string').forEach((s, i) => {
        s.style.setProperty('--end', `${(art.ends[i] * scale).toFixed(1)}px`)
      })
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
 * A 21-string concert guzheng, C1 to C5, laid out the way it sits in front of
 * a player: the lowest string farthest away, the highest nearest.
 */
export const Guzheng = memo(function Guzheng({ engine, enabled }: Props) {
  const { t } = useI18n()
  const root = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  usePlayable(root, engine, enabled, zhengStrings)
  useZhengGeometry(board, root)

  return (
    <div ref={root} className="zheng instrument" role="group" aria-label={t('guzhengBoard')} data-testid="guzheng">
      <div ref={board} className="zheng-board" aria-hidden="true" />
      <div className="zheng-strings">
        {zhengStrings.map((note, i) => (
          <button
            key={note}
            type="button"
            data-note={note}
            className={`string ${note[0] === 'g' ? 'green-string' : ''}`}
            style={
              {
                // Bass bridges stand far from the front bridge, treble ones close to it.
                '--bridge': `${62 - (i / last) * 46}%`,
                '--gauge': `${2.3 - (i / last) * 1.3}px`,
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
    </div>
  )
})
