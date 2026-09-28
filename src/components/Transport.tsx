import { useEffect, useState } from 'react'
import { Pause, Play, Repeat2, RotateCcw, Settings, Square } from 'lucide-react'
import { Slider } from './Controls'
import { formatTime, type Song } from '../lib/catalog'
import type { AudioEngine } from '../lib/audio-engine'
import { usePosition } from '../lib/usePosition'
import { useI18n } from '../i18n'
import { songTitle } from './songText'

type PillProps = {
  engine: AudioEngine | null
  song: Song
  playing: boolean
  speed: number
  recording: boolean
  onRecord: () => void
  onPlay: () => void
  onSongs: () => void
  onSettings: () => void
}

/** The one floating control: record, the song with its progress ring, and settings. */
export function Pill({ engine, song, playing, speed, recording, onRecord, onPlay, onSongs, onSettings }: PillProps) {
  const { t, lang } = useI18n()
  const [position] = usePosition(engine, `${song.id}-${playing}`)
  const title = songTitle(song, lang)
  const progress = song.duration ? Math.min(1, position / song.duration) : 0
  // A recording's tempo is just whatever the backing track was doing; leave it off.
  const bpm = song.category === '錄音' ? '' : `${Math.round(song.bpm * speed)} BPM`
  return (
    <section className="pill" aria-label={t('player')}>
      <RecordButton active={recording} engine={engine} onClick={onRecord} />
      <i className="pill-divider" aria-hidden="true" />
      <div className="pill-player">
        <button type="button" className="pill-play" onClick={onPlay} aria-label={playing ? t('pause') : t('play')}>
          <svg className="ring" viewBox="0 0 48 48" aria-hidden="true">
            <circle className="ring-track" cx="24" cy="24" r="21.5" />
            <circle
              className="ring-fill"
              cx="24"
              cy="24"
              r="21.5"
              pathLength="100"
              strokeDasharray={`${Math.max(0.01, progress * 100)} 100`}
            />
          </svg>
          {playing ? <Pause size={17} fill="currentColor" strokeWidth={0} /> : <Play size={17} fill="currentColor" strokeWidth={0} />}
        </button>
        <button type="button" className="pill-song" onClick={onSongs} aria-label={`${t('openSongs')} · ${title.main}`}>
          <span className="pill-line">
            <strong className="pill-title">{title.main}</strong>
            {bpm && <small className="pill-bpm pill-bpm-top">{bpm}</small>}
          </span>
          <span className="pill-sub">
            {title.sub && <span>{title.sub}</span>}
            {bpm && <small className="pill-bpm">{bpm}</small>}
          </span>
          <span className="pill-time">
            {formatTime(position)} / {formatTime(song.duration)}
            {bpm && <small className="pill-bpm pill-bpm-time">{bpm}</small>}
          </span>
        </button>
      </div>
      <i className="pill-divider" aria-hidden="true" />
      <button type="button" className="pill-gear" onClick={onSettings} aria-label={t('openSettings')}>
        <Settings size={22} strokeWidth={1.5} />
      </button>
    </section>
  )
}

function RecordButton({ active, engine, onClick }: { active: boolean; engine: AudioEngine | null; onClick: () => void }) {
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
      className={`pill-record ${active ? 'recording' : ''}`}
      onClick={onClick}
      aria-label={active ? t('recordStop') : t('recordStart')}
    >
      <span className="record-dot" />
      <span className="record-label">{active ? t('saveRecording', { time: formatTime(elapsed) }) : t('record')}</span>
    </button>
  )
}

type NowPlayingProps = {
  engine: AudioEngine | null
  song: Song
  playing: boolean
  loop: boolean
  speed: number
  onPlay: () => void
  onStop: () => void
  onLoop: () => void
  onTempo: () => void
}

/** Full transport at the top of the songs sheet. */
export function NowPlaying({ engine, song, playing, loop, speed, onPlay, onStop, onLoop, onTempo }: NowPlayingProps) {
  const { t, lang } = useI18n()
  const [position, setPosition] = usePosition(engine, `${song.id}-${playing}`)
  const title = songTitle(song, lang)
  return (
    <section className="now-playing" aria-label={t('player')}>
      <div className="np-head">
        <span className="song-mark" aria-hidden="true" lang="zh-Hant">
          {song.category === '錄音' ? '錄' : song.title.slice(0, 1)}
        </span>
        <div className="np-title">
          <small>{t('nowPlaying')}</small>
          <strong>{title.main}</strong>
          {title.sub && <span>{title.sub}</span>}
        </div>
      </div>
      <div className="np-timeline">
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
        <div className="np-times">
          <time>{formatTime(position)}</time>
          <time>{formatTime(song.duration)}</time>
        </div>
      </div>
      <div className="np-controls">
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            engine?.seek(0)
            setPosition(0)
          }}
          aria-label={t('restart')}
        >
          <RotateCcw size={18} strokeWidth={1.7} />
        </button>
        <button type="button" className="icon-button" onClick={onStop} aria-label={t('stop')}>
          <Square size={15} strokeWidth={1.8} />
        </button>
        <button type="button" className="np-play" onClick={onPlay} aria-label={playing ? t('pause') : t('play')}>
          {playing ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
        </button>
        <button
          type="button"
          className={`icon-button ${loop ? 'selected' : ''}`}
          onClick={onLoop}
          aria-pressed={loop}
          aria-label={t('loop')}
        >
          <Repeat2 size={19} strokeWidth={1.7} />
        </button>
        <button type="button" className="np-tempo" onClick={onTempo} aria-label={t('tempo')}>
          <strong>{Math.round(song.bpm * speed)}</strong>
          <span>BPM</span>
        </button>
      </div>
    </section>
  )
}
