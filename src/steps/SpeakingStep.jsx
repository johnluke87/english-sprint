import { useState } from 'react'
import { Say } from '../components/Speak.jsx'
import Mic from '../components/Mic.jsx'
import AiFeedback from '../components/AiFeedback.jsx'
import { speechScore, wordMatches } from '../lib/check.js'
import { ai } from '../lib/api.js'

export default function SpeakingStep({ lesson, done }) {
  const [tab, setTab] = useState('shadow')
  return (
    <section className="card">
      <h2>Parla</h2>
      <p className="muted">Il microfono trascrive quello che dici: se capisce, la tua pronuncia è comprensibile. Parla a voce normale, non troppo piano.</p>
      <div className="tabs" role="group" aria-label="Esercizio">
        <button aria-pressed={tab === 'shadow'} onClick={() => setTab('shadow')}>🔁 Ripeti (shadowing)</button>
        <button aria-pressed={tab === 'answer'} onClick={() => setTab('answer')}>💬 Rispondi alle domande</button>
      </div>
      {tab === 'shadow' ? <Shadowing lines={lesson.speaking.shadowing} onEnd={done} /> : <Answers prompts={lesson.speaking.prompts} onEnd={() => done()} />}
      <p className="small muted mt">Per una conversazione libera vai al <a href={`#/tutor?lezione=${lesson.id}`}>Tutor AI</a>.</p>
    </section>
  )
}

function Shadowing({ lines, onEnd }) {
  const [k, setK] = useState(0)
  const [said, setSaid] = useState(null)
  const [scores, setScores] = useState({})
  const line = lines[k]
  const score = said != null ? speechScore(said, line) : null
  const record = text => {
    setSaid(text)
    const s = speechScore(text, line)
    const next = { ...scores, [k]: Math.max(scores[k] || 0, s) }
    setScores(next)
    if (Object.keys(next).length === lines.length) onEnd(Math.round(Object.values(next).reduce((a, b) => a + b, 0) / lines.length))
  }
  return (
    <div>
      <p className="small muted">Frase {k + 1} di {lines.length}: ascoltala, poi premi il microfono e ripetila uguale (anche l'intonazione).</p>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Say text={line} /><Say text={line} rate={.7} label="Ascolta lento" />
        <h3 lang="en" style={{ margin: 0 }}>{line}</h3>
      </div>
      <div className="mt"><Mic onResult={record} label="Tocca e ripeti la frase" key={k} /></div>
      {said != null && (
        <div className={'feedback mt ' + (score >= 85 ? 'ok' : score >= 60 ? 'almost' : 'no')}>
          <div className="said" lang="en">{wordMatches(said, line).map((w, i) => <span key={i} className={w.ok ? 'ok' : 'no'}>{w.w} </span>)}</div>
          <div className="small mt">Ho capito: «<i lang="en">{said || '(niente)'}</i>» · <b>{score}%</b> {score >= 85 ? 'Ottimo!' : score >= 60 ? 'Bene, riprova le parole in rosso.' : 'Riascolta lento e riprova.'}</div>
        </div>
      )}
      <div className="row mt">
        <button className="btn small" disabled={k === 0} onClick={() => { setK(k - 1); setSaid(null) }}>← Prima</button>
        <span className="spacer" />
        <span className="small muted">{Object.keys(scores).length}/{lines.length} fatte</span>
        <button className="btn small primary" disabled={k === lines.length - 1} onClick={() => { setK(k + 1); setSaid(null) }}>Dopo →</button>
      </div>
    </div>
  )
}

function Answers({ prompts, onEnd }) {
  const [k, setK] = useState(0)
  const [text, setText] = useState('')
  const [fb, setFb] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [limit, setLimit] = useState(false)
  const p = prompts[k]
  async function check(t = text) {
    if (!t.trim()) return
    setBusy(true); setErr('')
    try {
      const r = await ai('speaking', { question: p.en, text: t })
      const next = { ...fb, [k]: r }
      setFb(next)
      if (Object.keys(next).length === prompts.length) onEnd()
    } catch (e) { setErr(e.message); if (e.status === 429) setLimit(true) }
    setBusy(false)
  }
  return (
    <div>
      <p className="small muted">Domanda {k + 1} di {prompts.length}. Rispondi a voce con 2-4 frasi: l'AI corregge quello che hai detto.</p>
      <div className="row" style={{ flexWrap: 'nowrap' }}><Say text={p.en} /><div><h3 lang="en" style={{ margin: 0 }}>{p.en}</h3><div className="muted small">{p.it}</div></div></div>
      {p.help && <div className="tip mt small">💡 {p.help}</div>}
      <div className="mt"><Mic continuous onResult={t => { setText(t); if (t) check(t) }} label="Tocca, rispondi, poi tocca di nuovo per finire" key={k} /></div>
      <label htmlFor="ans-sp" className="small muted mt" style={{ display: 'block' }}>Oppure scrivi / correggi la trascrizione:</label>
      <textarea id="ans-sp" lang="en" style={{ minHeight: 90 }} value={text} onChange={e => setText(e.target.value)} />
      <div className="row mt">
        <button className="btn small" disabled={k === 0} onClick={() => { setK(k - 1); setText('') }}>← Prima</button>
        <span className="spacer" />
        <button className="btn primary small" disabled={busy || !text.trim()} onClick={() => check()}>{busy ? 'Correggo…' : '🤖 Correggi'}</button>
        <button className="btn small" disabled={k === prompts.length - 1} onClick={() => { setK(k + 1); setText('') }}>Dopo →</button>
      </div>
      {err && <div className="error mt">{err}</div>}
      {limit && <button className="btn small mt" type="button" onClick={onEnd}>Segna la parte come fatta, senza correzione</button>}
      <AiFeedback fb={fb[k]} />
    </div>
  )
}
