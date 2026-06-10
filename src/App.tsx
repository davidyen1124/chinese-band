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

class SamplePlayer {
  private context: AudioContext | null = null
  private buffers = new Map<string, AudioBuffer>()

  async unlock() {
    this.context ??= new AudioContext({ latencyHint: 'interactive' })
    if (this.context.state === 'suspended') {
      await Promise.race([
        this.context.resume().catch(() => undefined),
        wait(500),
      ])
    }

    const buffer = this.context.createBuffer(1, 1, 22050)
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    source.buffer = buffer
    gain.gain.value = 0
    source.connect(gain)
    gain.connect(this.context.destination)
    source.start(0)
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
    if (!this.context) return () => undefined
    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined)
    }

    const safeStartAt = Math.min(pattern.duration, Math.max(0, startAt))
    const startedAt = performance.now()
    const contextStart = this.context.currentTime + 0.08
    const timers: number[] = []
    let animation = 0
    let stopped = false

    for (const event of pattern.events) {
      if (event.time < safeStartAt) continue
      const buffer = this.buffers.get(event.sound)
      if (!buffer) continue
      this.startBuffer(buffer, contextStart + event.time - safeStartAt, event.volume)
    }

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
      onDone()
    }, Math.ceil((pattern.duration - safeStartAt) * 1000)))

    return () => {
      stopped = true
      cancelAnimationFrame(animation)
      timers.forEach((timer) => clearTimeout(timer))
    }
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

  private startBuffer(buffer: AudioBuffer, when: number, volume: number) {
    if (!this.context) return
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    source.buffer = buffer
    gain.gain.value = volume
    source.connect(gain)
    gain.connect(this.context.destination)
    source.start(when)
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

function makeSeed() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export default App
