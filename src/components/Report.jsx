import { useLayoutEffect, useRef } from 'react'
import { gsap, reducedMotion } from '../lib/motion.js'
import { Say, SayBoth } from './Speak.jsx'

const NAMES = { fluency: 'Fluidità', vocabulary: 'Vocabolario', grammar: 'Grammatica', task: 'Obiettivo' }
const HELP = {
  fluency: 'quanto parli con scioltezza e quanto sono complete le risposte',
  vocabulary: 'varietà delle parole e parole di lavoro usate',
  grammar: 'correttezza delle frasi',
  task: 'se hai fatto quello che chiedeva la situazione',
}

// Andamento dei punteggi (ultimi 10) come piccolo grafico a barre
export function Trend({ totals }) {
  if (!totals || totals.length < 2) return null
  const last = totals.slice(-10)
  const diff = last[last.length - 1] - last[0]
  return (
    <div className="trend">
      <div className="trend-bars" role="img" aria-label={`Ultimi punteggi: ${last.join(', ')}`}>
        {last.map((t, i) => <span key={i} style={{ height: Math.max(6, t) + '%' }} className={i === last.length - 1 ? 'now' : ''} />)}
      </div>
      <span className="small muted">{diff > 0 ? `+${diff} punti rispetto alla prima volta` : diff < 0 ? `${diff} punti: capita, si riprova` : 'stabile'}</span>
    </div>
  )
}

// Il pagellino a fine dialogo
export default function Report({ rep, history, onPending, pendingBusy }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (reducedMotion || !ref.current) return
    const ctx = gsap.context(() => {
      const n = ref.current.querySelector('.rep-total b')
      const o = { v: 0 }
      if (n) gsap.to(o, { v: rep.total, duration: 1.1, ease: 'power2.out', onUpdate: () => { n.textContent = Math.round(o.v) } })
      gsap.from('.rep-bar i', { scaleX: 0, transformOrigin: 'left center', duration: .8, ease: 'power3.out', stagger: .08 })
    }, ref)
    return () => ctx.revert()
  }, [rep])

  const m = rep.metrics || {}
  return (
    <div className="report" ref={ref}>
      <div className="rep-head">
        <div className="rep-total"><b>{rep.total}</b><span>/100</span></div>
        <div className="spacer">
          <p style={{ margin: 0 }}>{rep.summaryIt}</p>
          {history && <Trend totals={history} />}
        </div>
      </div>

      <div className="rep-bars">
        {Object.keys(NAMES).map(k => (
          <div key={k} className="rep-row">
            <div className="row" style={{ gap: 6 }}><b>{NAMES[k]}</b><span className="small muted">{HELP[k]}</span><span className="spacer" /><b>{rep.scores[k] == null ? '—' : rep.scores[k] + '/10'}</b></div>
            <div className="rep-bar"><i style={{ width: (rep.scores[k] || 0) * 10 + '%' }} /></div>
          </div>
        ))}
      </div>
      <p className="small muted">
        Misurato dall'app: {m.turns} risposte, {m.words} parole, circa {m.avg} parole a risposta{m.wpm ? `, ${m.wpm} parole al minuto` : ''}.
        {m.used?.length ? <> Frasi e parole di studio usate: <b lang="en">{m.used.join(' · ')}</b>.</> : ' Prossima volta prova a usare qualche frase utile della lista.'}
      </p>

      {!rep.ai && onPending && (
        <div className="tip small">Il dialogo è salvato: quando tornano le risposte AI si può avere la correzione completa (grammatica, errori, frasi migliori). <button className="btn small" disabled={pendingBusy} onClick={onPending}>{pendingBusy ? 'Correggo…' : '🤖 Correggi adesso'}</button></div>
      )}

      {(rep.strengthsIt?.length > 0 || rep.improveIt?.length > 0) && (
        <div className="grid grid-2 mt">
          {rep.strengthsIt?.length > 0 && <div><h3>✅ Cosa va bene</h3><ul>{rep.strengthsIt.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          {rep.improveIt?.length > 0 && <div><h3>🎯 Da migliorare</h3><ul>{rep.improveIt.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        </div>
      )}

      {rep.errors?.length > 0 && <>
        <h3 className="mt">Errori e frase giusta</h3>
        {rep.errors.map((e, i) => (
          <div className="err" key={i}>
            <span className="w" lang="en">{e.wrong}</span> → <span className="r" lang="en">{e.right}</span> <Say text={e.right} small />
            {e.whyIt && <div className="small muted">{e.whyIt}</div>}
          </div>
        ))}
      </>}
      {rep.ai && !rep.errors?.length && <p className="feedback ok mt">Nessun errore importante: ottimo lavoro.</p>}

      {rep.better?.en && <>
        <h3 className="mt">Una risposta migliore</h3>
        {rep.better.q && <p className="small muted" lang="en">«{rep.better.q}»</p>}
        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><SayBoth text={rep.better.en} /><p lang="en" style={{ margin: 0 }}>{rep.better.en}</p></div>
      </>}

      {rep.phrases?.length > 0 && <>
        <h3 className="mt">Frasi utili da imparare</h3>
        <ul className="plist">{rep.phrases.map((p, i) => <li key={i}><SayBoth text={p.en} /><span><b lang="en">{p.en}</b><br /><span className="small muted">{p.it}</span></span></li>)}</ul>
      </>}

      {rep.reviewWords?.length > 0 && <>
        <h3 className="mt">Parole da ripassare</h3>
        <p className="small muted">Sono entrate nel ripasso di pronuncia.</p>
        <div className="row">{rep.reviewWords.map((w, i) => <span key={i} className="pill"><Say text={w.en} small /> <b lang="en">{w.en}</b> = {w.it}</span>)}</div>
      </>}
    </div>
  )
}
