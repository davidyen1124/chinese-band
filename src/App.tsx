import { useEffect, useRef, useState } from 'react'

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

const FALLBACK_POOLS = [
  ['a1', 'c2', 'd2', 'g2', 'a2', 'c3', 'd3', 'g3'],
  ['d2', 'e2', 'g2', 'b2', 'd3', 'e3', 'g3', 'b3'],
  ['g2', 'a2', 'c3', 'd3', 'g3', 'a3', 'c4', 'd4'],
  ['c3', 'd3', 'e3', 'g3', 'a3', 'c4', 'd4', 'e4'],
]

const FALLBACK_PERCUSSION = [
  ['ban', 'luo'],
  ['tonggu', 'chao'],
  ['xiangzhan', 'xiaogu'],
  ['redflowerrim20', 'whiteoperarim25'],
]

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

  play(pattern: MusicPattern, onProgress: (progress: number) => void, onDone: () => void) {
    if (!this.context) return () => undefined
    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined)
    }

    const startedAt = performance.now()
    const contextStart = this.context.currentTime + 0.08
    const timers: number[] = []
    let animation = 0
    let stopped = false

    for (const event of pattern.events) {
      const buffer = this.buffers.get(event.sound)
      if (!buffer) continue
      this.startBuffer(buffer, contextStart + event.time, event.volume)
    }

    const tick = () => {
      if (stopped) return
      const elapsed = (performance.now() - startedAt) / 1000
      onProgress(Math.min(1, elapsed / pattern.duration))
      if (elapsed < pattern.duration) {
        animation = requestAnimationFrame(tick)
      }
    }

    animation = requestAnimationFrame(tick)
    timers.push(window.setTimeout(() => {
      if (stopped) return
      onProgress(1)
      onDone()
    }, Math.ceil(pattern.duration * 1000)))

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

      setState('playing')
      stopPlayback.current = player.current.play(pattern, setProgress, () => {
        setState('idle')
      })
    } catch {
      setState('idle')
      setProgress(0)
    }
  }

  const buttonText = state === 'generating'
    ? 'Generating'
    : state === 'playing'
      ? 'Again'
      : 'Generate'

  return (
    <main className="screen" aria-label="Chinese Band Jam">
      <div className="stage">
        <button className="generate-button" disabled={state === 'generating'} onClick={generateAndPlay}>
          {buttonText}
        </button>
        <div className="progress" aria-label="Playback progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} role="progressbar">
          <div style={{ transform: `scaleX(${progress})` }} />
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
  if (!response) return buildFallbackPattern(seed)
  if (!response.ok) return buildFallbackPattern(seed)
  return normalizePattern(await response.json())
}

function normalizePattern(value: unknown): MusicPattern {
  if (!isRecord(value) || !Array.isArray(value.events)) return buildFallbackPattern(makeSeed())

  const events = value.events.flatMap((event): MusicEvent[] => {
    if (!isRecord(event)) return []
    const sound = typeof event.sound === 'string' ? event.sound : ''
    const time = typeof event.time === 'number' ? event.time : Number.NaN
    const volume = typeof event.volume === 'number' ? event.volume : 0.75
    if (!SOUND_SET.has(sound) || !Number.isFinite(time) || time < 0 || time > 22) return []
    return [{ sound, time, volume: Math.min(1, Math.max(0.05, volume)) }]
  }).sort((a, b) => a.time - b.time).slice(0, 96)

  if (events.length < 4) return buildFallbackPattern(makeSeed())

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

function buildFallbackPattern(seed: string): MusicPattern {
  const random = seededRandom(seed)
  const melodyPool = FALLBACK_POOLS[Math.floor(random() * FALLBACK_POOLS.length)]
  const percussionPool = FALLBACK_PERCUSSION[Math.floor(random() * FALLBACK_PERCUSSION.length)]
  const step = [0.25, 0.33, 0.375, 0.5][Math.floor(random() * 4)]
  const duration = 16 + Math.floor(random() * 5)
  const events: MusicEvent[] = []

  let time = 0
  while (time < duration) {
    events.push({
      time: Math.round(time * 1000) / 1000,
      sound: melodyPool[Math.floor(random() * melodyPool.length)],
      volume: Math.round((0.68 + random() * 0.25) * 1000) / 1000,
    })
    if (random() > 0.68) {
      events.push({
        time: Math.round(time * 1000) / 1000,
        sound: percussionPool[Math.floor(random() * percussionPool.length)],
        volume: Math.round((0.35 + random() * 0.28) * 1000) / 1000,
      })
    }
    time += step * (random() > 0.75 ? 2 : 1)
  }

  return {
    duration,
    events: events.slice(0, 84).sort((a, b) => a.time - b.time),
  }
}

function makeSeed() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export default App
