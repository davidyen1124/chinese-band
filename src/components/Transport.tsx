import { useEffect, useState } from 'react'
import { Pause, Play, Repeat2, RotateCcw, Square, X } from 'lucide-react'
import { Slider } from './Controls'
import { formatTime, type Song } from '../lib/catalog'
import type { AudioEngine } from '../lib/audio-engine'
import { usePosition } from '../lib/usePosition'
import { useI18n } from '../i18n'
import { songTitle } from './songText'

type IslandProps = {
  engine: AudioEngine | null
  song: Song
  playing: boolean
  recording: boolean
  onStopRecording: () => void
  onPlay: () => void
  onStopSong: () => void
  onSongs: () => void
}

/**
 * The header's live status: a recording timer while recording, otherwise the
 * song that is playing. Nothing at all when neither is happening.
 */
export function StatusIsland({ engine, song, playing, recording, onStopRecording, onPlay, onStopSong, onSongs }: IslandProps) {
  const { t, lang } = useI18n()
  const [position] = usePosition(engine, `${song.id}-${playing}`)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => setElapsed(engine?.recordingDuration ?? 0), 100)
    return () => clearInterval(timer)
  }, [recording, engine])

  if (recording)
    return (
      <div className="island island-rec" role="status">
        <span className="rec-dot" aria-hidden="true" />
        <span className="island-label">{t('recordingNow')}</span>
        <time className="island-time">{formatTime(elapsed)}</time>
        <button type="button" className="island-action" onClick={onStopRecording} aria-label={t('recordStop')}>
          <Square size={11} fill="currentColor" strokeWidth={0} />
          <span>{t('finish')}</span>
        </button>
      </div>
    )

  const title = songTitle(song, lang)
  const progress = song.duration ? Math.min(1, position / song.duration) : 0
  return (
    <div className="island island-song" role="group" aria-label={t('player')}>
      <button type="button" className="island-play" onClick={onPlay} aria-label={playing ? t('pause') : t('play')}>
        {playing ? <Pause size={15} fill="currentColor" strokeWidth={0} /> : <Play size={15} fill="currentColor" strokeWidth={0} />}
      </button>
      <button type="button" className="island-song-title" onClick={onSongs} aria-label={`${t('openSongs')} · ${title.main}`}>
        <strong>{title.main}</strong>
        <time>
          {formatTime(position)} / {formatTime(song.duration)}
        </time>
      </button>
      <button type="button" className="island-close" onClick={onStopSong} aria-label={t('stop')}>
        <X size={16} strokeWidth={1.8} />
      </button>
      <i className="island-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
    </div>
  )
}

/** The record button in the header. */
export function RecordTool({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="record-tool" onClick={onClick} aria-label={label}>
      <span className="rec-ring" aria-hidden="true">
        <i />
      </span>
      <span className="record-tool-label">{label}</span>
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
