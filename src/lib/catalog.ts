import originals from './original-songs.json'

export type NoteEvent = { note: string; time: number; gain: number }
export type Song = {
  id: string
  title: string
  titleEn?: string
  subtitle: string
  category: string
  bpm: number
  duration: number
  events: NoteEvent[]
}
export type Recording = Song & { created: number; version: 1 }

export const pentatonic = ['c', 'd', 'e', 'g', 'a']
export const pitched = Array.from({ length: 5 }, (_, i) =>
  [...pentatonic, 'b'].map((n) => `${n}${i + 1}`),
).flat()

export type Percussion = {
  id: string
  name: string
  en: string
  pinyin: string
  group: number
  material: 'skin' | 'wood' | 'metal'
  zh: string
  enNote: string
  art?: string
}

export const percussion: Percussion[] = [
  {
    id: 'tonggu',
    material: 'skin',
    name: '堂鼓',
    en: 'Tanggu',
    pinyin: 'táng gǔ',
    group: 0,
    zh: '鼓聲厚實，穩住樂曲的脈動。',
    enNote: 'A barrel drum with a deep, round voice. It keeps the pulse honest.',
    art: 'tanggu',
  },
  {
    id: 'ban',
    material: 'wood',
    name: '板',
    en: 'Clapper',
    pinyin: 'bǎn',
    group: 0,
    zh: '木板相擊，聲音短促清脆。',
    enNote: 'Hardwood boards snapped together. Short, dry and decisive.',
    art: 'ban',
  },
  {
    id: 'chao',
    material: 'metal',
    name: '鈸',
    en: 'Cymbals',
    pinyin: 'bó',
    group: 0,
    zh: '金屬相擊，讓節奏多一分明亮。',
    enNote: 'A pair of bronze cymbals that add shimmer to the beat.',
    art: 'bo',
  },
  {
    id: 'kouzi',
    material: 'wood',
    name: '梆子',
    en: 'Woodblock',
    pinyin: 'bāng zi',
    group: 0,
    zh: '一高一低的木梆相擊，音色乾淨俐落。',
    enNote: 'Two hardwood sticks struck together. Clean, bright, a little bossy.',
    art: 'bangzi',
  },
  {
    id: 'luo',
    material: 'metal',
    name: '鑼',
    en: 'Gong',
    pinyin: 'luó',
    group: 0,
    zh: '金屬的共鳴舒展綿長，適合段落收尾。',
    enNote: 'A hanging bronze gong whose bloom is made for endings.',
    art: 'luo',
  },
  {
    id: 'xiangzhan',
    material: 'metal',
    name: '響盞',
    en: 'Small gong',
    pinyin: 'xiǎng zhǎn',
    group: 0,
    zh: '清亮的小型銅鑼，點綴旋律與節拍。',
    enNote: 'A palm-sized bronze gong that sparkles between the beats.',
    art: 'xiangzhan',
  },
  {
    id: 'xiaogu',
    material: 'skin',
    name: '小鼓',
    en: 'Bangu',
    pinyin: 'xiǎo gǔ',
    group: 0,
    zh: '緊緻有力的鼓點，呼應戲曲的節奏。',
    enNote: 'A tight, crisp drum that leads the rhythm of Chinese opera.',
    art: 'xiaogu',
  },
  { id: 'lowwar', material: 'skin', name: '低音戰鼓', en: 'Low war drum', pinyin: 'zhàn gǔ', group: 1, zh: '鼓心', enNote: 'Centre' },
  { id: 'lowwarrim', material: 'skin', name: '戰鼓鼓邊', en: 'War drum rim', pinyin: 'gǔ biān', group: 1, zh: '鼓邊', enNote: 'Rim' },
  { id: 'redflower30', material: 'skin', name: '大花盆鼓', en: 'Large pot drum', pinyin: 'huā pén gǔ', group: 1, zh: '30 · 鼓心', enNote: '30 · Centre' },
  { id: 'redflowerrim30', material: 'skin', name: '大花盆鼓邊', en: 'Large pot rim', pinyin: 'gǔ biān', group: 1, zh: '30 · 鼓邊', enNote: '30 · Rim' },
  { id: 'redflower20', material: 'skin', name: '小花盆鼓', en: 'Small pot drum', pinyin: 'huā pén gǔ', group: 1, zh: '20 · 鼓心', enNote: '20 · Centre' },
  { id: 'redflowerrim20', material: 'skin', name: '小花盆鼓邊', en: 'Small pot rim', pinyin: 'gǔ biān', group: 1, zh: '20 · 鼓邊', enNote: '20 · Rim' },
  { id: 'whiteopera25', material: 'skin', name: '戲曲鼓', en: 'Opera drum', pinyin: 'xì qǔ gǔ', group: 1, zh: '25 · 鼓心', enNote: '25 · Centre' },
  { id: 'whiteoperarim25', material: 'skin', name: '戲曲鼓邊', en: 'Opera drum rim', pinyin: 'gǔ biān', group: 1, zh: '25 · 鼓邊', enNote: '25 · Rim' },
]

export const allNotes = [...pitched, ...percussion.map((p) => p.id)]

function melody(id: string, title: string, titleEn: string, sequence: string, bpm: number): Song {
  const step = 30 / bpm
  const tokens = sequence.split(' ')
  const events: NoteEvent[] = []
  tokens.forEach((note, i) => {
    if (note !== '-') events.push({ note, time: i * step, gain: 0.72 })
    if (i % 8 === 0) events.push({ note: i % 16 === 0 ? 'c2' : 'g2', time: i * step, gain: 0.36 })
  })
  return {
    id,
    title,
    titleEn,
    subtitle: 'study',
    category: '新編',
    bpm,
    duration: tokens.length * step + 2,
    events: events.sort((a, b) => a.time - b.time),
  }
}

const newSongs = [
  melody(
    'bamboo',
    '竹間清風',
    'Wind Through Bamboo',
    'c3 - e3 g3 a3 - g3 e3 d3 - c3 d3 e3 - - - g3 - a3 c4 d4 c4 a3 g3 e3 - d3 e3 c3 - - - c4 - a3 g3 e3 g3 a3 - g3 e3 d3 - c3 - - -',
    84,
  ),
  melody(
    'rain',
    '聽雨',
    'Listening to Rain',
    'e4 g4 - e4 d4 - c4 - a3 c4 d4 - e4 - - - g4 a4 - g4 e4 d4 c4 - d4 e4 g4 - e4 - - - a3 - c4 e4 g4 - e4 d4 c4 - a3 g3 c4 - - -',
    96,
  ),
  melody(
    'moon',
    '月下行舟',
    'Boat Under the Moon',
    'g3 - - a3 c4 - d4 - e4 - d4 c4 a3 - - - e4 - g4 - a4 g4 e4 d4 c4 - a3 g3 c4 - - - d4 - e4 g4 e4 - d4 c4 a3 c4 g3 - c4 - - -',
    72,
  ),
]

const drumEvents: NoteEvent[] = Array.from({ length: 64 }, (_, i) => [
  { note: i % 8 === 0 ? 'tonggu' : i % 4 === 0 ? 'xiaogu' : 'ban', time: i * 0.25, gain: 0.62 },
  ...(i % 16 === 15 ? [{ note: 'chao', time: i * 0.25, gain: 0.45 }] : []),
]).flat()

const originalTitles: Record<string, string> = {
  'original-1': 'Mandarin Ducks & Butterflies',
  'original-2': 'Chrysanthemum Terrace',
  'original-3': 'The Butterfly Lovers',
}

export const songs: Song[] = [
  ...(originals as Song[]).map((s) => ({ ...s, titleEn: originalTitles[s.id], subtitle: 'original' })),
  ...newSongs,
  {
    id: 'drum-study',
    title: '踏歌',
    titleEn: 'Stepping Song',
    subtitle: 'drums',
    category: '新編',
    bpm: 120,
    duration: 18,
    events: drumEvents,
  },
]

export const defaultSong = songs[2]

export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`

/** Strings for one register, listed from the highest (top of the board) to the lowest. */
export function notesForRegister(register: number, b: boolean) {
  return Array.from({ length: 3 }, (_, i) =>
    (b ? [...pentatonic, 'b'] : pentatonic).map((n) => `${n}${register + i}`),
  )
    .flat()
    .reverse()
}

export const noteNumber: Record<string, string> = { c: '1', d: '2', e: '3', g: '5', a: '6', b: '7' }
export const keyboardRow = 'poiuytrewqlkjhg'
