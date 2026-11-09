import { useCallback, useEffect, useRef, useState } from 'react'

// How often audio is analysed
const FRAME_MS = 20
// Frequency range used for detection and fingerprints
const LOW_HZ = 300
const HIGH_HZ = 10000
// The fingerprint splits that range into log-spaced bands
const FINGERPRINT_BANDS = 40
// A strike is a sudden rise compared with the level ~60-160 ms earlier.
// Comparing with the recent past (not a long average) lets a new strike be
// detected even while the previous ring is still fading out.
const HISTORY_FRAMES = 8
const REFERENCE_FRAMES = 5
// After a strike, skip the "clack" and listen to the ringing tone
const CAPTURE_START_MS = 40
const CAPTURE_END_MS = 220
// Ignore anything quieter than this (dB)
const MIN_LEVEL_DB = -80
// Without a trained bell, fall back to "is it a ringing tone at all?"
const MIN_TONALITY_DB = 10

// Minimum fingerprint similarity (0..1) for each strictness level
export const STRICTNESS = {
  1: { label: 'Loose', threshold: 0.72 },
  2: { label: 'Balanced', threshold: 0.82 },
  3: { label: 'Strict', threshold: 0.9 },
}

function cosine(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

function normalize(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return v.map(x => x / n)
}

/** Average several recorded fingerprints into one template. */
export function buildTemplate(samples) {
  if (!samples.length) return null
  const out = new Array(samples[0].length).fill(0)
  samples.forEach(s => s.forEach((x, i) => (out[i] += x)))
  return normalize(out).map(x => Math.round(x * 10000) / 10000)
}

/** How alike recorded samples are to each other (0..1) – a quality hint. */
export function sampleConsistency(samples) {
  if (samples.length < 2) return 1
  let total = 0
  let pairs = 0
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      total += cosine(samples[i], samples[j])
      pairs++
    }
  }
  return total / pairs
}

/**
 * Listens to the microphone for bell strikes.
 *
 * mode "detect": calls onBell() for each strike that matches the trained
 *   template (or, with no template, for any ringing tone). Other sounds call
 *   onReject(score).
 * mode "train": calls onSample(fingerprint) for every strike heard.
 */
export function useBellDetector({ template, strictness = 2, cooldownMs = 1500, sensitivity = 5, onBell, onReject, onSample }) {
  const [listening, setListening] = useState(null) // null | 'detect' | 'train'
  const [error, setError] = useState(null)
  const [level, setLevel] = useState(0)
  const [lastEvent, setLastEvent] = useState(null) // { kind: 'match'|'reject'|'sample', score, at }

  const cbRef = useRef({})
  const settingsRef = useRef({})
  const resourcesRef = useRef(null)

  useEffect(() => {
    cbRef.current = { onBell, onReject, onSample }
  }, [onBell, onReject, onSample])

  useEffect(() => {
    settingsRef.current = { template, strictness, cooldownMs, sensitivity }
  }, [template, strictness, cooldownMs, sensitivity])

  const stop = useCallback(() => {
    const res = resourcesRef.current
    resourcesRef.current = null
    if (res) {
      clearInterval(res.intervalId)
      res.stream.getTracks().forEach(t => t.stop())
      res.ctx.close().catch(() => {})
      res.wakeLock?.release().catch(() => {})
    }
    setListening(null)
    setLevel(0)
  }, [])

  const start = useCallback(
    async (mode = 'detect') => {
      if (resourcesRef.current) {
        resourcesRef.current.mode = mode
        setListening(mode)
        return
      }
      setError(null)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Microphone is not available in this browser (the site must be opened over HTTPS).')
        return
      }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Speech filters would suppress the bell, so turn them off
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
      } catch (err) {
        setError(
          err?.name === 'NotAllowedError'
            ? 'Microphone permission was denied. Allow it in your browser settings and try again.'
            : 'Could not access the microphone.'
        )
        return
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0
      ctx.createMediaStreamSource(stream).connect(analyser)

      const binHz = ctx.sampleRate / analyser.fftSize
      const lowBin = Math.max(1, Math.floor(LOW_HZ / binHz))
      const highBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(HIGH_HZ / binHz))
      const spectrum = new Float32Array(analyser.frequencyBinCount)

      // Map every FFT bin in range to a fingerprint band (log-spaced)
      const bandOf = new Int16Array(analyser.frequencyBinCount).fill(-1)
      const logLow = Math.log(LOW_HZ)
      const logSpan = Math.log(HIGH_HZ) - logLow
      for (let i = lowBin; i <= highBin; i++) {
        const b = Math.floor(((Math.log(i * binHz) - logLow) / logSpan) * FINGERPRINT_BANDS)
        bandOf[i] = Math.min(FINGERPRINT_BANDS - 1, Math.max(0, b))
      }

      const history = []
      let lastTrigger = -Infinity
      let lastMeterUpdate = 0
      let capture = null // { from, to, bands, frames, tonality }

      const res = { stream, ctx, mode, intervalId: 0, wakeLock: null }

      const finishCapture = () => {
        const c = capture
        capture = null
        if (!c.frames) return
        const fp = normalize(Array.from(c.bands, x => Math.sqrt(x / c.frames)))
        const { template: tpl, strictness: st } = settingsRef.current
        const at = Date.now()

        if (res.mode === 'train') {
          setLastEvent({ kind: 'sample', score: 1, at })
          cbRef.current.onSample?.(fp)
          return
        }

        let ok
        let score
        if (tpl && tpl.length === fp.length) {
          score = cosine(tpl, fp)
          ok = score >= (STRICTNESS[st] || STRICTNESS[2]).threshold
        } else {
          score = Math.min(1, c.tonality / 20)
          ok = c.tonality >= MIN_TONALITY_DB
        }
        if (ok) {
          lastTrigger = performance.now()
          setLastEvent({ kind: 'match', score, at })
          cbRef.current.onBell?.(score)
        } else {
          setLastEvent({ kind: 'reject', score, at })
          cbRef.current.onReject?.(score)
        }
      }

      const analyse = () => {
        analyser.getFloatFrequencyData(spectrum)
        const now = performance.now()

        let sum = 0
        let peak = 0
        for (let i = lowBin; i <= highBin; i++) {
          const p = Math.pow(10, spectrum[i] / 10)
          sum += p
          if (p > peak) peak = p
        }
        const bins = highBin - lowBin + 1
        const levelDb = 10 * Math.log10(sum / bins + 1e-20)
        // Frames before real audio arrives read as silence (~ -200 dB)
        if (!Number.isFinite(levelDb) || levelDb < -140) return
        const tonalityDb = 10 * Math.log10(peak / (sum / bins) + 1e-20)

        if (now - lastMeterUpdate > 100) {
          lastMeterUpdate = now
          setLevel(Math.min(1, Math.max(0, (levelDb + 90) / 70)))
        }

        if (capture) {
          if (now >= capture.from) {
            for (let i = lowBin; i <= highBin; i++) {
              capture.bands[bandOf[i]] += Math.pow(10, spectrum[i] / 10)
            }
            capture.frames++
            capture.tonality = Math.max(capture.tonality, tonalityDb)
          }
          if (now >= capture.to) finishCapture()
        }

        history.push(levelDb)
        if (history.length > HISTORY_FRAMES) history.shift()
        if (history.length < HISTORY_FRAMES || capture) return

        let reference = -Infinity
        for (let i = 0; i < REFERENCE_FRAMES; i++) reference = Math.max(reference, history[i])

        const { cooldownMs: cd, sensitivity: s } = settingsRef.current
        // sensitivity 1 -> needs a 14 dB jump, 10 -> 4 dB jump
        const onsetDb = 14 - ((Math.min(10, Math.max(1, s)) - 1) * 10) / 9
        const gap = res.mode === 'train' ? 700 : cd
        if (now - lastTrigger < gap) return

        if (levelDb > MIN_LEVEL_DB && levelDb - reference > onsetDb) {
          if (res.mode === 'train') lastTrigger = now
          capture = {
            from: now + CAPTURE_START_MS,
            to: now + CAPTURE_END_MS,
            bands: new Float64Array(FINGERPRINT_BANDS),
            frames: 0,
            tonality: 0,
          }
        }
      }

      res.intervalId = setInterval(analyse, FRAME_MS)
      try {
        res.wakeLock = await navigator.wakeLock?.request('screen')
      } catch {
        // Keeping the screen on is optional
      }
      resourcesRef.current = res
      setListening(mode)
      stream.getAudioTracks().forEach(track => track.addEventListener('ended', stop))
    },
    [stop]
  )

  useEffect(() => stop, [stop])

  return { listening, start, stop, error, level, lastEvent }
}
