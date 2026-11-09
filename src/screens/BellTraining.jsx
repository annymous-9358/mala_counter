import { useEffect, useState } from 'react'
import { STRICTNESS, buildTemplate, sampleConsistency } from '../useBellDetector'
import { Header, Icon } from './ui'

const NEEDED = 3

export default function BellTraining({ go, settings, onChange, bell, sinkRef }) {
  const [samples, setSamples] = useState([])
  const [tests, setTests] = useState([]) // recent test results
  const training = bell.listening === 'train'
  const testing = bell.listening === 'detect'

  // Receive fingerprints while training
  useEffect(() => {
    sinkRef.current = fp => {
      setSamples(list => (list.length >= NEEDED ? list : [...list, fp]))
    }
    return () => {
      sinkRef.current = null
    }
  }, [sinkRef])

  // Once enough rings are recorded, save the template and stop
  useEffect(() => {
    if (samples.length === NEEDED && training) {
      onChange({ template: buildTemplate(samples) })
      bell.stop()
    }
  }, [samples, training, onChange, bell])

  // Collect test results while testing
  useEffect(() => {
    if (!testing || !bell.lastEvent || bell.lastEvent.kind === 'sample') return
    setTests(list => [bell.lastEvent, ...list].slice(0, 5))
  }, [bell.lastEvent, testing])

  const startTraining = () => {
    setSamples([])
    setTests([])
    bell.start('train')
  }

  const consistency = samples.length >= 2 ? sampleConsistency(samples) : null
  const template = settings.template
  const strict = STRICTNESS[settings.strictness] || STRICTNESS[2]

  return (
    <main className="screen">
      <Header title="Teach your bell" onBack={() => go('counter')} />

      <p className="lead">
        Ring your danka {NEEDED} times. The app learns your bell's exact tone, then counts only sounds that match it.
        Claps, voices, phones and other bells are ignored.
      </p>

      <section className="card">
        <div className="section-head">
          <h2 className="card-title">1 · Record your bell</h2>
          <span className="accent small strong">
            {Math.min(samples.length, NEEDED)} of {NEEDED}
          </span>
        </div>
        <div className="grid-3">
          {Array.from({ length: NEEDED }, (_, i) => {
            const done = i < samples.length
            const active = training && i === samples.length
            return (
              <div key={i} className={`sample ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                {done ? <Icon name="check" size={20} strokeWidth={2.5} /> : null}
                <span>{done ? `Ring ${i + 1}` : active ? 'Ring now…' : `Ring ${i + 1}`}</span>
              </div>
            )
          })}
        </div>
        {training && (
          <div className="meter big" aria-hidden="true">
            <span style={{ width: `${bell.level * 100}%` }}></span>
          </div>
        )}
        {consistency !== null && consistency < 0.75 && (
          <p className="warn-text">
            The rings sounded quite different from each other. Ring the same way each time, close to the phone, in a quiet
            room — or record again.
          </p>
        )}
        {template && !training && samples.length === 0 && (
          <p className="muted small">A bell is already trained. Record again to replace it.</p>
        )}
        {template && !training && samples.length === NEEDED && (
          <p className="ok-text">
            <Icon name="check" size={16} strokeWidth={2.5} /> Bell learned and saved.
          </p>
        )}
        <div className="actions">
          {training ? (
            <button className="btn-ghost wide" onClick={bell.stop}>
              Cancel
            </button>
          ) : (
            <button className="btn-primary wide" onClick={startTraining}>
              <Icon name="mic" size={18} /> {template ? 'Record again' : 'Start recording'}
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">2 · Test it</h2>
        <p className="muted small">Ring your bell, then clap or speak — see what gets counted.</p>
        {testing && (
          <div className="meter big" aria-hidden="true">
            <span style={{ width: `${bell.level * 100}%` }}></span>
          </div>
        )}
        <ul className="test-list">
          {tests.map(t => (
            <li key={t.at}>
              <span>{new Date(t.at).toLocaleTimeString(undefined, { minute: '2-digit', second: '2-digit' })}</span>
              <span className={t.kind === 'match' ? 'accent strong' : 'muted strong'}>
                {t.kind === 'match' ? 'Would count' : 'Ignored'} · {Math.round(t.score * 100)}% match
              </span>
            </li>
          ))}
          {testing && tests.length === 0 && <li className="muted">Listening…</li>}
        </ul>
        <button
          className="btn-ghost wide"
          onClick={() => (testing ? bell.stop() : bell.start('detect'))}
          disabled={training || !template}
        >
          {testing ? 'Stop test' : template ? 'Start test' : 'Record your bell first'}
        </button>
      </section>

      <section className="section">
        <label className="slider">
          <span className="slider-head">
            Match strictness <span className="muted">{strict.label}</span>
          </span>
          <input
            type="range"
            min="1"
            max="3"
            step="1"
            value={settings.strictness}
            onChange={e => onChange({ strictness: Number(e.target.value) })}
          />
          <small className="muted">Stricter ignores more other sounds but may miss soft rings.</small>
        </label>
        <label className="slider">
          <span className="slider-head">
            Loudness needed <span className="muted">{settings.sensitivity}/10</span>
          </span>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={settings.sensitivity}
            onChange={e => onChange({ sensitivity: Number(e.target.value) })}
          />
          <small className="muted">Raise it if soft rings are missed.</small>
        </label>
        <label className="slider">
          <span className="slider-head">
            Gap between rings <span className="muted">{(settings.cooldownMs / 1000).toFixed(1)} s</span>
          </span>
          <input
            type="range"
            min="300"
            max="4000"
            step="100"
            value={settings.cooldownMs}
            onChange={e => onChange({ cooldownMs: Number(e.target.value) })}
          />
          <small className="muted">One ring is counted once within this time.</small>
        </label>
      </section>

      {bell.error && <p className="error-text">{bell.error}</p>}

      <button className="btn-primary wide sticky-bottom" onClick={() => go('counter')}>
        Done
      </button>
    </main>
  )
}
