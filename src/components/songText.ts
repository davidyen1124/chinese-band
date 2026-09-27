import type { Song } from '../lib/catalog'
import type { Lang } from '../i18n'

/** Built-in songs have both names; recordings keep whatever the player typed. */
export function songTitle(song: Song, lang: Lang) {
  if (song.category === '錄音') return { main: song.title, sub: undefined as string | undefined }
  if (lang === 'en' && song.titleEn) return { main: song.titleEn, sub: song.title }
  return { main: song.title, sub: song.titleEn }
}
