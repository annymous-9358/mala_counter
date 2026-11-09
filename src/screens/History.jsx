import { useMemo, useState } from 'react'
import { Header, Icon, SyncBadge } from './ui'
import { MODE_LABEL, formatDuration } from '../lib/format'

const DAY_MS = 86400000

function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dayLabel(ts) {
  const today = startOfDay(Date.now())
  const day = startOfDay(ts)
  if (day === today) return 'Today'
  if (day === today - DAY_MS) return 'Yesterday'
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function isFull(s) {
  return s.target ? s.count >= s.target : s.count >= 108
}

export default function History({ go, syncStatus, sessions, images, onDelete }) {
  const [openId, setOpenId] = useState(null)

  const stats = useMemo(() => {
    const today = startOfDay(Date.now())
    const weekStart = today - 6 * DAY_MS
    const week = sessions.filter(s => s.endedAt >= weekStart)
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = weekStart + i * DAY_MS
      const list = week.filter(s => s.endedAt >= start && s.endedAt < start + DAY_MS)
      return {
        start,
        malas: list.filter(isFull).length,
        beads: list.reduce((n, s) => n + s.count, 0),
      }
    })
    // Streak: consecutive days (ending today or yesterday) with any counting
    const active = new Set(sessions.map(s => dayKey(s.endedAt)))
    let streak = 0
    let cursor = active.has(dayKey(today)) ? today : today - DAY_MS
    while (active.has(dayKey(cursor))) {
      streak++
      cursor -= DAY_MS
    }
    return {
      days,
      weekMalas: week.filter(isFull).length,
      weekBeads: week.reduce((n, s) => n + s.count, 0),
      totalBeads: sessions.reduce((n, s) => n + s.count, 0),
      streak,
    }
  }, [sessions])

  const groups = useMemo(() => {
    const out = []
    const sorted = [...sessions].sort((a, b) => b.endedAt - a.endedAt)
    for (const s of sorted) {
      const label = dayLabel(s.endedAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(s)
      else out.push({ label, items: [s] })
    }
    return out
  }, [sessions])

  const maxBeads = Math.max(1, ...stats.days.map(d => d.beads))
  const imageById = id => images.find(i => i.id === id)

  return (
    <main className="screen">
      <Header title="History" onBack={() => go('counter')} right={<SyncBadge status={syncStatus} />} />

      <div className="grid-3">
        <div className="stat">
          <span className="stat-label">This week</span>
          <span className="stat-value">
            {stats.weekMalas} {stats.weekMalas === 1 ? 'mala' : 'malas'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Beads (week)</span>
          <span className="stat-value">{stats.weekBeads.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Streak</span>
          <span className="stat-value accent">
            {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
          </span>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Beads per day</h2>
        <div
          className="bars"
          role="img"
          aria-label={
            'Beads per day, last 7 days: ' +
            stats.days.map(d => `${new Date(d.start).toLocaleDateString(undefined, { weekday: 'short' })} ${d.beads}`).join(', ')
          }
        >
          {stats.days.map((d, i) => (
            <div className="bar-col" key={d.start}>
              <span className="bar-num">{d.beads || ''}</span>
              <span
                className={`bar ${i === 6 ? 'today' : ''}`}
                style={{ height: `${Math.max(4, (d.beads / maxBeads) * 72)}px` }}
              ></span>
              <span className="bar-day">
                {new Date(d.start).toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
            </div>
          ))}
        </div>
        <p className="muted small">All time: {stats.totalBeads.toLocaleString()} beads</p>
      </section>

      {groups.length === 0 && (
        <div className="empty">
          <p>No malas yet.</p>
          <p className="muted">Each completed or saved mala appears here with its time and mantra.</p>
          <button className="btn-primary" onClick={() => go('counter')}>
            Start counting
          </button>
        </div>
      )}

      {groups.map(g => (
        <section className="section" key={g.label}>
          <h2 className="section-title">
            {g.label} · {g.items.reduce((n, s) => n + s.count, 0)} beads
          </h2>
          {g.items.map(s => {
            const img = s.imageId ? imageById(s.imageId) : null
            const open = openId === s.id
            return (
              <div className="history-row-wrap" key={s.id}>
                <button className="history-row" onClick={() => setOpenId(open ? null : s.id)} aria-expanded={open}>
                  {img ? (
                    <img src={img.url} alt="" className="row-img" />
                  ) : (
                    <span className="row-img placeholder">{(s.mantraName || '?').charAt(0)}</span>
                  )}
                  <span className="row-body">
                    <span className="row-title">{s.mantraName || 'Jaap'}</span>
                    <span className="row-sub">
                      {new Date(s.endedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} ·{' '}
                      {MODE_LABEL[s.mode] || s.mode}
                    </span>
                  </span>
                  <span className="row-right">
                    <span className={`row-count ${isFull(s) ? 'accent' : ''}`}>
                      {s.target ? `${s.count} / ${s.target}` : s.count}
                    </span>
                    <span className="row-sub">{formatDuration(s.durationMs)}</span>
                  </span>
                </button>
                {open && (
                  <div className="row-actions">
                    <span className="muted small">
                      Started {new Date(s.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      {s.count > 0 && s.durationMs > 0 && ` · ${Math.round((s.count / s.durationMs) * 60000)} per min`}
                    </span>
                    <button
                      className="danger-btn"
                      onClick={() => {
                        if (window.confirm('Delete this entry from history?')) onDelete(s.id)
                      }}
                    >
                      <Icon name="trash" size={16} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </main>
  )
}
