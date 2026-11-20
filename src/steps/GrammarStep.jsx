import { useState } from 'react'
import { Say } from '../components/Speak.jsx'
import { checkAnswer } from '../lib/check.js'
import { speakSequence, stop } from '../lib/speech.js'

export default function GrammarStep({ lesson, done }) {
  const g = lesson.grammar
  const [lang, setLang] = useState('it')
  const [reading, setReading] = useState(false)
  const paras = lang === 'it' ? g.explainIt : g.explainEn

  async function readAloud() {
    if (reading) { stop(); setReading(false); return }
    setReading(true)
    await speakSequence(paras.map(t => ({ text: t, lang, pause: 400 })))
    setReading(false)
  }

  return (
    <>
      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{g.title}</h2><span className="spacer" />
          <div className="tabs" style={{ margin: 0 }} role="group" aria-label="Lingua della spiegazione">
            <button aria-pressed={lang === 'it'} onClick={() => { stop(); setReading(false); setLang('it') }}>Italiano</button>
            <button aria-pressed={lang === 'en'} onClick={() => { stop(); setReading(false); setLang('en') }}>English</button>
          </div>
        </div>
        <button className="btn small mt" onClick={readAloud}>{reading ? '■ Ferma' : '🔊 Leggimi la spiegazione'}</button>
        <div className="mt" lang={lang}>{paras.map((p, i) => <p key={i}>{p}</p>)}</div>

        <h3 className="mt2">Le regole</h3>
        {g.rules.map((r, i) => (
          <div className="rule" key={i}>
            <p style={{ margin: 0 }}><b>{lang === 'it' ? r.it : r.en}</b></p>
            {lang === 'it' && <p className="small muted" lang="en" style={{ margin: 0 }}>{r.en}</p>}
            {r.form && <div className="form">{r.form}</div>}
            {r.examples.map((e, j) => (
              <div className="ex-line" key={j}><Say text={e.en} small /><div><div className="en" lang="en">{e.en}</div><div className="it">{e.it}</div></div></div>
            ))}
          </div>
        ))}
        <div className="tip mt"><b>💡 Trucco:</b> {g.tip}</div>

        <h3 className="mt2">Errori tipici degli italiani</h3>
        {g.mistakes.map((m, i) => (
          <div className="mistake" key={i}>
            <span className="w" lang="en">✗ {m.wrong}</span><span className="r" lang="en">✓ {m.right}</span>
            <span className="why">{m.why}</span>
          </div>
        ))}
      </section>
      <Exercises items={lesson.grammarExercises} onEnd={done} />
    </>
  )
}

function Exercises({ items, onEnd }) {
  const [vals, setVals] = useState(() => items.map(() => ''))
  const [res, setRes] = useState(null)
  const [show, setShow] = useState({})
  const check = e => {
    e.preventDefault()
    const r = items.map((it, i) => checkAnswer(vals[i], it.a))
    setRes(r)
    const ok = r.filter(x => x.result !== 'no').length
    onEnd(Math.round((ok / items.length) * 100))
  }
  const ok = res ? res.filter(x => x.result !== 'no').length : 0
  return (
    <form className="card" onSubmit={check}>
      <h2>Esercizi ({items.length})</h2>
      <p className="muted small">Scrivi solo la parte che manca al posto di ___. Maiuscole e apostrofi non contano.</p>
      {items.map((it, i) => {
        const [a, b] = it.q.split('___')
        const r = res?.[i]
        return (
          <div className="exercise" key={i}>
            <div className="q" lang="en">
              <span className="muted">{i + 1}.</span> {a}
              <input type="text" aria-label={`Esercizio ${i + 1}: ${it.q}`} autoComplete="off" autoCapitalize="off" spellCheck="false" lang="en"
                style={{ width: 'auto', minWidth: 140, display: 'inline-block', padding: '6px 10px', margin: '2px 4px' }}
                className={r ? 'input-' + r.result : ''} value={vals[i]} onChange={e => { const v = vals.slice(); v[i] = e.target.value; setVals(v) }} />
              {b}
            </div>
            {!r && it.hint && (show[i]
              ? <div className="small muted">💡 {it.hint}</div>
              : <button type="button" className="btn ghost small" onClick={() => setShow(s => ({ ...s, [i]: true }))}>Aiutino</button>)}
            {r && (
              <div className={'feedback ' + r.result + ' small'}>
                {r.result === 'ok' ? '✓ Giusto' : r.result === 'almost' ? '≈ Quasi (errore di battitura)' : '✗ Risposta giusta:'} <b lang="en">{it.a.join(' / ')}</b>
                {it.explain && <div>{it.explain}</div>}
              </div>
            )}
          </div>
        )
      })}
      <div className="row mt">
        {res ? <>
          <b>{ok} su {items.length} giuste ({Math.round(ok / items.length * 100)}%)</b><span className="spacer" />
          <button type="button" className="btn" onClick={() => { setRes(null); setVals(items.map(() => '')) }}>Rifai</button>
        </> : <button className="btn primary" type="submit">Correggi</button>}
      </div>
    </form>
  )
}
