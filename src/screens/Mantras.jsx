import { useRef, useState } from 'react'
import { Header, Icon, SyncBadge } from './ui'

const EMPTY_FORM = { id: null, name: '', text: '', goal: '108' }

export default function Mantras({
  go,
  syncStatus,
  settings,
  mantras,
  images,
  onChange,
  onSaveMantra,
  onDeleteMantra,
  onAddImage,
  onDeleteImage,
}) {
  const [form, setForm] = useState(null)
  const [imgError, setImgError] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const selected = mantras.find(m => m.id === settings.mantraId) || mantras[0]

  const pickMantra = m => {
    const patch = { mantraId: m.id }
    if (typeof m.goal === 'number' && m.goal > 0) patch.target = m.goal
    onChange(patch)
  }

  const submit = e => {
    e.preventDefault()
    if (!form.name.trim()) return
    const goal = parseInt(form.goal, 10)
    const saved = onSaveMantra({ ...form, goal: goal > 0 ? goal : null })
    pickMantra(saved)
    setForm(null)
  }

  const onFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImgError(null)
    setBusy(true)
    try {
      await onAddImage(file)
    } catch (err) {
      setImgError(err.message || 'Could not add this image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <Header title="Mantras & images" onBack={() => go('counter')} right={<SyncBadge status={syncStatus} />} />

      <section className="card">
        <div className="section-head">
          <h2 className="card-title big">{selected.name}</h2>
          <span className="pill">In use</span>
        </div>
        {selected.text ? (
          <p className="mantra-full">{selected.text}</p>
        ) : (
          <p className="muted">No mantra text. Edit it to add the words you chant.</p>
        )}
        <label className="toggle-row flat">
          <span>Show mantra and image on counter</span>
          <input type="checkbox" checked={settings.showMantra} onChange={e => onChange({ showMantra: e.target.checked })} />
        </label>
      </section>

      <section className="section">
        <h2 className="section-title">Image</h2>
        <div className="grid-4">
          {images.map(img => {
            const on = settings.imageId === img.id
            return (
              <div className="thumb-wrap" key={img.id}>
                <button
                  className={`thumb ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  aria-label={img.name || 'Your image'}
                  onClick={() => onChange({ imageId: img.id })}
                >
                  <img src={img.url} alt="" />
                </button>
                {!img.builtin && (
                  <button
                    className="thumb-del"
                    aria-label="Delete image"
                    onClick={() => {
                      if (window.confirm('Delete this image?')) onDeleteImage(img.id)
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            )
          })}
          <button className="thumb add" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="plus" size={22} />
            {busy ? 'Adding…' : 'Add photo'}
          </button>
          <button
            className={`thumb none ${settings.imageId === null ? 'on' : ''}`}
            aria-pressed={settings.imageId === null}
            onClick={() => onChange({ imageId: null })}
          >
            No image
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        {imgError && <p className="error-text">{imgError}</p>}
      </section>

      <section className="section">
        <h2 className="section-title">Mantras</h2>
        {mantras.map(m => {
          const on = m.id === selected.id
          return (
            <div className={`mantra-row ${on ? 'on' : ''}`} key={m.id}>
              <button className="mantra-row-main" aria-pressed={on} onClick={() => pickMantra(m)}>
                <span className="radio-dot" aria-hidden="true"></span>
                <span className="radio-body">
                  <span className="radio-label">{m.name}</span>
                  <span className="mantra-line">{m.text.split('\n')[0] || 'No text'}</span>
                </span>
                <span className="muted small">{m.goal ?? '∞'}</span>
              </button>
              {!m.builtin && (
                <div className="mantra-row-tools">
                  <button
                    className="icon-btn sm"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => setForm({ id: m.id, name: m.name, text: m.text, goal: m.goal ? String(m.goal) : '' })}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    className="icon-btn sm"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete "${m.name}"?`)) onDeleteMantra(m.id)
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {form ? (
          <form className="card form" onSubmit={submit}>
            <h3 className="card-title">{form.id ? 'Edit mantra' : 'Add your own mantra'}</h3>
            <label className="field">
              Name
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Uvasaggaharam"
                required
                autoFocus
              />
            </label>
            <label className="field">
              Mantra text (shown while counting)
              <textarea
                rows={5}
                value={form.text}
                onChange={e => setForm({ ...form, text: e.target.value })}
                placeholder="Type or paste the mantra, one line per row"
              />
            </label>
            <label className="field">
              Usual count (leave empty for no limit)
              <input
                inputMode="numeric"
                value={form.goal}
                onChange={e => setForm({ ...form, goal: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                placeholder="108"
              />
            </label>
            <div className="actions">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save mantra
              </button>
            </div>
          </form>
        ) : (
          <button className="dashed-btn" onClick={() => setForm(EMPTY_FORM)}>
            <Icon name="plus" size={18} strokeWidth={2.5} /> Add your own mantra
          </button>
        )}
      </section>
    </main>
  )
}
