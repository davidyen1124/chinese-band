import { useEffect, useState } from 'react'
import { Pause, Play, Repeat2, RotateCcw, Square } from 'lucide-react'
import { Slider } from './Controls'
import { formatTime, type Song } from '../lib/catalog'
import type { AudioEngine } from '../lib/audio-engine'
import { useI18n } from '../i18n'
import { songTitle } from './songText'

type Props = {
  engine: AudioEngine | null
  song: Song
  playing: boolean
  loop: boolean
  speed: number
  onPlay: () => void
  onStop: () => void
  onLoop: () => void
  onSpeed: () => void
  onLibrary: () => void
}

export function Transport({ engine, song, playing, loop, speed, onPlay, onStop, onLoop, onSpeed, onLibrary }: Props) {
  const { t, lang } = useI18n()
  const [position, setPosition] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setPosition(engine?.position ?? 0), 100)
    return () => clearInterval(timer)
  }, [engine, song, playing])
  const title = songTitle(song, lang)
  return (
    <section className="transport" aria-label={t('player')}>
      <button type="button" className="song-summary" onClick={onLibrary} aria-label={`${t('openSongs')} · ${title.main}`}>
        <span className={`song-mark ${playing ? 'is-playing' : ''}`} aria-hidden="true" lang="zh-Hant">
          {song.category === '錄音' ? '錄' : song.title.slice(0, 1)}
        </span>
        <span className="song-text">
          <strong>{title.main}</strong>
          <small>{title.sub ?? (song.category === '錄音' ? t('myRecording') : t('backing'))}</small>
        </span>
      </button>
      <div className="play-controls">
        <button
          type="button"
          className="icon-button restart"
          onClick={() => {
            engine?.seek(0)
            setPosition(0)
          }}
          aria-label={t('restart')}
        >
          <RotateCcw size={17} strokeWidth={1.7} />
        </button>
        <button type="button" className="play-button" onClick={onPlay} aria-label={playing ? t('pause') : t('play')}>
          {playing ? <Pause size={19} fill="currentColor" strokeWidth={0} /> : <Play size={19} fill="currentColor" strokeWidth={0} />}
        </button>
        <button type="button" className="icon-button stop" onClick={onStop} aria-label={t('stop')}>
          <Square size={14} strokeWidth={1.8} />
        </button>
      </div>
      <div className="timeline">
        <time>{formatTime(position)}</time>
        <Slider
          label={t('progress')}
          min={0}
          max={song.duration}
          step={0.1}
          value={Math.min(position, song.duration)}
          valueText={`${formatTime(position)} / ${formatTime(song.duration)}`}
          onChange={(p) => {
            engine?.seek(p)
            setPosition(p)
          }}
        />
        <time>{formatTime(song.duration)}</time>
      </div>
      <button
        type="button"
        className={`icon-button loop ${loop ? 'selected' : ''}`}
        aria-label={t('loop')}
        aria-pressed={loop}
        onClick={onLoop}
      >
        <Repeat2 size={18} strokeWidth={1.7} />
      </button>
      <button type="button" className="tempo-button" onClick={onSpeed} aria-label={t('tempo')}>
        <span className="tempo-value">
          <strong>{Math.round(song.bpm * speed)}</strong>
          <span>BPM</span>
        </span>
      </button>
    </section>
  )
}

export function RecordControl({ active, engine, onClick }: { active: boolean; engine: AudioEngine | null; onClick: () => void }) {
  const { t } = useI18n()
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setElapsed(engine?.recordingDuration ?? 0), 100)
    return () => clearInterval(timer)
  }, [active, engine])
  return (
    <button
      type="button"
      className={`record-button ${active ? 'recording' : ''}`}
      onClick={onClick}
      aria-label={active ? t('recordStop') : t('recordStart')}
    >
      <span className="record-dot" />
      <span>{active ? t('saveRecording', { time: formatTime(elapsed) }) : t('record')}</span>
    </button>
  )
}
