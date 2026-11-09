import { useState } from 'react'
import { Header, Icon, SyncBadge } from './ui'

const PRESETS = [
  { value: 108, label: '108', sub: 'Full mala' },
  { value: 54, label: '54', sub: 'Half' },
  { value: 27, label: '27', sub: 'Quarter' },
  { value: 1008, label: '1008', sub: 'Long jaap' },
  { value: null, label: '∞', sub: 'No limit' },
  { value: 'custom', label: 'Custom', sub: 'Any number' },
]

const MODES = [
  { id: 'tap', label: 'Tap', sub: 'Tap the ring (or press Space on a keyboard)' },
  { id: 'bell', label: 'Bell (danka)', sub: 'Counts only your trained bell sound' },
  { id: 'both', label: 'Tap + Bell', sub: 'Either one adds a bead' },
]

export default function Setup({ go, syncStatus, settings, mantra, image, current, onChange, onStart }) {
  const isPreset = PRESETS.some(p => p.value === settings.target)
  const [custom, setCustom] = useState(isPreset ? '' : String(settings.target ?? ''))
  const [customOpen, setCustomOpen] = useState(!isPreset)

  const pickPreset = p => {
    if (p.value === 'custom') {
      setCustomOpen(true)
      const n = parseInt(custom, 10)
      if (n > 0) onChange({ target: n })
      return
    }
    setCustomOpen(false)
    onChange({ target: p.value })
  }

  const onCustom = e => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCustom(v)
    const n = parseInt(v, 10)
    if (n > 0) onChange({ target: n })
  }

  const summary = settings.target ? `${settings.target} beads` : 'free count'

  return (
    <main className="screen">
      <Header title="New jaap" onBack={() => go('counter')} right={<SyncBadge status={syncStatus} />} />

      <section className="section">
        <h2 className="section-title">How many</h2>
        <div className="grid-3">
          {PRESETS.map(p => {
            const on = p.value === 'custom' ? customOpen : !customOpen && settings.target === p.value
            return (
              <button key={p.label} className={`choice ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => pickPreset(p)}>
                <span className="choice-big">{p.label}</span>
                <span className="choice-sub">{p.sub}</span>
              </button>
            )
          })}
        </div>
        {customOpen && (
          <label className="field">
            Custom count
            <input inputMode="numeric" placeholder="e.g. 21" value={custom} onChange={onCustom} autoFocus />
          </label>
        )}
        <label className="toggle-row">
          <span>
            Repeat malas
            <small>Save each round and start the next one automatically</small>
          </span>
          <input
            type="checkbox"
            checked={settings.repeat}
            onChange={e => onChange({ repeat: e.target.checked })}
            disabled={!settings.target}
          />
        </label>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Mantra &amp; image</h2>
          <button className="link-btn" onClick={() => go('mantras')}>
            Change
          </button>
        </div>
        <button className="pick-card" onClick={() => go('mantras')}>
          {image ? (
            <img src={image.url} alt="" className="pick-img" />
          ) : (
            <span className="pick-img placeholder">{mantra.name.charAt(0)}</span>
          )}
          <span className="pick-body">
            <span className="pick-name">{mantra.name}</span>
            <span className="pick-text">{mantra.text.split('\n')[0] || 'No text'}</span>
          </span>
        </button>
      </section>

      <section className="section">
        <h2 className="section-title">Count with</h2>
        {MODES.map(m => (
          <button
            key={m.id}
            className={`radio-card ${settings.mode === m.id ? 'on' : ''}`}
            aria-pressed={settings.mode === m.id}
            onClick={() => onChange({ mode: m.id })}
          >
            <span className="radio-dot" aria-hidden="true"></span>
            <span className="radio-body">
              <span className="radio-label">{m.label}</span>
              <span className="radio-sub">{m.sub}</span>
            </span>
          </button>
        ))}
        {settings.mode !== 'tap' && (
          <button className="link-btn left" onClick={() => go('bell')}>
            <Icon name="bell" size={16} /> {settings.bell.template ? 'Re-train or tune your bell' : 'Teach the app your bell first'}
          </button>
        )}
      </section>

      <button className="btn-primary wide sticky-bottom" onClick={onStart}>
        {current.count > 0 ? `Continue · ${current.count} counted` : `Start · ${summary}`}
      </button>
    </main>
  )
}
