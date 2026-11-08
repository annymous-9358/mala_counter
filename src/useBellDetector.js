import { useCallback, useEffect, useRef, useState } from 'react'

// Frequency band where bell (ghanti / danka) partials carry most energy
const BAND_LOW_HZ = 1200
const BAND_HIGH_HZ = 8000
// How often audio is analysed
const FRAME_MS = 20
// A strike is a sudden rise compared with the level ~60-160 ms earlier.
// Comparing with the recent past (not a long average) lets a new strike be
// detected even while the previous ring is still fading out.
const HISTORY_FRAMES = 8
const REFERENCE_FRAMES = 5 // oldest frames of the history used as reference
// After a loud onset, how long we wait for the ringing tone to show up
const CONFIRM_WINDOW_MS = 250
// A bell is tonal: its strongest frequency stands well above the band average.
// Claps, knocks and general noise are flat and fail this check.
const MIN_TONALITY_DB = 10
// Ignore anything quieter than this (band level, dB)
const MIN_LEVEL_DB = -75

/**
 * Listens to the microphone and calls onBell() once for every bell strike.
 *
 * sensitivity: 1 (only loud, clear strikes) .. 10 (very sensitive)
 * cooldownMs:  minimum time between two counted strikes
 */
export function useBellDetector({ onBell, sensitivity, cooldownMs }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const [level, setLevel] = useState(0) // 0..1 for the meter
  const [lastDetectedAt, setLastDetectedAt] = useState(0)

  const onBellRef = useRef(onBell)
  const settingsRef = useRef({ sensitivity, cooldownMs })
  const resourcesRef = useRef(null)

  useEffect(() => {
    onBellRef.current = onBell
  }, [onBell])

  useEffect(() => {
    settingsRef.current = { sensitivity, cooldownMs }
  }, [sensitivity, cooldownMs])

  const stop = useCallback(() => {
    const res = resourcesRef.current
    resourcesRef.current = null
    if (res) {
      clearInterval(res.intervalId)
      res.stream.getTracks().forEach(t => t.stop())
      res.ctx.close().catch(() => {})
      res.wakeLock?.release().catch(() => {})
    }
    setListening(false)
    setLevel(0)
  }, [])

  const start = useCallback(async () => {
    if (resourcesRef.current) return
    setError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone is not supported in this browser (HTTPS is required).')
      return
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // These filters are tuned for speech and would suppress the bell
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow it in your browser settings.'
          : 'Could not access the microphone.'
      )
      return
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0
    source.connect(analyser)

    const binHz = ctx.sampleRate / analyser.fftSize
    const lowBin = Math.max(1, Math.floor(BAND_LOW_HZ / binHz))
    const highBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(BAND_HIGH_HZ / binHz))
    const spectrum = new Float32Array(analyser.frequencyBinCount)

    const history = [] // recent band levels (dB), newest last
    let pendingUntil = 0 // onset seen, waiting for tonal confirmation
    let lastTrigger = 0
    let lastMeterUpdate = 0

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
      const tonalityDb = 10 * Math.log10(peak / (sum / bins) + 1e-20)

      // Skip frames before real audio arrives (silent buffers read as ~ -200 dB)
      if (!Number.isFinite(levelDb) || levelDb < -140) return
      history.push(levelDb)
      if (history.length > HISTORY_FRAMES) history.shift()
      if (history.length < HISTORY_FRAMES) return
      let reference = -Infinity
      for (let i = 0; i < REFERENCE_FRAMES; i++) reference = Math.max(reference, history[i])

      const { sensitivity: s, cooldownMs: cd } = settingsRef.current
      // sensitivity 1 -> needs a 14 dB jump, 10 -> 4 dB jump
      const onsetDb = 14 - ((Math.min(10, Math.max(1, s)) - 1) * 10) / 9
      const coolingDown = now - lastTrigger < cd

      if (!coolingDown && levelDb > MIN_LEVEL_DB && levelDb - reference > onsetDb) {
        if (!pendingUntil) pendingUntil = now + CONFIRM_WINDOW_MS
      }

      if (pendingUntil) {
        if (tonalityDb >= MIN_TONALITY_DB && levelDb > MIN_LEVEL_DB) {
          pendingUntil = 0
          lastTrigger = now
          setLastDetectedAt(Date.now())
          onBellRef.current?.()
        } else if (now > pendingUntil) {
          pendingUntil = 0
        }
      }

      if (now - lastMeterUpdate > 100) {
        lastMeterUpdate = now
        // Map roughly -90 dB..-20 dB to 0..1
        setLevel(Math.min(1, Math.max(0, (levelDb + 90) / 70)))
      }
    }

    const intervalId = setInterval(analyse, FRAME_MS)

    let wakeLock = null
    try {
      wakeLock = await navigator.wakeLock?.request('screen')
    } catch {
      // Screen wake lock is optional
    }

    resourcesRef.current = { stream, ctx, intervalId, wakeLock }
    setListening(true)

    // If the mic is unplugged or permission revoked, stop cleanly
    stream.getAudioTracks().forEach(track => {
      track.addEventListener('ended', stop)
    })
  }, [stop])

  // Release the microphone when the component unmounts
  useEffect(() => stop, [stop])

  return { listening, start, stop, error, level, lastDetectedAt }
}
