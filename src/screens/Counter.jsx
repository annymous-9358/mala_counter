import { useEffect, useState } from 'react'
import { elapsedOf } from '../lib/store'
import { Icon } from './ui'
import { formatDuration } from '../lib/format'

const RING_R = 130
const RING_C = 2 * Math.PI * RING_R

function isToday(ts) {
  const d = new Date(ts)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

export default function Counter({
  go,
  current,
  settings,
  mantra,
  image,
  sessions,
  completed,
  onTap,
  onUndo,
  onReset,
  onSave,
  onStartNext,
  onToggleTimer,
  onModeChange,
  bell,
  onStartBell,
}) {
  const [now, setNow] = useState(() => Date.now())
  const [showFull, setShowFull] = useState(false)
  const running = Boolean(current.timer.startedAt)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  // Space / Enter counts when nothing else has focus
  useEffect(() => {
    const onKey = e => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        onTap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTap])

  const target = settings.target
  const count = current.count
  const progress = target ? Math.min(1, count / target) : (count % 108) / 108
  const elapsed = elapsedOf(current.timer, running ? now : Date.now())
  const todaySessions = sessions.filter(s => isToday(s.endedAt))
  const todayCount = todaySessions.reduce((n, s) => n + s.count, 0) + count
  const malaNo = todaySessions.filter(s => s.target && s.count >= s.target).length + 1
  const bellMode = settings.mode === 'bell' || settings.mode === 'both'
  const tapEnabled = settings.mode !== 'bell'
  const lines = mantra.text.split('\n').filter(Boolean)
  const preview = showFull ? lines : lines.slice(0, 2)

  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (bell.lastEvent?.kind !== 'match') return
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 500)
    return () => clearTimeout(id)
  }, [bell.lastEvent])

  const lastReject = bell.lastEvent?.kind === 'reject' && Date.now() - bell.lastEvent.at < 2500

  return (
    <main className="screen counter">
      <header className="header">
        <button className="icon-btn" onClick={() => go('setup')} aria-label="New jaap and settings">
          <Icon name="menu" />
        </button>
        <div className="header-center">
          <span className="eyebrow">{target ? `Mala ${malaNo} today` : 'Free count'}</span>
          <span className="header-name">{mantra.name}</span>
        </div>
        <button className="icon-btn" onClick={() => go('history')} aria-label="History">
          <Icon name="history" />
        </button>
      </header>

      {settings.showMantra && (
        <section className="mantra-card">
          {image && <img src={image.url} alt={image.name || 'Chosen image'} className="mantra-img" />}
          <div className="mantra-body">
            {lines.length > 0 && (
              <p className="mantra-text">
                {preview.map((l, i) => (
                  <span key={i}>
                    {l}
                    <br />
                  </span>
                ))}
              </p>
            )}
            <div className="mantra-actions">
              {lines.length > 2 && (
                <button className="link-btn" onClick={() => setShowFull(v => !v)}>
                  {showFull ? 'Show less' : 'Show full mantra'}
                </button>
              )}
              <button className="link-btn" onClick={() => go('mantras')}>
                Change
              </button>
            </div>
          </div>
        </section>
      )}

      <button
        className={`ring ${flash ? 'ring-flash' : ''}`}
        onClick={tapEnabled ? onTap : undefined}
        aria-label={tapEnabled ? `Count one bead. ${count} of ${target ?? 'no limit'}` : `${count} counted`}
        aria-disabled={!tapEnabled}
      >
        <svg viewBox="0 0 300 300" aria-hidden="true" className="ring-svg">
          <circle cx="150" cy="150" r="140" className="ring-bg" />
          <circle cx="150" cy="150" r={RING_R} className="ring-track" />
          <circle
            cx="150"
            cy="150"
            r={RING_R}
            className="ring-fill"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
            transform="rotate(-90 150 150)"
          />
        </svg>
        <span className="ring-content">
          <span className="ring-count">{count}</span>
          <span className="ring-target">{target ? `of ${target}` : 'no limit'}</span>
          <span className="ring-hint">
            {tapEnabled ? 'Tap anywhere on the ring' : 'Counting with your bell'}
          </span>
        </span>
      </button>

      <div className="stats">
        <button className="stat stat-btn" onClick={onToggleTimer} aria-label={running ? 'Pause timer' : 'Start timer'}>
          <span className="stat-label">
            Time <Icon name={running ? 'pause' : 'play'} size={12} strokeWidth={2.5} />
          </span>
          <span className="stat-value">{formatDuration(elapsed)}</span>
        </button>
        <div className="stat">
          <span className="stat-label">{target ? 'Left' : 'Malas'}</span>
          <span className="stat-value">{target ? Math.max(0, target - count) : Math.floor(count / 108)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Today</span>
          <span className="stat-value">{todayCount}</span>
        </div>
      </div>

      <div className="segmented" role="group" aria-label="Counting mode">
        {[
          ['tap', 'Tap'],
          ['bell', 'Bell'],
          ['both', 'Both'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={settings.mode === id ? 'on' : ''}
            aria-pressed={settings.mode === id}
            onClick={() => onModeChange(id)}
          >
            {id !== 'tap' && <Icon name="bell" size={16} />}
            {label}
          </button>
        ))}
      </div>

      {bellMode && (
        <div className={`bell-bar ${bell.listening === 'detect' ? 'live' : ''}`}>
          {bell.listening === 'detect' ? (
            <>
              <span className="dot" aria-hidden="true"></span>
              <span className="bell-bar-text">
                {lastReject
                  ? `Other sound ignored (${Math.round(bell.lastEvent.score * 100)}% match)`
                  : settings.bell.template
                    ? 'Listening for your bell only'
                    : 'Listening · teach your bell for fewer wrong counts'}
              </span>
              <span className="meter" aria-hidden="true">
                <span style={{ width: `${bell.level * 100}%` }}></span>
              </span>
              <button className="link-btn" onClick={bell.stop}>
                Stop
              </button>
            </>
          ) : (
            <>
              <span className="bell-bar-text">
                {settings.bell.template ? 'Your bell is trained.' : 'Bell not trained yet.'}
              </span>
              <button className="link-btn" onClick={() => go('bell')}>
                {settings.bell.template ? 'Tune' : 'Teach bell'}
              </button>
              <button className="small-btn" onClick={onStartBell} disabled={Boolean(completed)}>
                <Icon name="mic" size={16} /> Start listening
              </button>
            </>
          )}
        </div>
      )}
      {bell.error && <p className="error-text">{bell.error}</p>}

      <div className="actions">
        <button className="btn-ghost" onClick={onUndo} disabled={count === 0}>
          Undo −1
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            if (count === 0 || window.confirm('Reset this mala without saving?')) onReset()
          }}
        >
          Reset
        </button>
        <button className="btn-primary" onClick={onSave} disabled={count === 0}>
          Save
        </button>
      </div>

      {completed && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="done-title">
          <div className="dialog">
            <span className="eyebrow accent">Mala complete</span>
            <h2 id="done-title" className="dialog-title">
              {completed.count} · {formatDuration(completed.durationMs)}
            </h2>
            <p className="muted">Saved to your history.</p>
            <button className="btn-primary wide" onClick={onStartNext} autoFocus>
              Start next mala
            </button>
            <button className="link-btn" onClick={() => go('history')}>
              View history
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
