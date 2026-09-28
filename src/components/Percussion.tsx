import { memo, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { percussion } from '../lib/catalog'
import type { AudioEngine } from '../lib/audio-engine'
import { usePlayable } from '../lib/usePlayable'
import { useI18n } from '../i18n'

type Props = {
  engine: AudioEngine | null
  group: number
  setGroup: (g: number) => void
  enabled: boolean
}

/** Opera percussion as mineral-pigment pads, with the second bank one tap away. */
export const Percussion = memo(function Percussion({ engine, group, setGroup, enabled }: Props) {
  const { t, lang } = useI18n()
  const pads = useRef<HTMLDivElement>(null)
  usePlayable(pads, engine, enabled)
  return (
    <div className="drums" data-testid="percussion">
      <div
        ref={pads}
        className={`pads instrument ${group === 1 ? 'bank-two' : ''}`}
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
              data-pigment={pad.pigment}
              className={`pad ${i === 0 && group === 0 ? 'lead-pad' : ''}`}
              disabled={!enabled}
              aria-label={t('strike', { name: lang === 'zh' ? pad.name : pad.en })}
              onClick={(e) => {
                if (e.detail === 0) engine?.play(pad.id)
              }}
            >
              <span className="pad-name" lang="zh-Hant">
                {pad.name}
              </span>
              <span className="pad-en" lang="en">
                {pad.en}
              </span>
              <span className="pad-key" aria-hidden="true">
                {i + 1}
              </span>
            </button>
          ))}
      </div>
      <div className="bank-nav" aria-live="polite">
        <button type="button" onClick={() => setGroup(0)} disabled={group === 0} aria-label={t('prevBankLabel')}>
          <ChevronLeft size={17} strokeWidth={1.7} />
          <span>{t('prevBank')}</span>
        </button>
        <i aria-hidden="true" />
        <button type="button" onClick={() => setGroup(1)} disabled={group === 1} aria-label={t('nextBankLabel')}>
          <span>{t('nextBank')}</span>
          <ChevronRight size={17} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  )
})
