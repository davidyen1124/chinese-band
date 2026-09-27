import { allNotes, type Recording } from './catalog'

const STORE = 'recordings'

/** Errors carry a message key from i18n so the UI can speak both languages. */
export class StorageError extends Error {}

async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('qingyin-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new StorageError('errStorageOpen'))
  })
}

export async function listRecordings() {
  const d = await db()
  return new Promise<Recording[]>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly')
    const r = tx.objectStore(STORE).getAll()
    r.onsuccess = () => resolve((r.result as Recording[]).sort((a, b) => b.created - a.created))
    r.onerror = () => reject(new StorageError('errStorageOpen'))
    tx.oncomplete = () => d.close()
  })
}

export async function saveRecording(record: Recording) {
  const d = await db()
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => {
      d.close()
      resolve()
    }
    tx.onerror = () => {
      d.close()
      reject(new StorageError('errStorageFull'))
    }
  })
}

export async function deleteRecording(id: string) {
  const d = await db()
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => {
      d.close()
      resolve()
    }
    tx.onerror = () => reject(new StorageError('errStorageOpen'))
  })
}

const legacyPercussion = [
  'lowwar',
  'lowwarrim',
  'redflower30',
  'redflowerrim30',
  'redflower20',
  'redflowerrim20',
  'whiteopera25',
  'whiteoperarim25',
  'ban',
  'chao',
  'kouzi',
  'luo',
  'tonggu',
  'xiangzhan',
  'xiaogu',
]

/** Accepts Qingyin JSON scores and the 2012 Chinese Band Android TXT format. */
export function parseRecording(text: string): Recording {
  if (text.length > 2_000_000) throw new StorageError('errTooLarge')
  let input: unknown
  if (text.trimStart().startsWith('chineseband')) {
    const lines = text.trim().split(/\r?\n/)
    const fields: Record<string, string> = {}
    for (let i = 1; i < lines.length; i += 2) fields[lines[i]] = lines[i + 1]
    const times = (fields.time ?? '').split('-').filter(Boolean).map(Number)
    const rows = (fields.row ?? '').split('-').map(Number)
    const cols = (fields.col ?? '').split('-').map(Number)
    const pressed = (fields.is_pressed ?? '').split('-')
    const events = times.flatMap((t, i) =>
      pressed[i] === '1'
        ? [
            {
              note:
                fields.inst_kind === '2'
                  ? legacyPercussion[rows[i]]
                  : `${['c', 'd', 'e', 'g', 'a', 'b'][cols[i]]}${rows[i] + 1}`,
              time: t / 1000,
              gain: 0.56,
            },
          ]
        : [],
    )
    input = { title: fields.title, duration: Math.max(0, ...times) / 1000 + 2, events }
  } else {
    try {
      input = JSON.parse(text)
    } catch {
      throw new StorageError('errUnreadable')
    }
  }
  const x = input as Partial<Recording>
  if (
    !x ||
    typeof x !== 'object' ||
    typeof x.title !== 'string' ||
    !x.title.trim() ||
    x.title.length > 100 ||
    !Number.isFinite(x.duration) ||
    x.duration! <= 0 ||
    x.duration! > 305 ||
    !Array.isArray(x.events) ||
    x.events.length === 0 ||
    x.events.length > 30000
  )
    throw new StorageError('errBadScore')
  const notes = new Set(allNotes)
  for (const e of x.events)
    if (
      !e ||
      !notes.has(e.note) ||
      !Number.isFinite(e.time) ||
      e.time < 0 ||
      e.time > x.duration! ||
      !Number.isFinite(e.gain) ||
      e.gain < 0 ||
      e.gain > 1
    )
      throw new StorageError('errBadNotes')
  return {
    version: 1,
    id: crypto.randomUUID(),
    title: x.title.trim(),
    created: Date.now(),
    subtitle: 'imported',
    category: '錄音',
    bpm: typeof x.bpm === 'number' && x.bpm >= 30 && x.bpm <= 300 ? x.bpm : 90,
    duration: x.duration!,
    events: [...x.events].sort((a, b) => a.time - b.time),
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
