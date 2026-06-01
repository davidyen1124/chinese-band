interface Env {
  ASSETS: Fetcher
  YARA_CHAT_URL?: string
}

interface MusicEvent {
  time: number
  sound: string
  volume: number
}

interface MusicPattern {
  title: string
  duration: number
  events: MusicEvent[]
}

interface GenerateRequest {
  seed?: string
}

interface Variation {
  seed: string
  style: string
  start: string
  rhythm: string
  percussion: string
}

const DEFAULT_YARA_CHAT_URL = 'https://yara.vishalsood.com/api/chat'
const AI_TIMEOUT_MS = 25000

const GUZHENG_SOUNDS = [
  'c1', 'd1', 'e1', 'g1', 'a1',
  'c2', 'd2', 'e2', 'g2', 'a2',
  'c3', 'd3', 'e3', 'g3', 'a3',
  'c4', 'd4', 'e4', 'g4', 'a4',
  'c5', 'd5', 'e5', 'g5', 'a5',
  'b1', 'b2', 'b3', 'b4', 'b5',
]

const PERCUSSION_SOUNDS = [
  'lowwar', 'lowwarrim', 'redflower30', 'redflowerrim30',
  'redflower20', 'redflowerrim20', 'whiteopera25', 'whiteoperarim25',
  'ban', 'chao', 'kouzi', 'luo', 'tonggu', 'xiangzhan', 'xiaogu',
]

const SOUND_SET = new Set([...GUZHENG_SOUNDS, ...PERCUSSION_SOUNDS])

const STYLES = [
  'low ceremonial drum procession',
  'bright guzheng cascade with light bell replies',
  'sparse midnight zither phrase',
  'quick opera-pulse call and response',
  'descending courtyard melody',
  'rim-hit percussion groove under high strings',
  'slow temple-gong accents with broken melody',
  'playful festival rhythm with short string bursts',
]

const START_NOTES = ['a1', 'd2', 'g2', 'b2', 'c3', 'e3', 'a3', 'd4', 'g4', 'b4']
const RHYTHMS = ['0.25 second grid', '0.33 second lilt', '0.375 second swing', '0.5 second spacious pulse']
const PERCUSSION_HINTS = ['ban and luo', 'tonggu and chao', 'xiangzhan and xiaogu', 'redflower rim sounds', 'white opera rim sounds']

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true })
    }

    if (url.pathname === '/api/generate') {
      return handleGenerate(request, env)
    }

    return env.ASSETS.fetch(request)
  },
}

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
  }

  const variation = buildVariation(await readGenerateRequest(request))

  try {
    const reply = await askYara(env.YARA_CHAT_URL ?? DEFAULT_YARA_CHAT_URL, variation)
    return jsonResponse(normalizePattern(JSON.parse(extractJson(reply))))
  } catch {
    return jsonResponse(buildFallbackPattern(variation.seed))
  }
}

async function askYara(yaraUrl: string, variation: Variation): Promise<string> {
  const body = {
    messages: [
      {
        role: 'user',
        content: buildPrompt(variation),
      },
    ],
  }

  const response = await fetchWithTimeout(yaraUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, AI_TIMEOUT_MS)

  if (!response.ok) {
    throw new Error(`Yara failed with ${response.status}`)
  }

  const payload = await response.json() as unknown
  if (typeof payload === 'string') return payload
  if (!isRecord(payload)) throw new Error('Yara returned an unknown payload')

  const reply = stringValue(payload.reply) || stringValue(payload.content) || stringValue(payload.text)
  if (!reply) throw new Error('Yara returned no text')

  return reply
}

function buildPrompt(variation: Variation): string {
  return [
    'You generate JSON playback patterns for a mobile browser page called ChineseBand Jam.',
    `Fresh generation seed: ${variation.seed}`,
    `This pattern direction: ${variation.style}.`,
    `Start the guzheng melody with ${variation.start}.`,
    `Primary rhythm feel: ${variation.rhythm}.`,
    `Preferred percussion colors: ${variation.percussion}.`,
    '',
    'The browser already has these exact MP3 sample files. You must only use these sound names.',
    `Guzheng sounds: ${GUZHENG_SOUNDS.join(', ')}`,
    `Percussion sounds: ${PERCUSSION_SOUNDS.join(', ')}`,
    '',
    'Return only valid JSON. Do not use markdown. Do not add explanation.',
    'The JSON shape must be exactly:',
    '{"title":"ChineseBand Jam","duration":16,"events":[{"time":0,"sound":"c2","volume":0.85}]}',
    'That line is a shape example only. Do not copy its event.',
    '',
    'Rules:',
    '- duration must be 16 to 20 seconds.',
    '- events must contain 42 to 72 notes.',
    '- time is seconds from the start, sorted ascending, from 0 to duration.',
    '- sound must be one of the available sample names exactly.',
    '- volume must be a number from 0.05 to 1.',
    '- Use guzheng as the melody and percussion as sparse accents.',
    '- Keep it pentatonic, playable, rhythmic, and simple.',
    '- Make this generation noticeably different from a basic c2,e2,g2,a2 opening.',
    '- The first four guzheng notes must not be c2,e2,g2,a2 in that order.',
  ].join('\n')
}

function normalizePattern(value: unknown): MusicPattern {
  if (!isRecord(value) || !Array.isArray(value.events)) return buildFallbackPattern()

  const events = value.events.flatMap((event): MusicEvent[] => {
    if (!isRecord(event)) return []

    const sound = typeof event.sound === 'string' ? event.sound : ''
    const time = typeof event.time === 'number' ? event.time : Number.NaN
    const volume = typeof event.volume === 'number' ? event.volume : 0.75

    if (!SOUND_SET.has(sound) || !Number.isFinite(time) || time < 0 || time > 22) return []

    return [{
      time: round(time),
      sound,
      volume: round(Math.min(1, Math.max(0.05, volume))),
    }]
  }).sort((a, b) => a.time - b.time).slice(0, 96)

  if (events.length < 4) return buildFallbackPattern()

  const durationValue = typeof value.duration === 'number' ? value.duration : events.at(-1)!.time + 1.2
  const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 40) : 'ChineseBand Jam'

  return {
    title,
    duration: round(Math.min(22, Math.max(12, durationValue))),
    events,
  }
}

async function readGenerateRequest(request: Request): Promise<GenerateRequest> {
  try {
    const value = await request.json() as unknown
    return isRecord(value) ? { seed: stringValue(value.seed).slice(0, 80) } : {}
  } catch {
    return {}
  }
}

function buildVariation(request: GenerateRequest): Variation {
  const seed = request.seed || crypto.randomUUID()
  const index = Math.abs(hashSeed(seed))
  return {
    seed,
    style: STYLES[index % STYLES.length],
    start: START_NOTES[Math.floor(index / 3) % START_NOTES.length],
    rhythm: RHYTHMS[Math.floor(index / 7) % RHYTHMS.length],
    percussion: PERCUSSION_HINTS[Math.floor(index / 11) % PERCUSSION_HINTS.length],
  }
}

function buildFallbackPattern(seed: string = crypto.randomUUID()): MusicPattern {
  const random = seededRandom(seed)
  const startIndex = Math.floor(random() * START_NOTES.length)
  const melodyPool = [
    ['a1', 'c2', 'd2', 'g2', 'a2', 'c3', 'd3', 'g3'],
    ['d2', 'e2', 'g2', 'b2', 'd3', 'e3', 'g3', 'b3'],
    ['g2', 'a2', 'c3', 'd3', 'g3', 'a3', 'c4', 'd4'],
    ['c3', 'd3', 'e3', 'g3', 'a3', 'c4', 'd4', 'e4'],
  ][startIndex % 4]
  const percussionPool = [
    ['ban', 'luo'],
    ['tonggu', 'chao'],
    ['xiangzhan', 'xiaogu'],
    ['redflowerrim20', 'whiteoperarim25'],
  ][Math.floor(random() * 4)]
  const step = [0.25, 0.33, 0.375, 0.5][Math.floor(random() * 4)]
  const duration = 16 + Math.floor(random() * 5)
  const events: MusicEvent[] = []

  let time = 0
  while (time < duration) {
    const note = melodyPool[Math.floor(random() * melodyPool.length)]
    events.push({ time: round(time), sound: note, volume: round(0.68 + random() * 0.25) })
    if (random() > 0.68) {
      events.push({ time: round(time), sound: percussionPool[Math.floor(random() * percussionPool.length)], volume: round(0.35 + random() * 0.28) })
    }
    time += step * (random() > 0.75 ? 2 : 1)
  }

  return {
    title: 'ChineseBand Jam',
    duration,
    events: events.slice(0, 84).sort((a, b) => a.time - b.time),
  }
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

function extractJson(value: string): string {
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found')
  }
  return value.slice(start, end + 1)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}
