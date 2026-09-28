import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileMusic,
  Maximize2,
  Menu,
  Minimize2,
  Settings2,
  Share2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { AudioEngine } from './lib/audio-engine'
import { defaultSong, keyboardRow, notesForRegister, percussion, type Recording, type Song } from './lib/catalog'
import { deleteRecording, download, listRecordings, parseRecording, saveRecording, StorageError } from './lib/storage'
import { flash } from './lib/flash'
import { I18n, initialLang, isKey, makeT, type Lang } from './i18n'
import { Instrument } from './components/Instrument'
import { RecordControl, Transport } from './components/Transport'
import { Library, type Panel } from './components/Library'
import { Overlay } from './components/Overlay'
import { Segmented, Slider } from './components/Controls'

type Edit = { kind: 'rename' | 'delete' | 'share'; record: Recording }
type Mode = 'guzheng' | 'percussion'

const SETTINGS_KEY = 'chinese-band-settings-v1'

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const t = useMemo(() => makeT(lang), [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem('chinese-band-lang', l)
    } catch {
      // Private mode: the choice lasts for this visit.
    }
  }, [])
  useEffect(() => {
    document.documentElement.lang = t('htmlLang')
    document.title = t('docTitle')
  }, [t])
  const i18n = useMemo(() => ({ lang, t, setLang }), [lang, t, setLang])

  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [progress, setProgress] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [armed, setArmed] = useState(false)
  const [loadingError, setLoadingError] = useState(false)
  const [mode, setMode] = useState<Mode>('guzheng')
  const [register, setRegister] = useState(2)
  const [group, setGroup] = useState(0)
  const [bNotes, setBNotes] = useState(false)
  const [focus, setFocus] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [shownPanel, setShownPanel] = useState<Panel>('menu')
  const [selected, setSelected] = useState<Song>(defaultSong)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [accompaniment, setAccompaniment] = useState(0.6)
  const [recording, setRecording] = useState(false)
  const [records, setRecords] = useState<Recording[]>([])
  const [notice, setNotice] = useState<{ text: string; seal?: boolean } | null>(null)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [lastEdit, setLastEdit] = useState<Edit | null>(null)
  const [title, setTitle] = useState('')
  const [shareFile, setShareFile] = useState<File | null>(null)
  const [shareError, setShareError] = useState(false)
  const [saving, setSaving] = useState(false)
  const shell = useRef<HTMLDivElement>(null)
  const loopRef = useRef(loop)
  const selectedRef = useRef(selected)
  const recordingRef = useRef(recording)
  const stopRecordRef = useRef<() => void>(() => {})
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmuteVolume = useRef(0.8)

  const openPanel = useCallback((p: Panel | null) => {
    setPanel(p)
    if (p) setShownPanel(p)
  }, [])
  const openEdit = (e: Edit) => {
    setEdit(e)
    setLastEdit(e)
  }

  useEffect(() => {
    loopRef.current = loop
    selectedRef.current = selected
    recordingRef.current = recording
  }, [loop, selected, recording])

  const tell = useCallback((text: string, seal = false) => {
    setNotice({ text, seal })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 5000)
  }, [])
  const tellError = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      tell(isKey(msg) ? t(msg) : msg)
    },
    [t, tell],
  )

  useEffect(() => {
    let alive = true
    const e = new AudioEngine()
    queueMicrotask(() => {
      if (alive) setEngine(e)
    })
    const pending = new Set<ReturnType<typeof setTimeout>>()
    e.onNote = (note, delay) => {
      if (delay < 8) {
        flash(shell.current, note)
        return
      }
      const timer = setTimeout(() => {
        pending.delete(timer)
        if (alive) flash(shell.current, note)
      }, delay)
      pending.add(timer)
    }
    e.onEnd = () => {
      if (loopRef.current) e.startSong(selectedRef.current)
      else setPlaying(false)
    }
    e.load((n) => {
      if (alive) setProgress(n)
    })
      .then(() => {
        if (alive) setLoaded(true)
      })
      .catch(() => {
        if (alive) setLoadingError(true)
      })
    listRecordings()
      .then((r) => {
        if (alive) setRecords(r)
      })
      .catch(() => undefined)
    queueMicrotask(() => {
      if (!alive) return
      try {
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
        if (typeof s.volume === 'number') setVolume(Math.max(0, Math.min(1, s.volume)))
        if (typeof s.accompaniment === 'number') setAccompaniment(Math.max(0, Math.min(1, s.accompaniment)))
        if (typeof s.bNotes === 'boolean') setBNotes(s.bNotes)
      } catch {
        // Corrupt or blocked storage: keep the defaults.
      }
    })
    return () => {
      alive = false
      pending.forEach(clearTimeout)
      e.dispose()
    }
  }, [])

  useEffect(() => {
    engine?.setVolume(volume)
    engine?.setAccompaniment(accompaniment)
    if (volume > 0) unmuteVolume.current = volume
    try {
      if (loaded) localStorage.setItem(SETTINGS_KEY, JSON.stringify({ volume, accompaniment, bNotes }))
    } catch {
      // Storage may be unavailable; settings simply won't persist.
    }
  }, [engine, volume, accompaniment, bNotes, loaded])

  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        engine?.pause()
        setPlaying(false)
        if (recordingRef.current) stopRecordRef.current()
      }
    }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  }, [engine])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !panel && !edit) {
        setFocus(false)
        return
      }
      if (
        !armed ||
        panel ||
        edit ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target as HTMLElement)?.closest('input,textarea,select')
      )
        return
      const index = keyboardRow.indexOf(e.key.toLowerCase())
      const note =
        mode === 'guzheng'
          ? notesForRegister(register, bNotes)[index]
          : percussion.filter((p) => p.group === group)[Number(e.key) - 1]?.id
      if (note) {
        e.preventDefault()
        engine?.play(note)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [armed, mode, register, bNotes, group, panel, edit, engine])

  const enable = async () => {
    if (!engine) return false
    try {
      await engine.unlock()
      if (!loaded) {
        setLoadingError(false)
        await engine.load(setProgress)
        setLoaded(true)
      }
      setArmed(true)
      return true
    } catch {
      setLoadingError(true)
      return false
    }
  }

  const changeSpeed = (s: number) => {
    setSpeed(s)
    engine?.setSpeed(s)
  }

  const chooseSong = async (song: Song) => {
    if (!(await enable())) return
    setSelected(song)
    selectedRef.current = song
    engine!.startSong(song)
    setPlaying(true)
    setPanel(null)
  }

  const togglePlay = async () => {
    if (playing) {
      engine?.pause()
      setPlaying(false)
      return
    }
    if (!(await enable())) return
    engine!.startSong(selected, engine!.position >= selected.duration ? 0 : engine!.position)
    setPlaying(true)
  }

  const openShare = (record: Recording) => {
    setShareFile(null)
    setShareError(false)
    openEdit({ kind: 'share', record })
  }

  const stopRecording = async () => {
    if (!engine || !recordingRef.current) return
    recordingRef.current = false
    setRecording(false)
    const result = engine.stopRecording()
    if (!result.events.length) {
      tell(t('toastNoNotes'))
      return
    }
    const time = new Date().toLocaleTimeString(lang === 'zh' ? 'zh-TW' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const r: Recording = {
      ...result,
      id: crypto.randomUUID(),
      version: 1,
      created: Date.now(),
      title: t('recordingName', { time }),
      subtitle: 'recording',
      category: '錄音',
      bpm: Math.round(selected.bpm * speed),
    }
    try {
      await saveRecording(r)
      setRecords(await listRecordings())
      tell(t('toastSaved'), true)
    } catch (err) {
      setRecords((old) => [r, ...old])
      tellError(err)
      openShare(r)
    }
  }
  useEffect(() => {
    stopRecordRef.current = () => {
      void stopRecording()
    }
  })
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(() => {
      if (engine && engine.recordingDuration >= 300) stopRecordRef.current()
    }, 250)
    return () => clearInterval(timer)
  }, [recording, engine])

  const toggleRecording = async () => {
    if (recording) {
      await stopRecording()
      return
    }
    if (!(await enable())) return
    engine!.startRecording()
    recordingRef.current = true
    setRecording(true)
    tell(t('toastRecording'))
  }

  useEffect(() => {
    if (edit?.kind !== 'share' || !engine) return
    let current = true
    engine
      .renderWav(edit.record)
      .then((blob) => {
        if (current)
          setShareFile(new File([blob], `${edit.record.title.replace(/[/\\:*?"<>|]/g, '_')}.wav`, { type: 'audio/wav' }))
      })
      .catch(() => {
        if (current) setShareError(true)
      })
    return () => {
      current = false
    }
  }, [edit, engine])

  const share = async () => {
    if (!shareFile) return
    try {
      if (navigator.canShare?.({ files: [shareFile] })) await navigator.share({ files: [shareFile], title: edit?.record.title })
      else {
        download(shareFile, shareFile.name)
        tell(t('toastDownloaded'))
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') tell(t('toastShareFailed'))
    }
  }

  const importFile = async (file: File) => {
    try {
      if (file.size > 2_000_000) throw new StorageError('errTooLarge')
      const r = parseRecording(await file.text())
      await saveRecording(r)
      setRecords(await listRecordings())
      tell(t('toastImported'))
    } catch (err) {
      tellError(err)
    }
  }

  const commitEdit = async () => {
    if (!edit || saving) return
    setSaving(true)
    try {
      if (edit.kind === 'rename') {
        const name = title.trim() || edit.record.title
        await saveRecording({ ...edit.record, title: name })
        if (selected.id === edit.record.id) setSelected((s) => ({ ...s, title: name }))
      } else if (edit.kind === 'delete') {
        await deleteRecording(edit.record.id)
        if (selected.id === edit.record.id) {
          engine?.stop()
          setPlaying(false)
          setSelected(defaultSong)
        }
      }
      setRecords(await listRecordings())
      setEdit(null)
    } catch (err) {
      tellError(err)
    } finally {
      setSaving(false)
    }
  }

  const shownEdit = edit ?? lastEdit
  const instrumentName = mode === 'guzheng' ? t('guzheng') : t('percussion')
  const instrumentOther = mode === 'guzheng' ? t('guzhengOther') : t('percussionOther')

  return (
    <I18n.Provider value={i18n}>
      <div ref={shell} className={`studio-shell ${focus ? 'focus-mode' : ''} lang-${lang}`}>
        <header className="site-header">
          <button
            type="button"
            className="brand"
            onClick={() => {
              openPanel(null)
              setFocus(false)
            }}
            aria-label={t('brandHome')}
          >
            <img className="seal" src={`${import.meta.env.BASE_URL}seal.png`} alt="" width={36} height={36} />
            <span className="brand-name" lang="en">
              Chinese Band
            </span>
          </button>
          <nav className="desktop-nav" aria-label={t('mainNav')}>
            <button type="button" aria-current={panel === null ? 'page' : undefined} onClick={() => openPanel(null)}>
              {t('navPlay')}
            </button>
            <button type="button" aria-current={panel === 'songs' ? 'page' : undefined} onClick={() => openPanel('songs')}>
              {t('navSongs')}
            </button>
            <button
              type="button"
              aria-current={panel === 'recordings' ? 'page' : undefined}
              onClick={() => openPanel('recordings')}
            >
              {t('navRecordings')}
            </button>
            <button type="button" aria-current={panel === 'guide' ? 'page' : undefined} onClick={() => openPanel('guide')}>
              {t('navGuide')}
            </button>
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="lang-button"
              lang={lang === 'zh' ? 'en' : 'zh-Hant'}
              aria-label={t('langToggleLabel')}
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            >
              {t('langToggle')}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={volume === 0 ? t('unmute') : t('mute')}
              aria-pressed={volume === 0}
              onClick={() => setVolume(volume === 0 ? unmuteVolume.current || 0.8 : 0)}
            >
              {volume === 0 ? <VolumeX size={20} strokeWidth={1.6} /> : <Volume2 size={20} strokeWidth={1.6} />}
            </button>
            <button
              type="button"
              className="icon-button desktop-settings"
              aria-label={t('openSettings')}
              onClick={() => openPanel('settings')}
            >
              <Settings2 size={20} strokeWidth={1.6} />
            </button>
            <button type="button" className="icon-button mobile-menu" aria-label={t('openMenu')} onClick={() => openPanel('menu')}>
              <Menu size={21} strokeWidth={1.6} />
            </button>
          </div>
        </header>

        <main className="workspace">
          <div className="instrument-heading">
            <div className="instrument-title">
              <h1>{instrumentName}</h1>
              <span lang={lang === 'zh' ? 'en' : 'zh-Hant'}>{instrumentOther}</span>
            </div>
            <Segmented<Mode>
              className="mode-tabs"
              label={t('instrument')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'guzheng', label: t('guzheng') },
                { value: 'percussion', label: t('percussion') },
              ]}
            />
            <button
              type="button"
              className="focus-button"
              onClick={() => setFocus(!focus)}
              aria-label={focus ? t('exitFocusLabel') : t('focusLabel')}
            >
              {focus ? <Minimize2 size={15} strokeWidth={1.7} /> : <Maximize2 size={15} strokeWidth={1.7} />}
              <span>{focus ? t('exitFocus') : t('focus')}</span>
            </button>
          </div>

          <div className="board-wrap">
            <Instrument engine={engine} mode={mode} register={register} bNotes={bNotes} group={group} enabled={armed} />
            {!armed && (
              <div className="enable-overlay">
                <button type="button" className="enable-button" onClick={enable} disabled={!loaded && !loadingError}>
                  <img className="enable-seal" src={`${import.meta.env.BASE_URL}seal.png`} alt="" width={40} height={40} />
                  <strong>{loadingError ? t('enableRetry') : loaded ? t('enable') : `${t('loading')} ${Math.round(progress * 100)}%`}</strong>
                  <span className="enable-progress" aria-hidden="true">
                    <i style={{ transform: `scaleX(${loaded ? 1 : progress})` }} />
                  </span>
                  <small>{loadingError ? t('enableError') : t('enableHint')}</small>
                </button>
              </div>
            )}
          </div>

          <div className="instrument-options">
            {mode === 'guzheng' ? (
              <>
                <span className="playing-hint">{t('hintGuzheng')}</span>
                <Segmented<number>
                  className="register-select compact"
                  label={t('register')}
                  value={register}
                  onChange={setRegister}
                  options={(
                    [
                      [1, 'regLow'],
                      [2, 'regMid'],
                      [3, 'regHigh'],
                    ] as const
                  ).map(([value, key]) => ({ value, label: t(key), aria: t('regLabel', { name: t(key) }) }))}
                />
              </>
            ) : (
              <>
                <button type="button" className="text-button bank-nav" onClick={() => setGroup(group === 0 ? 1 : 0)} aria-label={t('prevBankLabel')}>
                  <ChevronLeft size={16} strokeWidth={1.7} />
                  <span>{t('prevBank')}</span>
                </button>
                <span className="bank-label" aria-live="polite">
                  <span>{group === 0 ? t('bank0') : t('bank1')}</span>
                  <i className={group === 0 ? 'on' : ''} />
                  <i className={group === 1 ? 'on' : ''} />
                </span>
                <button type="button" className="text-button bank-nav" onClick={() => setGroup(group === 0 ? 1 : 0)} aria-label={t('nextBankLabel')}>
                  <span>{t('nextBank')}</span>
                  <ChevronRight size={16} strokeWidth={1.7} />
                </button>
              </>
            )}
          </div>

          <div className="performance-controls">
            <RecordControl active={recording} engine={engine} onClick={toggleRecording} />
            <div className="volume-control">
              <Volume2 size={17} strokeWidth={1.6} aria-hidden="true" />
              <Slider label={t('volume')} min={0} max={100} value={volume * 100} onChange={(v) => setVolume(v / 100)} />
            </div>
            <button type="button" className="tuning-button" onClick={() => openPanel('settings')} aria-label={t('keyLabel')}>
              <span>{t('keyOfC')}</span>
              <SlidersHorizontal size={14} strokeWidth={1.7} />
            </button>
          </div>
        </main>

        <Transport
          engine={engine}
          song={selected}
          playing={playing}
          loop={loop}
          speed={speed}
          onPlay={togglePlay}
          onStop={() => {
            engine?.stop()
            setPlaying(false)
          }}
          onLoop={() => setLoop(!loop)}
          onSpeed={() => openPanel('settings')}
          onLibrary={() => openPanel('songs')}
        />

        <Library
          panel={panel}
          shown={shownPanel}
          setPanel={openPanel}
          records={records}
          selected={selected}
          playing={playing}
          onSelect={chooseSong}
          onShare={openShare}
          onRename={(r) => {
            setTitle(r.title)
            openEdit({ kind: 'rename', record: r })
          }}
          onDelete={(r) => openEdit({ kind: 'delete', record: r })}
          onImport={importFile}
          speed={speed}
          setSpeed={changeSpeed}
          bNotes={bNotes}
          setBNotes={setBNotes}
          accompaniment={accompaniment}
          setAccompaniment={setAccompaniment}
          volume={volume}
          setVolume={setVolume}
        />

        <Overlay
          kind="dialog"
          initialFocus={shownEdit?.kind === 'rename' ? '#recording-title' : undefined}
          open={edit !== null}
          onClose={() => setEdit(null)}
          className={`edit-dialog edit-${shownEdit?.kind ?? 'none'}`}
          title={
            shownEdit?.kind === 'rename' ? t('renameTitle') : shownEdit?.kind === 'delete' ? t('deleteTitle') : t('shareTitle')
          }
          description={
            shownEdit?.kind === 'delete'
              ? t('deleteDesc', { title: shownEdit.record.title })
              : shownEdit?.kind === 'share'
                ? shownEdit.record.title
                : t('renameDesc')
          }
        >
          {shownEdit?.kind === 'rename' && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void commitEdit()
              }}
            >
              <label className="field-label" htmlFor="recording-title">
                {t('renameInput')}
              </label>
              <input
                id="recording-title"
                className="title-input"
                value={title}
                maxLength={100}
                autoComplete="off"
                enterKeyHint="done"
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="dialog-actions">
                <button type="button" className="outline-button" onClick={() => setEdit(null)}>
                  {t('cancel')}
                </button>
                <button className="primary-button" disabled={!title.trim() || saving} type="submit">
                  {t('renameSave')}
                </button>
              </div>
            </form>
          )}
          {shownEdit?.kind === 'delete' && (
            <div className="dialog-actions">
              <button type="button" className="outline-button" onClick={() => setEdit(null)}>
                {t('keep')}
              </button>
              <button type="button" className="danger-button" disabled={saving} onClick={commitEdit}>
                {t('confirmDelete')}
              </button>
            </div>
          )}
          {shownEdit?.kind === 'share' && (
            <div className="share-actions">
              <output className={`share-status ${shareFile ? 'ready' : shareError ? 'error' : 'busy'}`}>
                <i aria-hidden="true" />
                {shareError ? t('shareError') : !shareFile ? t('shareMaking') : t('shareReady')}
              </output>
              <button type="button" className="primary-button" disabled={!shareFile} onClick={share}>
                <Share2 size={16} strokeWidth={1.8} />
                {t('shareAudio')}
              </button>
              <button
                type="button"
                className="outline-button"
                disabled={!shareFile}
                onClick={() => {
                  if (shareFile) download(shareFile, shareFile.name)
                }}
              >
                <Download size={16} strokeWidth={1.8} />
                {t('downloadAudio')}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  download(
                    new Blob([JSON.stringify(shownEdit.record)], { type: 'application/json' }),
                    `${shownEdit.record.title}.json`,
                  )
                }
              >
                <FileMusic size={16} strokeWidth={1.7} />
                {t('downloadScore')}
              </button>
            </div>
          )}
        </Overlay>

        {notice && (
          <output className="notice" key={notice.text}>
            {notice.seal && <img className="notice-seal" src={`${import.meta.env.BASE_URL}seal.png`} alt="" width={28} height={28} />}
            <span>{notice.text}</span>
            <button type="button" aria-label={t('dismiss')} onClick={() => setNotice(null)}>
              <X size={15} strokeWidth={1.8} />
            </button>
          </output>
        )}
      </div>
    </I18n.Provider>
  )
}

