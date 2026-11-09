import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  BUILTIN_IMAGES,
  BUILTIN_MANTRAS,
  DEFAULT_SETTINGS,
  elapsedOf,
  flushPending,
  load,
  migrateLegacy,
  newId,
  pullRemote,
  queue,
  resizeImage,
  save,
  syncEnabled,
} from './lib/store'
import { useBellDetector } from './useBellDetector'
import Counter from './screens/Counter'
import Setup from './screens/Setup'
import History from './screens/History'
import Mantras from './screens/Mantras'
import BellTraining from './screens/BellTraining'

migrateLegacy()

const EMPTY_CURRENT = { count: 0, malaNo: 1, timer: { elapsed: 0, startedAt: null }, startedAt: null }

function usePersisted(key, fallback) {
  const [value, setValue] = useState(() => load(key, fallback))
  useEffect(() => {
    save(key, value)
  }, [key, value])
  return [value, setValue]
}

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // not supported
  }
}

function App() {
  const [screen, setScreen] = useState('counter')
  const [settings, setSettings] = usePersisted('settings', DEFAULT_SETTINGS)
  const [userMantras, setUserMantras] = usePersisted('mantras', [])
  const [userImages, setUserImages] = usePersisted('images', [])
  const [sessions, setSessions] = usePersisted('sessions', [])
  const [current, setCurrent] = usePersisted('current', EMPTY_CURRENT)
  const [completed, setCompleted] = useState(null) // session just finished (non-repeat mode)
  const [toast, setToast] = useState(null)
  const [syncStatus, setSyncStatus] = useState(syncEnabled ? 'syncing' : 'off')

  const cfg = { ...DEFAULT_SETTINGS, ...settings, bell: { ...DEFAULT_SETTINGS.bell, ...settings.bell } }
  const mantras = useMemo(() => [...BUILTIN_MANTRAS, ...userMantras], [userMantras])
  const images = useMemo(() => [...BUILTIN_IMAGES, ...userImages], [userImages])
  const mantra = mantras.find(m => m.id === cfg.mantraId) || mantras[0]
  const image = cfg.imageId ? images.find(i => i.id === cfg.imageId) || null : null

  const updateSettings = useCallback(patch => setSettings(s => ({ ...s, ...patch })), [setSettings])
  const updateBell = useCallback(
    patch => setSettings(s => ({ ...s, bell: { ...DEFAULT_SETTINGS.bell, ...s.bell, ...patch } })),
    [setSettings]
  )

  const showToast = useCallback(text => {
    setToast({ text, at: Date.now() })
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast])

  // ---- Sync with Supabase ------------------------------------------------
  const sync = useCallback(async () => {
    if (!syncEnabled) return
    if (!navigator.onLine) {
      setSyncStatus('offline')
      return
    }
    setSyncStatus('syncing')
    try {
      await flushPending()
      const remote = await pullRemote()
      if (remote) {
        setSessions(local => {
          const byId = new Map(local.map(s => [s.id, s]))
          remote.sessions.forEach(s => byId.has(s.id) || byId.set(s.id, s))
          return [...byId.values()].sort((a, b) => b.endedAt - a.endedAt)
        })
        setUserMantras(local => {
          const byId = new Map(local.map(m => [m.id, m]))
          remote.mantras.forEach(m => byId.has(m.id) || byId.set(m.id, m))
          return [...byId.values()]
        })
        setUserImages(local => {
          const byId = new Map(local.map(i => [i.id, i]))
          remote.images.forEach(i => byId.has(i.id) || byId.set(i.id, i))
          return [...byId.values()]
        })
      }
      setSyncStatus('synced')
    } catch (err) {
      console.warn('Sync failed', err)
      setSyncStatus('error')
    }
  }, [setSessions, setUserMantras, setUserImages])

  useEffect(() => {
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [sync])

  const pushChange = useCallback(
    op => {
      queue(op)
      if (!syncEnabled || !navigator.onLine) {
        if (syncEnabled) setSyncStatus('offline')
        return
      }
      setSyncStatus('syncing')
      flushPending()
        .then(() => setSyncStatus('synced'))
        .catch(err => {
          console.warn('Sync failed', err)
          setSyncStatus('error')
        })
    },
    []
  )

  // ---- Counting -----------------------------------------------------------
  const currentRef = useRef(current)
  useEffect(() => {
    currentRef.current = current
  }, [current])

  const recordSession = useCallback(
    (cur, endedAt = Date.now()) => {
      const session = {
        id: newId(),
        mantraId: mantra.id,
        mantraName: mantra.name,
        imageId: image?.id ?? null,
        target: cfg.target,
        count: cur.count,
        durationMs: elapsedOf(cur.timer, endedAt),
        mode: cfg.mode,
        startedAt: cur.startedAt ?? endedAt,
        endedAt,
      }
      setSessions(list => [session, ...list])
      pushChange({ type: 'session', data: session })
      return session
    },
    [mantra, image, cfg.target, cfg.mode, setSessions, pushChange]
  )

  const increment = useCallback(() => {
    const cur = currentRef.current
    const target = cfg.target
    if (completed) return
    if (target && cur.count >= target) return
    const now = Date.now()
    const count = cur.count + 1
    let next = {
      ...cur,
      count,
      startedAt: cur.startedAt ?? now,
      timer: cur.timer.startedAt ? cur.timer : { ...cur.timer, startedAt: now },
    }
    if (target && count >= target) {
      const done = recordSession(next, now)
      vibrate([60, 80, 60, 80, 160])
      if (cfg.repeat) {
        next = { ...EMPTY_CURRENT, malaNo: cur.malaNo + 1 }
        showToast(`Mala complete · ${count} saved`)
      } else {
        next = { ...next, timer: { elapsed: elapsedOf(next.timer, now), startedAt: null } }
        setCompleted(done)
      }
    } else {
      vibrate(12)
    }
    currentRef.current = next
    setCurrent(next)
  }, [cfg.target, cfg.repeat, completed, recordSession, setCurrent, showToast])

  const undo = useCallback(() => {
    setCurrent(cur => ({ ...cur, count: Math.max(0, cur.count - 1) }))
  }, [setCurrent])

  const toggleTimer = useCallback(() => {
    setCurrent(cur => {
      const t = cur.timer
      return t.startedAt
        ? { ...cur, timer: { elapsed: elapsedOf(t), startedAt: null } }
        : { ...cur, timer: { ...t, startedAt: Date.now() }, startedAt: cur.startedAt ?? Date.now() }
    })
  }, [setCurrent])

  const reset = useCallback(() => {
    setCompleted(null)
    setCurrent(cur => ({ ...EMPTY_CURRENT, malaNo: cur.malaNo }))
  }, [setCurrent])

  const saveNow = useCallback(() => {
    const cur = currentRef.current
    if (cur.count === 0) return
    recordSession(cur)
    setCurrent({ ...EMPTY_CURRENT, malaNo: cur.malaNo + 1 })
    showToast('Saved to history')
  }, [recordSession, setCurrent, showToast])

  const startNext = useCallback(() => {
    setCompleted(null)
    setCurrent(cur => ({ ...EMPTY_CURRENT, malaNo: cur.malaNo + 1 }))
  }, [setCurrent])

  const startNewJaap = useCallback(() => {
    setCompleted(null)
    setCurrent(cur => (cur.count > 0 ? cur : { ...EMPTY_CURRENT }))
    setScreen('counter')
  }, [setCurrent])

  // ---- Bell ---------------------------------------------------------------
  const bellUsed = cfg.mode === 'bell' || cfg.mode === 'both'
  const trainingSink = useRef(null)
  const bell = useBellDetector({
    template: cfg.bell.template,
    strictness: cfg.bell.strictness,
    cooldownMs: cfg.bell.cooldownMs,
    sensitivity: cfg.bell.sensitivity,
    onBell: () => {
      if (screen === 'counter') increment()
    },
    onSample: fp => trainingSink.current?.(fp),
  })
  const { listening: bellListening, stop: stopBell, start: startBell } = bell

  // Stop listening when leaving bell mode, and when a non-repeating jaap is done
  useEffect(() => {
    if (bellListening === 'detect' && (!bellUsed || completed)) stopBell()
  }, [bellListening, bellUsed, completed, stopBell])

  // ---- Mantras & images ----------------------------------------------------
  const saveMantra = useCallback(
    m => {
      const data = { id: m.id || newId(), name: m.name.trim(), text: m.text, goal: m.goal ?? null }
      setUserMantras(list => {
        const exists = list.some(x => x.id === data.id)
        return exists ? list.map(x => (x.id === data.id ? data : x)) : [...list, data]
      })
      pushChange({ type: 'mantra', data })
      return data
    },
    [setUserMantras, pushChange]
  )

  const deleteMantra = useCallback(
    id => {
      setUserMantras(list => list.filter(m => m.id !== id))
      if (cfg.mantraId === id) updateSettings({ mantraId: BUILTIN_MANTRAS[0].id })
      pushChange({ type: 'mantraDelete', id })
    },
    [setUserMantras, cfg.mantraId, updateSettings, pushChange]
  )

  const addImage = useCallback(
    async file => {
      const url = await resizeImage(file)
      const img = { id: newId(), url }
      const ok = save('images', [...userImages, img])
      if (!ok) throw new Error('Not enough space on this device for another image. Delete one first.')
      setUserImages(list => [...list, img])
      updateSettings({ imageId: img.id })
      pushChange({ type: 'image', id: img.id })
      return img
    },
    [userImages, setUserImages, updateSettings, pushChange]
  )

  const deleteImage = useCallback(
    id => {
      setUserImages(list => list.filter(i => i.id !== id))
      if (cfg.imageId === id) updateSettings({ imageId: null })
      pushChange({ type: 'imageDelete', id })
    },
    [setUserImages, cfg.imageId, updateSettings, pushChange]
  )

  const deleteSession = useCallback(
    id => {
      setSessions(list => list.filter(s => s.id !== id))
      pushChange({ type: 'sessionDelete', id })
    },
    [setSessions, pushChange]
  )

  const go = useCallback(
    name => {
      if (bellListening === 'train' && name !== 'bell') stopBell()
      setScreen(name)
      window.scrollTo(0, 0)
    },
    [bellListening, stopBell]
  )

  const common = { go, syncStatus }

  return (
    <div className="app">
      {screen === 'counter' && (
        <Counter
          {...common}
          current={current}
          settings={cfg}
          mantra={mantra}
          image={image}
          sessions={sessions}
          completed={completed}
          onTap={increment}
          onUndo={undo}
          onReset={reset}
          onSave={saveNow}
          onStartNext={startNext}
          onToggleTimer={toggleTimer}
          onModeChange={mode => updateSettings({ mode })}
          bell={bell}
          onStartBell={() => startBell('detect')}
        />
      )}
      {screen === 'setup' && (
        <Setup
          {...common}
          settings={cfg}
          mantra={mantra}
          image={image}
          current={current}
          onChange={updateSettings}
          onStart={startNewJaap}
        />
      )}
      {screen === 'history' && (
        <History {...common} sessions={sessions} images={images} onDelete={deleteSession} />
      )}
      {screen === 'mantras' && (
        <Mantras
          {...common}
          settings={cfg}
          mantras={mantras}
          images={images}
          onChange={updateSettings}
          onSaveMantra={saveMantra}
          onDeleteMantra={deleteMantra}
          onAddImage={addImage}
          onDeleteImage={deleteImage}
        />
      )}
      {screen === 'bell' && (
        <BellTraining
          {...common}
          settings={cfg.bell}
          onChange={updateBell}
          bell={bell}
          sinkRef={trainingSink}
        />
      )}
      {toast && (
        <div className="toast" role="status" key={toast.at}>
          {toast.text}
        </div>
      )}
    </div>
  )
}

export default App
