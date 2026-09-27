import { allNotes, type NoteEvent, type Song } from './catalog'

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

/** Half a second of 8-bit silence, used to hold an iOS playback session open. */
function silentWavUrl() {
  const n = 4000
  const v = new DataView(new ArrayBuffer(44 + n))
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + n, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 8000, true)
  v.setUint32(28, 8000, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  str(36, 'data')
  v.setUint32(40, n, true)
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' }))
}

// Audio is scheduled on the audio clock; pointer events never wait for React rendering.
export class AudioEngine {
  context: AudioContext | null = null
  buffers = new Map<string, AudioBuffer>()
  private master: GainNode | null = null
  private loading: Promise<void> | null = null
  private voices = new Set<{ source: AudioBufferSourceNode; bus: string }>()
  private keepAlive: HTMLAudioElement | null = null
  volume = 0.8
  accompaniment = 0.6
  private recordingStart: number | null = null
  private recorded: (NoteEvent & { bus?: string })[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private song: Song | null = null
  private cursor = 0
  private start = 0
  private offset = 0
  speed = 1
  playing = false
  onNote: ((note: string, delay: number) => void) | null = null
  onEnd: (() => void) | null = null

  get now() {
    return this.context?.currentTime ?? 0
  }

  get position() {
    return this.playing
      ? Math.max(0, Math.min(this.song?.duration ?? 0, this.offset + (this.now - this.start) * this.speed))
      : this.offset
  }

  get recordingDuration() {
    return this.recordingStart === null ? 0 : this.now - this.recordingStart
  }

  private ensureGraph() {
    this.context ??= new AudioContext({ latencyHint: 'interactive' })
    if (this.master) return
    this.master = this.context.createGain()
    this.master.gain.value = this.volume
    const limiter = this.context.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 6
    limiter.ratio.value = 20
    limiter.attack.value = 0
    limiter.release.value = 0.1
    this.master.connect(limiter)
    limiter.connect(this.context.destination)
  }

  async load(onProgress?: (n: number) => void) {
    if (this.loading) return this.loading
    this.ensureGraph()
    const base = import.meta.env.BASE_URL
    this.loading = (async () => {
      let index = 0
      let done = this.buffers.size
      const worker = async () => {
        while (index < allNotes.length) {
          const note = allNotes[index++]
          if (this.buffers.has(note)) continue
          const res = await fetch(`${base}sounds/${note}.mp3`)
          if (!res.ok) throw new Error(`sample ${note}`)
          const buffer = await this.context!.decodeAudioData(await res.arrayBuffer())
          // Strip only leading digital silence, retaining every recorded attack and tail.
          let first = 0
          const data = buffer.getChannelData(0)
          while (first < Math.min(data.length, buffer.sampleRate * 0.15) && Math.abs(data[first]) < 0.00015) first++
          const trimmed = this.context!.createBuffer(buffer.numberOfChannels, buffer.length - first, buffer.sampleRate)
          for (let ch = 0; ch < buffer.numberOfChannels; ch++)
            trimmed.copyToChannel(buffer.getChannelData(ch).subarray(first), ch)
          this.buffers.set(note, trimmed)
          onProgress?.(++done / allNotes.length)
        }
      }
      await Promise.all(Array.from({ length: 6 }, worker))
    })()
    try {
      await this.loading
    } catch (e) {
      this.loading = null
      throw e
    }
  }

  /**
   * Must run inside a user gesture. iPhones route Web Audio through the ringer
   * switch unless the page asks for a playback session (or, on older iOS, keeps
   * an HTML media element playing), which is how the old app went silent.
   */
  async unlock() {
    this.ensureGraph()
    const nav = navigator as AudioSessionNavigator
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'playback'
      } catch {
        // Older WebKit exposes the object but rejects the value.
      }
    } else if (/iP(hone|ad|od)/.test(navigator.userAgent) && !this.keepAlive) {
      const el = new Audio(silentWavUrl())
      el.loop = true
      el.setAttribute('playsinline', '')
      this.keepAlive = el
      void el.play().catch(() => undefined)
    }
    if (this.context!.state !== 'running') await this.context!.resume()
  }

  setAccompaniment(v: number) {
    this.accompaniment = v
  }

  setVolume(v: number) {
    this.volume = v
    this.master?.gain.setTargetAtTime(v, this.now, 0.01)
  }

  play(note: string, gain = 0.7, when = this.now, bus = 'live', capture = true) {
    const ctx = this.context
    const buffer = this.buffers.get(note)
    if (!ctx || !buffer || !this.master) return false
    if (ctx.state !== 'running') void ctx.resume()
    const source = ctx.createBufferSource()
    const amp = ctx.createGain()
    source.buffer = buffer
    amp.gain.value = gain * 0.65
    source.connect(amp)
    amp.connect(this.master)
    const voice = { source, bus }
    this.voices.add(voice)
    source.onended = () => {
      source.disconnect()
      amp.disconnect()
      this.voices.delete(voice)
    }
    source.start(Math.max(ctx.currentTime, when))
    if (capture && this.recordingStart !== null)
      this.recorded.push({ note, time: Math.max(0, when - this.recordingStart), gain: gain * this.volume, bus })
    this.onNote?.(note, Math.max(0, (when - ctx.currentTime) * 1000))
    return true
  }

  startRecording() {
    this.recorded = []
    this.recordingStart = this.now
  }

  stopRecording() {
    const duration = this.recordingDuration
    const events = this.recorded
      .filter((e) => e.time <= duration)
      .map(({ note, time, gain }) => ({ note, time, gain }))
    this.recordingStart = null
    this.recorded = []
    return { duration: duration + 2, events }
  }

  private silence(bus: string) {
    for (const v of this.voices)
      if (v.bus === bus) {
        try {
          v.source.stop()
        } catch {
          // Already stopped.
        }
        this.voices.delete(v)
      }
    if (this.recordingStart !== null)
      this.recorded = this.recorded.filter((e) => e.bus !== bus || e.time <= this.recordingDuration)
  }

  startSong(song: Song, offset = 0) {
    this.pause()
    this.song = song
    this.offset = Math.min(offset, song.duration)
    this.start = this.now + 0.035
    this.cursor = song.events.findIndex((e) => e.time >= this.offset)
    if (this.cursor < 0) this.cursor = song.events.length
    this.playing = true
    const tick = () => {
      if (!this.song || !this.playing) return
      const until = this.position + 0.12 * this.speed
      while (this.cursor < song.events.length && song.events[this.cursor].time < until) {
        const e = song.events[this.cursor++]
        this.play(e.note, e.gain * this.accompaniment, this.start + (e.time - this.offset) / this.speed, 'song')
      }
      if (this.position >= song.duration) {
        this.pause()
        this.offset = 0
        this.onEnd?.()
      }
    }
    tick()
    this.timer = setInterval(tick, 25)
  }

  pause() {
    if (this.playing) this.offset = this.position
    this.playing = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.silence('song')
  }

  stop() {
    this.pause()
    this.offset = 0
  }

  seek(t: number) {
    const was = this.playing
    this.pause()
    this.offset = t
    if (was && this.song) this.startSong(this.song, t)
  }

  setSpeed(s: number) {
    const pos = this.position
    const was = this.playing
    this.pause()
    this.speed = s
    this.offset = pos
    if (was && this.song) this.startSong(this.song, pos)
  }

  async renderWav(song: Song) {
    await this.load()
    const rate = 44100
    const length = Math.ceil(Math.min(305, song.duration + 3) * rate)
    const offline = new OfflineAudioContext(2, length, rate)
    const limiter = offline.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 6
    limiter.ratio.value = 20
    limiter.attack.value = 0
    limiter.release.value = 0.1
    limiter.connect(offline.destination)
    for (const e of song.events) {
      const b = this.buffers.get(e.note)
      if (!b) throw new Error('unknown sample')
      const s = offline.createBufferSource()
      const g = offline.createGain()
      s.buffer = b
      g.gain.value = e.gain * 0.65
      s.connect(g)
      g.connect(limiter)
      s.start(e.time)
    }
    const result = await offline.startRendering()
    const out = new ArrayBuffer(44 + length * 4)
    const v = new DataView(out)
    const str = (o: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
    }
    str(0, 'RIFF')
    v.setUint32(4, 36 + length * 4, true)
    str(8, 'WAVE')
    str(12, 'fmt ')
    v.setUint32(16, 16, true)
    v.setUint16(20, 1, true)
    v.setUint16(22, 2, true)
    v.setUint32(24, rate, true)
    v.setUint32(28, rate * 4, true)
    v.setUint16(32, 4, true)
    v.setUint16(34, 16, true)
    str(36, 'data')
    v.setUint32(40, length * 4, true)
    const l = result.getChannelData(0)
    const r = result.getChannelData(1)
    let peak = 0
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]))
    const headroom = peak > 0.98 ? 0.98 / peak : 1
    for (let i = 0; i < length; i++) {
      v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i] * headroom)) * 32767, true)
      v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i] * headroom)) * 32767, true)
    }
    return new Blob([out], { type: 'audio/wav' })
  }

  dispose() {
    this.stop()
    for (const v of this.voices) {
      try {
        v.source.stop()
      } catch {
        // Already stopped.
      }
    }
    this.keepAlive?.pause()
    void this.context?.close()
  }
}
