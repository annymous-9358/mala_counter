import { supabase, getUserId } from './supabase'

export const BUILTIN_MANTRAS = [
  {
    id: 'navkar',
    name: 'Navkar Mantra',
    text: 'णमो अरिहंताणं\nणमो सिद्धाणं\nणमो आयरियाणं\nणमो उवज्झायाणं\nणमो लोए सव्व साहूणं',
    goal: 108,
    builtin: true,
  },
]

export const BUILTIN_IMAGES = [
  { id: 'ghantakarna', url: '/ghantkarmahavir.jpg', name: 'Ghantakarna Mahavir', builtin: true },
]

export const DEFAULT_SETTINGS = {
  target: 108, // number, or null for free count
  repeat: true,
  mantraId: 'navkar',
  imageId: 'ghantakarna', // or null for no image
  mode: 'tap', // tap | bell | both
  showMantra: true,
  bell: {
    template: null, // learned fingerprint of the user's bell
    strictness: 2, // 1 loose, 2 balanced, 3 strict
    cooldownMs: 1500,
    sensitivity: 5,
  },
}

const KEYS = {
  sessions: 'mala.sessions',
  mantras: 'mala.mantras',
  images: 'mala.images',
  settings: 'mala.settings',
  current: 'mala.current',
  pending: 'mala.pending',
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(KEYS[key])
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(KEYS[key], JSON.stringify(value))
    return true
  } catch (err) {
    console.warn('Could not save', key, err)
    return false
  }
}

export function elapsedOf(timer, now = Date.now()) {
  return timer.elapsed + (timer.startedAt ? Math.max(0, now - timer.startedAt) : 0)
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

/** Carry over the count from the old single-screen version, once. */
export function migrateLegacy() {
  try {
    if (localStorage.getItem(KEYS.current)) return
    const oldCount = parseInt(localStorage.getItem('jainMalaCount') || '0', 10)
    const oldTimer = JSON.parse(localStorage.getItem('jainMalaTimer') || 'null')
    if (oldCount > 0 || oldTimer?.elapsed) {
      save('current', {
        count: oldCount || 0,
        malaNo: 1,
        timer: { elapsed: oldTimer?.elapsed || 0, startedAt: null },
        startedAt: null,
      })
    }
  } catch {
    // nothing to migrate
  }
}

/** Shrink a picked photo so it fits comfortably on the device and uploads fast. */
export function resizeImage(file, maxSide = 720) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('This file is not a supported image'))
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// Supabase sync. Every change is queued locally and pushed when possible, so
// nothing is lost when offline or when Supabase is not configured yet.
// ---------------------------------------------------------------------------

export const syncEnabled = Boolean(supabase)

export function queue(op) {
  const pending = load('pending', [])
  pending.push(op)
  save('pending', pending)
}

function sessionRow(s) {
  return {
    id: s.id,
    mantra_id: s.mantraId,
    mantra_name: s.mantraName,
    image_id: s.imageId,
    target: s.target,
    count: s.count,
    duration_ms: Math.round(s.durationMs),
    mode: s.mode,
    started_at: new Date(s.startedAt).toISOString(),
    ended_at: new Date(s.endedAt).toISOString(),
  }
}

function sessionFromRow(r) {
  return {
    id: r.id,
    mantraId: r.mantra_id,
    mantraName: r.mantra_name,
    imageId: r.image_id,
    target: r.target,
    count: r.count,
    durationMs: Number(r.duration_ms),
    mode: r.mode,
    startedAt: Date.parse(r.started_at),
    endedAt: Date.parse(r.ended_at),
  }
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

async function runOp(op, userId) {
  switch (op.type) {
    case 'session': {
      const { error } = await supabase.from('sessions').upsert(sessionRow(op.data))
      if (error) throw error
      return null
    }
    case 'sessionDelete': {
      const { error } = await supabase.from('sessions').delete().eq('id', op.id)
      if (error) throw error
      return null
    }
    case 'mantra': {
      const m = op.data
      const { error } = await supabase
        .from('mantras')
        .upsert({ id: m.id, name: m.name, text: m.text, goal: m.goal, updated_at: new Date().toISOString() })
      if (error) throw error
      return null
    }
    case 'mantraDelete': {
      const { error } = await supabase.from('mantras').delete().eq('id', op.id)
      if (error) throw error
      return null
    }
    case 'image': {
      const local = load('images', []).find(i => i.id === op.id)
      if (!local) return null // deleted before upload
      if (!local.url.startsWith('data:')) return null // already remote
      const path = `${userId}/${local.id}.jpg`
      const blob = await dataUrlToBlob(local.url)
      const up = await supabase.storage
        .from('mala-images')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (up.error) throw up.error
      const url = supabase.storage.from('mala-images').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('images').upsert({ id: local.id, path, url })
      if (error) throw error
      return { imageUploaded: { id: local.id, remoteUrl: url } }
    }
    case 'imageDelete': {
      const path = `${userId}/${op.id}.jpg`
      await supabase.storage.from('mala-images').remove([path])
      const { error } = await supabase.from('images').delete().eq('id', op.id)
      if (error) throw error
      return null
    }
    default:
      return null
  }
}

let flushing = null

/** Push queued changes. Resolves to a list of side results (e.g. uploaded image urls). */
export function flushPending() {
  if (!supabase) return Promise.resolve([])
  if (flushing) return flushing
  flushing = (async () => {
    const results = []
    try {
      const userId = await getUserId()
      let pending = load('pending', [])
      while (pending.length) {
        const op = pending[0]
        const result = await runOp(op, userId)
        if (result) results.push(result)
        pending = load('pending', []).slice(1)
        save('pending', pending)
      }
    } finally {
      flushing = null
    }
    return results
  })()
  return flushing
}

/** Download everything this user has in Supabase. */
export async function pullRemote() {
  if (!supabase) return null
  await getUserId()
  const [s, m, i] = await Promise.all([
    supabase.from('sessions').select('*').order('ended_at', { ascending: false }).limit(2000),
    supabase.from('mantras').select('*'),
    supabase.from('images').select('*'),
  ])
  if (s.error) throw s.error
  if (m.error) throw m.error
  if (i.error) throw i.error
  return {
    sessions: s.data.map(sessionFromRow),
    mantras: m.data.map(r => ({ id: r.id, name: r.name, text: r.text, goal: r.goal })),
    images: i.data.map(r => ({ id: r.id, url: r.url })),
  }
}
