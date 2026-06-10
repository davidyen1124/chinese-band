import { useEffect, useRef, useState, type CSSProperties } from 'react'

type PlayerState = 'idle' | 'generating' | 'playing'

interface MusicEvent {
  time: number
  sound: string
  volume: number
}

interface MusicPattern {
  duration: number
  events: MusicEvent[]
}

const SOUND_NAMES = [
  'c1', 'd1', 'e1', 'g1', 'a1',
  'c2', 'd2', 'e2', 'g2', 'a2',
  'c3', 'd3', 'e3', 'g3', 'a3',
  'c4', 'd4', 'e4', 'g4', 'a4',
  'c5', 'd5', 'e5', 'g5', 'a5',
  'b1', 'b2', 'b3', 'b4', 'b5',
  'lowwar', 'lowwarrim', 'redflower30', 'redflowerrim30',
  'redflower20', 'redflowerrim20', 'whiteopera25', 'whiteoperarim25',
  'ban', 'chao', 'kouzi', 'luo', 'tonggu', 'xiangzhan', 'xiaogu',
] as const

const SOUND_SET = new Set<string>(SOUND_NAMES)
const MIX_SAMPLE_RATE = 44100
const MIX_CHANNELS = 2

class SamplePlayer {
  private context: AudioContext | null = null
  private buffers = new Map<string, AudioBuffer>()
  private playbackAudio: HTMLAudioElement | null = null
  private silentUrl: string | null = null
  private playbackUrl: string | null = null

  async unlock() {
    this.context ??= new AudioContext()
    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined)
    }

    const audio = this.ensurePlaybackAudio()
    this.silentUrl ??= URL.createObjectURL(encodeWav([new Float32Array(MIX_SAMPLE_RATE)], MIX_SAMPLE_RATE))
    if (audio.src !== this.silentUrl) {
      audio.src = this.silentUrl
    }
    audio.loop = true
    audio.muted = false
    this.resetAudio(audio)

    await Promise.race([
      audio.play().catch(() => undefined),
      wait(700),
    ])
  }

  async preload(names: string[]) {
    const uniqueNames = [...new Set(names)].filter((name) => SOUND_SET.has(name))
    await Promise.all(
      uniqueNames.map(async (name) => {
        await this.loadBuffer(name)
      }),
    )
  }

  play(pattern: MusicPattern, startAt: number, onProgress: (progress: number) => void, onDone: () => void) {
    const safeStartAt = Math.min(pattern.duration, Math.max(0, startAt))
    const audio = this.ensurePlaybackAudio()
    this.clearPlaybackUrl()
    this.playbackUrl = URL.createObjectURL(this.renderPattern(pattern))
    audio.pause()
    audio.loop = false
    audio.src = this.playbackUrl
    audio.load()
    this.resetAudio(audio)
    this.seekAudio(audio, safeStartAt)

    const startedAt = performance.now()
    const timers: number[] = []
    let animation = 0
    let stopped = false

    void audio.play().catch(() => undefined)

    const tick = () => {
      if (stopped) return
      const elapsed = (performance.now() - startedAt) / 1000
      const currentTime = safeStartAt + elapsed
      onProgress(Math.min(1, currentTime / pattern.duration))
      if (currentTime < pattern.duration) {
        animation = requestAnimationFrame(tick)
      }
    }

    animation = requestAnimationFrame(tick)
    timers.push(window.setTimeout(() => {
      if (stopped) return
      onProgress(1)
      audio.pause()
      this.clearPlaybackUrl()
      onDone()
    }, Math.ceil((pattern.duration - safeStartAt) * 1000)))

    return () => {
      stopped = true
      cancelAnimationFrame(animation)
      timers.forEach((timer) => clearTimeout(timer))
      audio.pause()
      this.resetAudio(audio)
      this.clearPlaybackUrl()
    }
  }

  private ensurePlaybackAudio() {
    if (this.playbackAudio) return this.playbackAudio

    const audio = new Audio()
    audio.preload = 'auto'
    audio.style.display = 'none'
    document.body.appendChild(audio)
    this.playbackAudio = audio
    return audio
  }

  private async loadBuffer(name: string) {
    if (!this.context || !SOUND_SET.has(name)) return null
    const existing = this.buffers.get(name)
    if (existing) return existing

    try {
      const response = await fetch(`/sounds/${name}.mp3`)
      const data = await response.arrayBuffer()
      const buffer = await Promise.race([
        this.context.decodeAudioData(data),
        wait(5000).then(() => null),
      ])
      if (buffer) this.buffers.set(name, buffer)
      return buffer
    } catch {
      return null
    }
  }

  private renderPattern(pattern: MusicPattern) {
    const frameCount = Math.ceil(pattern.duration * MIX_SAMPLE_RATE)
    const channels = Array.from({ length: MIX_CHANNELS }, () => new Float32Array(frameCount))

    for (const event of pattern.events) {
      const buffer = this.buffers.get(event.sound)
      if (!buffer) continue

      const startFrame = Math.floor(event.time * MIX_SAMPLE_RATE)
      const maxFrames = Math.min(frameCount - startFrame, Math.ceil(buffer.duration * MIX_SAMPLE_RATE))
      if (maxFrames <= 0) continue

      for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
        const mixChannel = channels[channelIndex]
        const sourceChannel = buffer.getChannelData(Math.min(channelIndex, buffer.numberOfChannels - 1))

        for (let frame = 0; frame < maxFrames; frame++) {
          const sourceFrame = Math.floor(frame * buffer.sampleRate / MIX_SAMPLE_RATE)
          mixChannel[startFrame + frame] += sourceChannel[sourceFrame] * event.volume
        }
      }
    }

    return encodeWav(channels, MIX_SAMPLE_RATE)
  }

  private clearPlaybackUrl() {
    if (!this.playbackUrl) return
    URL.revokeObjectURL(this.playbackUrl)
    this.playbackUrl = null
  }

  private resetAudio(audio: HTMLAudioElement) {
    try {
      audio.currentTime = 0
    } catch {
      // The media element may not be seekable until metadata is available.
    }
  }

  private seekAudio(audio: HTMLAudioElement, time: number) {
    try {
      audio.currentTime = time
    } catch {
      audio.addEventListener('loadedmetadata', () => {
        try {
          audio.currentTime = time
        } catch {
          // The generated blob can be briefly unseekable before metadata is ready.
        }
      }, { once: true })
    }
  }
}

function App() {
  const player = useRef(new SamplePlayer())
  const stopPlayback = useRef<() => void>(() => undefined)
  const currentPattern = useRef<MusicPattern | null>(null)
  const [state, setState] = useState<PlayerState>('idle')
  const [progress, setProgress] = useState(0)

  useEffect(() => () => stopPlayback.current(), [])

  async function generateAndPlay() {
    stopPlayback.current()
    stopPlayback.current = () => undefined
    setProgress(0)
    setState('generating')

    try {
      await player.current.unlock()
      const pattern = await fetchPattern()
      await player.current.preload(pattern.events.map((event) => event.sound))

      currentPattern.current = pattern
      playFrom(pattern, 0)
    } catch (error) {
      console.error('Generation failed', error)
      setState('idle')
      setProgress(0)
    }
  }

  function playFrom(pattern: MusicPattern, progressValue: number) {
    stopPlayback.current()
    const startAt = pattern.duration * progressValue
    setProgress(progressValue)
    setState('playing')
    stopPlayback.current = player.current.play(pattern, startAt, setProgress, () => {
      setState('idle')
      stopPlayback.current = () => undefined
    })
  }

  function updateSeek(value: string) {
    setProgress(Number(value) / 1000)
  }

  function commitSeek(progressValue = progress) {
    if (!currentPattern.current || state !== 'playing') return
    playFrom(currentPattern.current, progressValue)
  }

  const buttonText = state === 'generating'
    ? 'Generating'
    : state === 'playing'
      ? 'Again'
      : 'Generate'
  const progressValue = Math.round(progress * 1000)

  return (
    <main className="screen" aria-label="Chinese Band Jam">
      <div className="stage">
        <header className="title-plaque">
          <h1>Chinese Band Jam</h1>
        </header>

        <div className="controls" style={{ '--progress': `${progress * 100}%` } as CSSProperties}>
          <button className="generate-button" disabled={state === 'generating'} onClick={generateAndPlay}>
            <span>{buttonText}</span>
          </button>
          <input
            aria-label="Playback seek"
            className="seekbar"
            disabled={state !== 'playing'}
            max={1000}
            min={0}
            onBlur={(event) => commitSeek(Number(event.currentTarget.value) / 1000)}
            onChange={(event) => updateSeek(event.currentTarget.value)}
            onKeyUp={(event) => commitSeek(Number(event.currentTarget.value) / 1000)}
            onPointerUp={(event) => commitSeek(Number(event.currentTarget.value) / 1000)}
            type="range"
            value={progressValue}
          />
        </div>
      </div>
    </main>
  )
}

async function fetchPattern(): Promise<MusicPattern> {
  const seed = makeSeed()
  const response = await Promise.race([
    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed }),
    }),
    wait(18000),
  ])
  if (!response) throw new Error('Generate request timed out')
  if (!response.ok) throw new Error(`Generate request failed with ${response.status}`)
  return normalizePattern(await response.json())
}

function normalizePattern(value: unknown): MusicPattern {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    throw new Error('Generated pattern is missing events')
  }

  const events = value.events.flatMap((event): MusicEvent[] => {
    if (!isRecord(event)) return []
    const sound = typeof event.sound === 'string' ? event.sound : ''
    const time = typeof event.time === 'number' ? event.time : Number.NaN
    const volume = typeof event.volume === 'number' ? event.volume : 0.75
    if (!SOUND_SET.has(sound) || !Number.isFinite(time) || time < 0 || time > 22) return []
    return [{ sound, time, volume: Math.min(1, Math.max(0.05, volume)) }]
  }).sort((a, b) => a.time - b.time).slice(0, 96)

  if (events.length < 24) {
    throw new Error('Generated pattern has too few playable events')
  }

  const durationValue = typeof value.duration === 'number' ? value.duration : events.at(-1)!.time + 1.4
  return {
    duration: Math.min(22, Math.max(12, durationValue)),
    events,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function wait(ms: number) {
  return new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), ms)
  })
}

function encodeWav(channels: Float32Array[], sampleRate: number) {
  const frameCount = channels[0]?.length ?? 0
  const channelCount = channels.length
  const bytesPerSample = 2
  const blockAlign = channelCount * bytesPerSample
  const dataSize = frameCount * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < frameCount; frame++) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[frame]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function makeSeed() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export default App
