import { useRef, type ReactNode } from 'react'
import { ChevronRight, Music2, Pencil, Play, Share2, Trash2, Upload } from 'lucide-react'
import { Overlay } from './Overlay'
import { Segmented, Slider } from './Controls'
import { artFor, formatTime, percussion, songs, type Recording, type Song } from '../lib/catalog'
import { useI18n, type Key, type Lang } from '../i18n'
import { songTitle } from './songText'

export type Panel = 'songs' | 'recordings' | 'guide' | 'settings' | 'menu'

type Props = {
  nowPlaying: ReactNode
  panel: Panel | null
  shown: Panel
  setPanel: (p: Panel | null) => void
  records: Recording[]
  selected: Song
  playing: boolean
  onSelect: (s: Song) => void
  onShare: (s: Recording) => void
  onRename: (s: Recording) => void
  onDelete: (s: Recording) => void
  onImport: (f: File) => void
  speed: number
  setSpeed: (n: number) => void
  accompaniment: number
  setAccompaniment: (v: number) => void
  volume: number
  setVolume: (v: number) => void
}

const heads: Record<Panel, [Key, Key]> = {
  songs: ['sheetSongs', 'sheetSongsDesc'],
  recordings: ['sheetRecordings', 'sheetRecordingsDesc'],
  guide: ['sheetGuide', 'sheetGuideDesc'],
  settings: ['sheetSettings', 'sheetSettingsDesc'],
  menu: ['sheetMenu', 'sheetMenuDesc'],
}

const img = (path: string) => `${import.meta.env.BASE_URL}images/${path}.webp`

export function Library(p: Props) {
  const { t, lang, setLang } = useI18n()
  const [title, desc] = heads[p.shown]
  return (
    <Overlay
      kind="sheet"
      open={p.panel !== null}
      onClose={() => p.setPanel(null)}
      title={t(title)}
      description={t(desc)}
      className={`library-sheet sheet-${p.shown}`}
    >
      {p.shown === 'menu' && (
        <>
          <nav className="menu-list" aria-label={t('mainNav')}>
            {(
              [
                ['songs', 'sheetSongs', 'menuSongs'],
                ['recordings', 'sheetRecordings', 'menuRecordings'],
                ['guide', 'sheetGuide', 'menuGuide'],
                ['settings', 'sheetSettings', 'menuSettings'],
              ] as const
            ).map(([key, label, sub]) => (
              <button type="button" key={key} onClick={() => p.setPanel(key)}>
                <span>
                  <strong>{t(label)}</strong>
                  <small>{t(sub)}</small>
                </span>
                <ChevronRight size={20} strokeWidth={1.5} />
              </button>
            ))}
          </nav>
          <LanguageRow lang={lang} setLang={setLang} label={t('language')} />
        </>
      )}

      {p.shown === 'songs' && (
        <>
          {p.nowPlaying}
          {(['原版', '新編'] as const).map((category) => (
            <section className="song-section" key={category}>
              <h3>
                <span>{category === '原版' ? t('originals') : t('studies')}</span>
                <small>{category === '原版' ? t('originalsNote') : t('studiesNote')}</small>
              </h3>
              <ol>
                {songs
                  .filter((s) => s.category === category)
                  .map((s, i) => {
                    const name = songTitle(s, lang)
                    const current = p.selected.id === s.id
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          className={`song-row ${current ? 'current' : ''}`}
                          onClick={() => p.onSelect(s)}
                          aria-label={t('playSong', { title: name.main })}
                          aria-current={current ? 'true' : undefined}
                        >
                          <span className="song-order">{String(i + 1).padStart(2, '0')}</span>
                          <span className="song-copy">
                            <strong>{name.main}</strong>
                            <small>
                              {[name.sub, s.subtitle === 'drums' ? t('percussion') : null, formatTime(s.duration)]
                                .filter(Boolean)
                                .join(' · ')}
                            </small>
                          </span>
                          <span className="song-play" aria-hidden="true">
                            {current && p.playing ? <Bars /> : <Play size={15} fill="currentColor" strokeWidth={0} />}
                          </span>
                        </button>
                      </li>
                    )
                  })}
              </ol>
            </section>
          ))}
          <p className="quiet-note">{t('songsNote')}</p>
        </>
      )}

      {p.shown === 'recordings' && <Recordings {...p} />}

      {p.shown === 'settings' && (
        <>
          <div className="setting">
            <div className="setting-label" id="volume-label">
              {t('masterVolume')} <span>{Math.round(p.volume * 100)}%</span>
            </div>
            <Slider labelledBy="volume-label" value={p.volume * 100} onChange={(v) => p.setVolume(v / 100)} min={0} max={100} />
          </div>
          <div className="setting">
            <div className="setting-label" id="accompaniment-label">
              {t('backingVolume')} <span>{Math.round(p.accompaniment * 100)}%</span>
            </div>
            <Slider
              labelledBy="accompaniment-label"
              value={p.accompaniment * 100}
              onChange={(v) => p.setAccompaniment(v / 100)}
              min={0}
              max={100}
            />
          </div>
          <div className="setting">
            <div className="setting-label" id="tempo-label">
              {t('songTempo')} <span>{Math.round(p.speed * 100)}%</span>
            </div>
            <Slider labelledBy="tempo-label" value={p.speed * 100} onChange={(v) => p.setSpeed(v / 100)} min={50} max={150} step={5} />
            <button type="button" className="text-button" disabled={p.speed === 1} onClick={() => p.setSpeed(1)}>
              {t('resetTempo')}
            </button>
          </div>
          <LanguageRow lang={lang} setLang={setLang} label={t('language')} />
          <div className="help-block">
            <h3>{t('helpIphone')}</h3>
            <p>{t('helpIphone1')}</p>
            <p>{t('helpIphone2')}</p>
            <h3>{t('helpKeys')}</h3>
            <p>{t('helpKeys1')}</p>
          </div>
        </>
      )}

      {p.shown === 'guide' && (
        <>
          <article className="guide-hero">
            <img src={img('zheng-whole')} alt="" width={1200} height={280} decoding="async" />
            <div>
              <h3>
                <span lang="zh-Hant">古箏</span>
                <small>Guzheng · gǔ zhēng</small>
              </h3>
              <p>{t('guzhengIntro')}</p>
            </div>
          </article>
          <div className="pentatonic-guide">
            {[
              ['宮', 'gōng', '1', 'C'],
              ['商', 'shāng', '2', 'D'],
              ['角', 'jué', '3', 'E'],
              ['徵', 'zhǐ', '5', 'G'],
              ['羽', 'yǔ', '6', 'A'],
            ].map(([name, pinyin, note, pitch]) => (
              <span key={name}>
                <strong lang="zh-Hant">{name}</strong>
                <em>{pinyin}</em>
                <small>
                  {note} · {pitch}
                </small>
              </span>
            ))}
          </div>
          <p className="quiet-note">{t('pentatonicNote')}</p>
          <h3 className="guide-subhead">
            <span>{lang === 'zh' ? '打擊樂' : 'Percussion'}</span>
            <small>{lang === 'zh' ? 'Percussion' : '打擊樂'}</small>
          </h3>
          <p className="guide-lede">{t('percussionIntro')}</p>
          <ul className="guide-list">
            {percussion
              .filter((x) => x.group === 0)
              .map((x) => (
                <li className="guide-row" key={x.id}>
                  <img src={img(`perc/${artFor[x.id]}`)} alt="" width={160} height={160} loading="lazy" decoding="async" />
                  <div>
                    <strong>
                      <span lang="zh-Hant">{x.name}</span>
                      <small>
                        {x.en} · {x.pinyin}
                      </small>
                    </strong>
                    <p>{lang === 'zh' ? x.zh : x.enNote}</p>
                  </div>
                </li>
              ))}
          </ul>
          <div className="credits">
            <h3>{t('credits')}</h3>
            <p className="credits-mono">{t('credits1')}</p>
            <p>{t('credits2')}</p>
          </div>
        </>
      )}
    </Overlay>
  )
}

function LanguageRow({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  return (
    <div className="setting setting-inline language-row">
      <div className="setting-label">{label}</div>
      <Segmented
        label={label}
        value={lang}
        onChange={setLang}
        className="compact"
        options={[
          { value: 'zh', label: '中文' },
          { value: 'en', label: 'English' },
        ]}
      />
    </div>
  )
}

function Bars() {
  return (
    <span className="bars">
      <i />
      <i />
      <i />
    </span>
  )
}

function Recordings(p: Props) {
  const { t, lang } = useI18n()
  const fileInput = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={fileInput}
        hidden
        type="file"
        accept=".json,.txt,application/json,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) p.onImport(f)
          e.target.value = ''
        }}
      />
      {p.records.length === 0 ? (
        <div className="empty-recordings">
          <div className="empty-art" aria-hidden="true">
            <Music2 size={26} strokeWidth={1.4} />
          </div>
          <h3>{t('emptyTitle')}</h3>
          <p>{t('emptyBody')}</p>
          <div className="empty-actions">
            <button type="button" className="primary-button" onClick={() => p.setPanel(null)}>
              {t('backToPlay')}
            </button>
            <button type="button" className="outline-button" onClick={() => fileInput.current?.click()}>
              <Upload size={16} strokeWidth={1.7} />
              {t('importScore')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="outline-button import-button" onClick={() => fileInput.current?.click()}>
            <Upload size={16} strokeWidth={1.7} />
            {t('importScore')}
          </button>
          <ul className="recording-list">
            {p.records.map((r) => (
              <li className={`recording-row ${p.selected.id === r.id ? 'current' : ''}`} key={r.id}>
                <button
                  type="button"
                  className="recording-main"
                  onClick={() => p.onSelect(r)}
                  aria-label={t('playRecording', { title: r.title })}
                >
                  <span className="recording-play" aria-hidden="true">
                    {p.selected.id === r.id && p.playing ? <Bars /> : <Play size={14} fill="currentColor" strokeWidth={0} />}
                  </span>
                  <span className="recording-copy">
                    <strong>{r.title}</strong>
                    <small>
                      {new Date(r.created).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {formatTime(r.duration)}
                    </small>
                  </span>
                </button>
                <div className="recording-actions">
                  <button type="button" className="icon-button" aria-label={t('renameItem', { title: r.title })} onClick={() => p.onRename(r)}>
                    <Pencil size={16} strokeWidth={1.6} />
                  </button>
                  <button type="button" className="icon-button" aria-label={t('shareItem', { title: r.title })} onClick={() => p.onShare(r)}>
                    <Share2 size={16} strokeWidth={1.6} />
                  </button>
                  <button type="button" className="icon-button" aria-label={t('deleteItem', { title: r.title })} onClick={() => p.onDelete(r)}>
                    <Trash2 size={16} strokeWidth={1.6} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="quiet-note">{t('recordingsNote')}</p>
    </>
  )
}
