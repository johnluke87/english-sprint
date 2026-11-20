import { aiLeft } from '../lib/store.js'
import { useState } from 'react'
import { Say } from '../components/Speak.jsx'
import { checkAnswer } from '../lib/check.js'
import { ai } from '../lib/api.js'

export default function TranslateStep({ lesson, done }) {
  const items = lesson.translations
  const [vals, setVals] = useState(() => items.map(() => ''))
  const [res, setRes] = useState({})
  const [aiRes, setAiRes] = useState({})
  const [busy, setBusy] = useState({})

  const checkOne = i => {
    const it = items[i]
    const r = checkAnswer(vals[i], [it.en, ...(it.alt || [])])
    const next = { ...res, [i]: r }
    setRes(next)
    if (r.result === 'no' && vals[i].trim().length > 3) {
      if (aiLeft() > 0) askAi(i)
      else setAiRes(a => ({ ...a, [i]: { feedbackIt: 'Per oggi le correzioni AI gratuite sono finite: confronta la tua frase con la soluzione.' } }))
    }
    if (Object.keys(next).length === items.length) {
      const ok = Object.values(next).filter(x => x.result !== 'no').length
      done(Math.round(ok / items.length * 100))
    }
  }
  async function askAi(i) {
    setBusy(b => ({ ...b, [i]: true }))
    try {
      const r = await ai('translation', { it: items[i].it, expected: items[i].en, given: vals[i] })
      setAiRes(a => ({ ...a, [i]: r }))
      if (r.verdict === 'ok' || r.verdict === 'almost') setRes(x => ({ ...x, [i]: { result: r.verdict === 'ok' ? 'ok' : 'almost' } }))
    } catch (e) {
      setAiRes(a => ({ ...a, [i]: { feedbackIt: 'Correzione AI non disponibile: ' + e.message } }))
    }
    setBusy(b => ({ ...b, [i]: false }))
  }

  const okCount = Object.values(res).filter(x => x.result !== 'no').length
  return (
    <section className="card">
      <h2>Traduci in inglese</h2>
      <p className="muted">Scrivi la frase e premi Invio. Se la tua versione è diversa dalla soluzione, la controlla l'AI: spesso ci sono più modi giusti di dirlo.</p>
      {items.map((it, i) => {
        const r = res[i], a = aiRes[i]
        return (
          <form className="exercise" key={i} onSubmit={e => { e.preventDefault(); checkOne(i) }}>
            <label className="q" htmlFor={'tr' + i}>{i + 1}. {it.it}</label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input id={'tr' + i} type="text" lang="en" autoComplete="off" spellCheck="false" value={vals[i]} className={r ? 'input-' + r.result : ''}
                onChange={e => { const v = vals.slice(); v[i] = e.target.value; setVals(v); if (r) setRes(x => { const y = { ...x }; delete y[i]; return y }) }} />
              <button className="btn small" type="submit">OK</button>
            </div>
            {r && (
              <div className={'feedback small ' + r.result}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Say text={it.en} small />
                  <div>
                    {r.result === 'ok' ? '✓ Perfetto. ' : r.result === 'almost' ? '≈ Va bene! ' : 'Soluzione: '}<b lang="en">{it.en}</b>
                    {it.alt?.length > 0 && <div className="muted">Anche: <span lang="en">{it.alt.join(' · ')}</span></div>}
                  </div>
                </div>
                {busy[i] && <div className="mt">🤖 L'AI sta controllando la tua frase…</div>}
                {a && <div className="mt">🤖 {a.feedbackIt}{a.corrected && a.verdict !== 'ok' && <> <br />Corretta: <b lang="en">{a.corrected}</b></>}</div>}
              </div>
            )}
          </form>
        )
      })}
      {Object.keys(res).length === items.length && <p className="mt"><b>{okCount} su {items.length} giuste.</b></p>}
    </section>
  )
}
