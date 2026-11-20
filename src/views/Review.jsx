import { useEffect, useMemo, useState } from 'react'
import { useStore, getState } from '../lib/store.js'
import { dueKeys, grade } from '../lib/srs.js'
import { loadLessons } from '../lib/content.js'
import { speak } from '../lib/speech.js'
import { SayBoth } from '../components/Speak.jsx'
import { checkAnswer, shuffle } from '../lib/check.js'

// Ripasso quotidiano delle parole (ripetizione dilazionata). Ogni carta: vedi l'italiano, scrivi o pensa l'inglese, poi dai un voto.
export default function Review({ mode }) {
  const total = useStore(s => Object.keys(s.srs).length)
  const [queue, setQueue] = useState(null)
  const [lessons, setLessons] = useState({})
  const [k, setK] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [typed, setTyped] = useState('')
  const [res, setRes] = useState(null)
  const [writeMode, setWriteMode] = useState(true)
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    const st = getState()
    let keys = mode === 'difficili'
      ? Object.entries(st.srs).filter(([, c]) => c.lapses > 0 || c.ease < 2.2).map(([k]) => k)
      : mode === 'tutte' ? Object.keys(st.srs) : dueKeys(st)
    keys = shuffle(keys).slice(0, mode === 'due' ? 200 : 60)
    const ids = [...new Set(keys.map(x => Number(x.split(':')[0])))]
    loadLessons(ids).then(ls => { setLessons(ls); setQueue(keys.filter(x => ls[x.split(':')[0]])) })
  }, [mode])

  const card = useMemo(() => {
    if (!queue || k >= queue.length) return null
    const [lid, i] = queue[k].split(':').map(Number)
    return { key: queue[k], w: lessons[lid]?.words[i], lid }
  }, [queue, k, lessons])

  if (!queue) return <div className="loading">Preparo il ripasso…</div>

  const header = (
    <div className="row mb">
      <div>
        <div className="eyebrow">Ripasso · ripetizione dilazionata</div>
        <h1 style={{ margin: 0 }}>{mode === 'difficili' ? 'Le parole difficili' : mode === 'tutte' ? 'Ripasso libero' : 'Il ripasso di oggi'}</h1>
      </div>
      <span className="spacer" />
      <div className="tabs" style={{ margin: 0 }}>
        <a className="btn small" href="#/ripasso">Di oggi</a>
        <a className="btn small" href="#/ripasso/difficili">Difficili</a>
        <a className="btn small" href="#/ripasso/tutte">Tutte</a>
      </div>
    </div>
  )

  if (!total) return <div>{header}<div className="card">Non hai ancora parole nel ripasso: entrano quando finisci un esercizio nella parte "50 parole" di una lezione. <a href="#/corso">Vai al corso</a></div></div>
  if (!card || !card.w) {
    return <div>{header}<div className="card center"><h2>{doneCount ? `Fatto! ${doneCount} parole ripassate 🎉` : 'Niente da ripassare adesso ✓'}</h2>
      <p className="muted">Le parole tornano da sole nei prossimi giorni. Se vuoi allenarti ancora: ripassa le difficili o tutte.</p>
      <a className="btn primary" href="#/">Torna a Oggi</a></div></div>
  }

  const { w } = card
  const next = g => {
    grade(card.key, g)
    if (g === 0) setQueue(q => [...q, card.key]) // torna in fondo alla coda
    setDoneCount(n => n + 1)
    setReveal(false); setTyped(''); setRes(null); setK(n => n + 1)
  }
  const show = e => {
    e?.preventDefault()
    if (writeMode && typed.trim()) setRes(checkAnswer(typed, [w.en]))
    setReveal(true); speak(w.en)
  }

  return (
    <div>
      {header}
      <div className="progress mb" aria-label={`${k} di ${queue.length}`}><span style={{ width: `${(k / queue.length) * 100}%` }} /></div>
      <p className="small muted">{queue.length - k} da fare · lezione {card.lid}</p>
      <section className="card" style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="center">
          <div className="eyebrow">Come si dice?</div>
          <h2>{w.it}</h2>
          {!reveal && <form onSubmit={show}>
            {writeMode && <input type="text" lang="en" autoFocus autoComplete="off" autoCapitalize="off" spellCheck="false" aria-label="Scrivi in inglese" value={typed} onChange={e => setTyped(e.target.value)} placeholder="Scrivi in inglese (o pensa la risposta)" />}
            <button className="btn primary mt" type="submit">Mostra la risposta</button>
          </form>}
          {reveal && <>
            <div className="row" style={{ justifyContent: 'center' }}><h2 lang="en" style={{ margin: 0 }}>{w.en}</h2><SayBoth text={w.en} /></div>
            <div className="pr" style={{ color: 'var(--accent)' }}>/{w.pron}/</div>
            <p className="muted mt" lang="en">{w.ex}</p>
            {res && <div className={'feedback ' + res.result}>{res.result === 'ok' ? '✓ Scritta giusta' : res.result === 'almost' ? '≈ Quasi' : '✗ Hai scritto: ' + typed}</div>}
            <p className="small muted mt">Quanto la sapevi?</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <button className="btn bad small" onClick={() => next(0)}>No</button>
              <button className="btn warn small" onClick={() => next(1)}>A fatica</button>
              <button className="btn good small" onClick={() => next(2)}>Bene</button>
              <button className="btn dark small" onClick={() => next(3)}>Facile</button>
            </div>
          </>}
        </div>
      </section>
      <label className="row small center mt" style={{ justifyContent: 'center', fontWeight: 500 }}>
        <input type="checkbox" checked={writeMode} onChange={e => setWriteMode(e.target.checked)} /> Scrivi la risposta (si impara di più)
      </label>
    </div>
  )
}
