import { useEffect, useRef, useState } from 'react'
import { speak, stop as stopTts } from '../lib/speech.js'
import { capture, canSpeak, recordingAvailable } from '../lib/voice.js'
import { scorePron, verdict, recordPron } from '../lib/pron.js'
import { addXp } from '../lib/store.js'
import VoiceOrb from './VoiceOrb.jsx'

const CLS = { ok: 'ok', almost: 'almost', miss: 'no' }

// Pronuncia: ascolti, ripeti, punteggio con le parole colorate, riascolti la tua voce e quella giusta (anche lenta).
// items: [{ en, it, pron, tip }]. Nessuna chiamata AI (Whisper solo se il riconoscimento del browser manca).
export default function PronDrill({ items, onDone, compact }) {
  const [k, setK] = useState(0)
  const [res, setRes] = useState(null)
  const [state, setState] = useState('idle')
  const [partial, setPartial] = useState('')
  const [err, setErr] = useState('')
  const [best, setBest] = useState({})
  const [mine, setMine] = useState('')
  const [typed, setTyped] = useState('')
  const levelRef = useRef(0)
  const cap = useRef(null)
  const audio = useRef(null)
  const item = items[k]

  useEffect(() => () => { cap.current?.cancel(); stopTts() }, [])
  useEffect(() => () => { if (mine) URL.revokeObjectURL(mine) }, [mine])

  if (!item) return null

  function result(text, alts) {
    const r = scorePron(alts?.length ? alts : text, item.en)
    setRes(r)
    recordPron(r.words, item.en)
    const nb = { ...best, [k]: Math.max(best[k] ?? 0, r.score) }
    setBest(nb)
    addXp(r.score >= 80 ? 2 : 1)
    if (Object.keys(nb).length === items.length) onDone?.(Math.round(Object.values(nb).reduce((a, b) => a + b, 0) / items.length))
  }

  function go() {
    if (state === 'listening') { cap.current?.stop(); return }
    setErr(''); setRes(null); setPartial(''); setState('listening')
    if (mine) { URL.revokeObjectURL(mine); setMine('') }
    const c = capture({ continuous: false, onPartial: setPartial, onLevel: l => { levelRef.current = l }, record: true, maxMs: 20000, silenceMs: 1800 })
    cap.current = c
    c.promise.then(r => {
      cap.current = null
      setState('idle'); setPartial('')
      if (r.cancelled) return
      if (r.audioUrl) setMine(r.audioUrl)
      if (!r.text) { setErr('Non ho sentito niente: tocca il microfono, aspetta un attimo e parla a voce normale.'); return }
      result(r.text, r.alternatives)
    }).catch(e => { cap.current = null; setState('idle'); setErr(e.message) })
  }

  const move = d => { cap.current?.cancel(); stopTts(); setRes(null); setErr(''); setTyped(''); setK(x => Math.max(0, Math.min(items.length - 1, x + d))) }
  const v = res ? verdict(res.score) : null
  const done = Object.keys(best).length

  return (
    <div className={'pron' + (compact ? ' compact' : '')}>
      <div className="row small muted"><span>Frase {k + 1} di {items.length}</span><span className="spacer" /><span>{done}/{items.length} fatte</span></div>
      <div className="progress mt" aria-hidden="true"><span style={{ width: (done / items.length) * 100 + '%' }} /></div>
      {item.tip && <p className="tip small mt">{item.tip}</p>}

      <div className="pron-target mt">
        <p className="pron-en" lang="en">
          {res ? res.words.map((w, i) => <span key={i} className={'pw ' + CLS[w.r]}>{w.w} </span>) : item.en}
        </p>
        {item.it && <p className="small muted" style={{ margin: 0 }}>{item.it}</p>}
        {item.pron && <p className="small" style={{ color: 'var(--accent)', margin: 0 }}>/{item.pron}/</p>}
      </div>

      <div className="row mt" style={{ justifyContent: 'center' }}>
        <button className="btn small" onClick={() => speak(item.en)}>▶ Ascolta</button>
        <button className="btn small" onClick={() => speak(item.en, { rate: .6 })}>🐢 Lenta</button>
        {mine && <button className="btn small" onClick={() => { stopTts(); audio.current?.play() }}>🎧 La tua voce</button>}
        {mine && <audio ref={audio} src={mine} preload="auto" hidden />}
      </div>

      {canSpeak ? (
        <div className="center mt">
          <VoiceOrb state={state === 'listening' ? 'listening' : 'idle'} levelRef={levelRef} size={110}
            label={state === 'listening' ? (partial || 'Ti ascolto: ripeti la frase') : res ? `${res.score}/100` : 'Tocca il microfono e ripeti'} />
          <button className={'mic' + (state === 'listening' ? ' on' : '')} onClick={go} aria-pressed={state === 'listening'} aria-label={state === 'listening' ? 'Ho finito' : 'Registra la frase'}>
            <span aria-hidden="true">{state === 'listening' ? '■' : '🎙️'}</span>
          </button>
          {!recordingAvailable() && <p className="small muted mt">Su questo dispositivo il riascolto della propria voce non è disponibile insieme al riconoscimento.</p>}
        </div>
      ) : (
        <form className="row mt" onSubmit={e => { e.preventDefault(); if (typed.trim()) result(typed, []) }}>
          <p className="small muted" style={{ width: '100%', margin: 0 }}>Questo browser non usa il microfono: ascolta, ripeti ad alta voce e poi scrivi la frase per controllare di ricordarla.</p>
          <input lang="en" value={typed} onChange={e => setTyped(e.target.value)} aria-label="Scrivi la frase" className="spacer" />
          <button className="btn small">Controlla</button>
        </form>
      )}

      {err && <div className="error small mt">{err}</div>}
      {res && (
        <div className={'feedback mt ' + v.cls} role="status">
          <div className="row"><b className="pron-score">{res.score}</b><span>/100 · {v.t}</span></div>
          <div className="small mt">Ho capito: «<i lang="en">{res.heard || '(niente)'}</i>»</div>
          {res.words.some(w => w.r !== 'ok') && <>
            <div className="small mt">Tocca le parole da sistemare per sentirle lente:</div>
            <div className="row mt" style={{ gap: 6 }}>
              {res.words.filter(w => w.r !== 'ok' && w.n).map((w, i) => (
                <button key={i} className={'btn small chip ' + CLS[w.r]} lang="en" onClick={() => speak(w.w.replace(/[.,!?;:]/g, ''), { rate: .6 })}>🐢 {w.w.replace(/[.,!?;:]/g, '')}</button>
              ))}
            </div>
          </>}
          <p className="small mt" style={{ marginBottom: 0 }}>Legenda: <span className="pw ok">verde</span> giusta · <span className="pw almost">giallo</span> quasi · <span className="pw no">rosso</span> non capita.</p>
        </div>
      )}

      <div className="row mt">
        <button className="btn small" disabled={k === 0} onClick={() => move(-1)}>← Prima</button>
        <span className="spacer" />
        {res && <button className="btn small" onClick={go}>Riprova</button>}
        <button className="btn small primary" disabled={k === items.length - 1} onClick={() => move(1)}>Dopo →</button>
      </div>
    </div>
  )
}
