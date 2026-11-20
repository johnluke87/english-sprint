import { useState } from 'react'
import { ai } from '../lib/api.js'
import { update, useStore } from '../lib/store.js'
import AiFeedback from '../components/AiFeedback.jsx'

export default function WritingStep({ lesson, done, id }) {
  const saved = useStore(s => s.writings[id])
  const [text, setText] = useState(saved?.text || '')
  const [fb, setFb] = useState(saved?.feedback || null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [model, setModel] = useState(false)
  const [limit, setLimit] = useState(false)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  async function correct() {
    setBusy(true); setErr('')
    try {
      const r = await ai('writing', { lesson: lesson.titleEn, task: lesson.writing.taskEn, text })
      setFb(r)
      update(s => { s.writings[id] = { text, feedback: r, at: Date.now() } })
      done(Math.round((r.score || 0) * 10))
    } catch (e) { setErr(e.message); if (e.status === 429) setLimit(true) }
    setBusy(false)
  }

  return (
    <section className="card">
      <h2>Scrivi</h2>
      <p><b>{lesson.writing.taskIt}</b></p>
      <p className="muted small" lang="en">{lesson.writing.taskEn}</p>
      <label htmlFor="wr" className="sr-only">Il tuo testo in inglese</label>
      <textarea id="wr" lang="en" spellCheck="false" value={text} onChange={e => setText(e.target.value)} placeholder="Write here in English…" />
      <div className="row mt">
        <span className="small muted">{words} parole</span><span className="spacer" />
        <button className="btn" type="button" onClick={() => setModel(m => !m)}>{model ? 'Nascondi' : 'Vedi'} il modello</button>
        <button className="btn primary" type="button" disabled={busy || words < 5} onClick={correct}>{busy ? 'Correggo…' : '🤖 Correggi con l\'AI'}</button>
      </div>
      <p className="small muted">Consiglio: scrivi senza aiuti, nemmeno il traduttore. Gli errori sono il modo più veloce per imparare.</p>
      {err && <div className="error mt">{err}</div>}
      {limit && words >= 5 && <button className="btn small mt" type="button" onClick={() => {
        update(s => { s.writings[id] = { text, feedback: null, at: Date.now() } })
        done()
      }}>Salva il testo e segna la parte come fatta</button>}
      {model && <><h3 className="mt">Modello</h3><pre className="model" lang="en">{lesson.writing.model}</pre></>}
      <AiFeedback fb={fb} />
    </section>
  )
}
