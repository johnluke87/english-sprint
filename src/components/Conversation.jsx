import { useEffect, useMemo, useRef, useState } from 'react'
import { ai } from '../lib/api.js'
import { speak, stop as stopTts } from '../lib/speech.js'
import { capture, canSpeak } from '../lib/voice.js'
import { useStore, aiQuota, aiLeft, today, getState } from '../lib/store.js'
import { localMetrics, buildReport, requestReport, saveSession, savePending, correctPending } from '../lib/talk.js'
import { LEVELS } from '../lib/scenarios.js'
import { SayBoth } from './Speak.jsx'
import VoiceOrb from './VoiceOrb.jsx'
import Report from './Report.jsx'

// Dialogo A VOCE con il tutor (conversazione, simulazioni, allenamento, fine lezione).
// cfg: { kind, ref, title, partner, scenario, goal, goalIt, level, words, targets, opener {en,it}, questions [], phrases [{en,it}], maxTurns, voice }
// Uso dell'AI: 1 chiamata per ogni risposta dello studente + 1 per il pagellino. La prima battuta è scritta (gratis).
// Se le risposte AI finiscono, il dialogo continua con le domande scritte e il pagellino è quello locale.

const ACKS = ['I see.', 'Okay, thank you.', 'That makes sense.', 'Interesting.', 'Right, thanks.', 'Good, thank you.']
const GENERIC = [
  'Could you tell me a bit more about that?',
  'Can you give me a concrete example?',
  'What was the most difficult part?',
  'How did you feel about it?',
  'What would you do differently next time?',
  'What are the next steps?',
]
const CLOSING = 'Thank you, that was really useful. Let\'s stop here for today.'

export default function Conversation({ cfg, onFinish, onActive, intro = true }) {
  const [phase, setPhase] = useState(intro ? 'intro' : 'talk')
  const [msgs, setMsgs] = useState([])
  const [status, setStatus] = useState('idle')
  const [partial, setPartial] = useState('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState(canSpeak ? 'voice' : 'text')
  const [handsFree, setHandsFree] = useState(true)
  const [showText, setShowText] = useState(true)
  const [showIt, setShowIt] = useState(false)
  const [hint, setHint] = useState('')
  const [help, setHelp] = useState(false)
  const [text, setText] = useState('')
  const [level, setLevel] = useState(() => getState().settings.voiceLevel || cfg.level || 'B1')
  const [rep, setRep] = useState(null)
  const [session, setSession] = useState(null)
  const [pendingBusy, setPendingBusy] = useState(false)
  const quota = useStore(() => aiQuota)
  const sessions = useStore(s => s.voice.sessions)
  const history = useMemo(() => sessions.filter(x => x.ref === cfg.ref).map(x => x.total), [sessions, cfg.ref])

  const R = useRef({ msgs: [], collected: [], offline: false, aiUsed: 0, scriptIdx: 0, cap: null, alive: true, ended: false })
  const levelRef = useRef(0)
  const endRef = useRef(null)
  const maxTurns = cfg.maxTurns || 6
  const questions = cfg.questions?.length ? cfg.questions : GENERIC
  const userTurns = msgs.filter(m => m.role === 'user').length

  useEffect(() => () => { R.current.alive = false; R.current.cap?.cancel(); stopTts() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [msgs, status])
  useEffect(() => { onActive?.(phase === 'talk') }, [phase, onActive])

  const setM = next => { R.current.msgs = next; setMsgs(next) }
  const need = maxTurns + 1
  const left = aiLeft()

  async function tutorSays(content, it) {
    const next = [...R.current.msgs, { role: 'assistant', content, it }]
    setM(next)
    setStatus('speaking')
    await speak(content, { voice: cfg.voice || 1 })
    if (!R.current.alive) return
    setStatus('idle')
    if (R.current.ended) { finish(); return }
    if (modeRef.current === 'voice' && handsFreeRef.current) listen()
  }
  const handsFreeRef = useRef(handsFree)
  handsFreeRef.current = handsFree
  const modeRef = useRef(mode)
  modeRef.current = mode

  function start() {
    R.current = { ...R.current, msgs: [], collected: [], offline: false, aiUsed: 0, scriptIdx: 0, ended: false, finished: false, startedAt: Date.now() }
    setRep(null); setSession(null); setErr(''); setNote('')
    setPhase('talk')
    tutorSays(cfg.opener.en, cfg.opener.it)
  }

  function listen() {
    if (R.current.cap) return
    setErr(''); setPartial(''); setStatus('listening')
    const cap = capture({
      continuous: true, silenceMs: 2600, onPartial: setPartial, onLevel: l => { levelRef.current = l },
      record: true, whisperPrompt: (cfg.words || '').slice(0, 300),
    })
    R.current.cap = cap
    cap.promise.then(r => {
      R.current.cap = null
      if (!R.current.alive || r.cancelled) return
      setPartial('')
      if (!r.text) { setStatus('idle'); setErr('Non ho sentito niente. Tocca il microfono e riprova, a voce un po\' più alta.'); return }
      userSays(r.text, r.ms)
    }).catch(e => { R.current.cap = null; if (R.current.alive) { setStatus('idle'); setErr(e.message) } })
  }

  async function userSays(content, ms) {
    const mine = [...R.current.msgs, { role: 'user', content, ms }]
    setM(mine)
    setHint(''); setHelp(false)
    const turn = mine.filter(m => m.role === 'user').length
    const last = turn >= maxTurns
    setStatus('thinking')
    const r = await reply(turn, last)
    if (!R.current.alive) return
    if (last) {
      R.current.ended = true
      // l'ultima battuta chiude il dialogo: se l'AI ha fatto comunque una domanda, la tolgo
      if (/\?\s*$/.test(r.content)) {
        const keep = r.content.split(/(?<=[.!?])\s+/).filter(x => !x.trim().endsWith('?')).join(' ')
        r.content = (keep ? keep + ' ' : '') + CLOSING
        r.it = ''
      }
    }
    await tutorSays(r.content, r.it)
  }

  // una battuta del tutor: con l'AI se ne restano (tenendone 1 per il pagellino), altrimenti scritta
  async function reply(turn, last) {
    const canAi = !R.current.offline && aiLeft() >= 2
    if (canAi) {
      try {
        const r = await ai('talk', {
          scenario: cfg.scenario + (cfg.questions?.length ? ' Questions you can ask, in your own words and in a natural order: ' + cfg.questions.join(' | ') : ''),
          goal: cfg.goal || '', level, words: cfg.words || '', turn, maxTurns,
          messages: R.current.msgs.map(m => ({ role: m.role, content: m.content })),
        }, { onWait: s => { setStatus('waiting'); setNote(`Il tutor aspetta ${s} secondi: il servizio gratuito accetta 6 risposte al minuto.`) } })
        setNote('')
        R.current.aiUsed++
        if (Array.isArray(r.errors)) R.current.collected.push(...r.errors.filter(e => e && e.wrong && e.right))
        if (r.hint) setHint(r.hint)
        if (r.reply) return { content: r.reply, it: r.replyIt }
      } catch (e) {
        if (e.status === 429 && (e.limit === 'day' || e.limit === 'all')) {
          R.current.offline = true
          setNote('Le risposte AI di oggi sono finite: il dialogo continua con le domande già pronte.')
        } else setNote('Il tutor AI non ha risposto: continuo con una domanda già pronta.')
      }
    } else if (!R.current.offline) {
      R.current.offline = true
      setNote('Senza risposte AI per oggi: il dialogo continua con le domande già pronte.')
    }
    if (last) return { content: CLOSING, it: 'Grazie, è stato davvero utile. Per oggi ci fermiamo qui.' }
    const q = questions[R.current.scriptIdx++ % questions.length]
    const ack = ACKS[(turn - 1) % ACKS.length]
    return { content: ack + ' ' + q, it: '' }
  }

  async function finish() {
    if (R.current.finished) return
    R.current.finished = true
    R.current.cap?.cancel(); stopTts()
    setPhase('report'); setStatus('thinking'); setErr('')
    const all = R.current.msgs
    const users = all.filter(m => m.role === 'user')
    const metrics = localMetrics(users, cfg.targets || [])
    const id = (cfg.kind || 'free') + '-' + Date.now().toString(36)
    let aiRep = null
    const base = { scenario: cfg.scenario, goal: cfg.goal || '', level, messages: all, metrics }
    if (users.length && !R.current.offline && aiLeft() >= 1) {
      try { aiRep = await requestReport(base, { onWait: s => setNote(`Il pagellino arriva tra circa ${s} secondi: il servizio gratuito accetta 6 risposte AI al minuto.`) }) } catch (e) { /* pagellino locale */ }
      setNote('')
    }
    const report = buildReport({ aiRep, metrics, collected: R.current.collected })
    const sess = {
      id, at: Date.now(), day: today(), kind: cfg.kind || 'free', ref: cfg.ref || '', title: cfg.title, level, ...report,
      transcript: all.map(m => [m.role === 'assistant' ? 'a' : 'u', m.content]),
      seconds: Math.round((Date.now() - (R.current.startedAt || Date.now())) / 1000),
    }
    if (users.length) {
      saveSession(sess)
      if (!report.ai) savePending({ id, at: sess.at, day: sess.day, kind: sess.kind, ref: sess.ref, title: sess.title, level, scenario: cfg.scenario, goal: cfg.goal || '', messages: all.map(m => ({ role: m.role, content: m.content })), metrics })
    }
    if (!R.current.alive) return
    setRep(report); setSession(sess); setStatus('idle')
    onFinish?.(sess)
  }

  async function correctNow() {
    if (!session) return
    setPendingBusy(true); setErr('')
    try {
      const p = { id: session.id, at: session.at, day: session.day, kind: session.kind, ref: session.ref, title: session.title, level, scenario: cfg.scenario, goal: cfg.goal || '', messages: R.current.msgs.map(m => ({ role: m.role, content: m.content })), metrics: session.metrics }
      const r = await correctPending(p)
      setRep(r)
    } catch (e) { setErr(e.message) }
    setPendingBusy(false)
  }

  function sendText(e) {
    e?.preventDefault()
    const t = text.trim()
    if (!t || status === 'thinking' || status === 'speaking') return
    setText('')
    userSays(t, 0)
  }

  // ---- schermate ----
  if (phase === 'intro') {
    return (
      <section className="card conv">
        {cfg.partner && <p className="small muted" style={{ margin: 0 }}>Parli con: <b>{cfg.partner}</b></p>}
        {cfg.goalIt && <p className="mt"><b>Obiettivo:</b> {cfg.goalIt}</p>}
        {cfg.phrases?.length > 0 && <>
          <h3>Frasi utili</h3>
          <ul className="plist">{cfg.phrases.map((p, i) => <li key={i}><SayBoth text={p.en.replace(/…/g, '')} /><span><b lang="en">{p.en}</b><br /><span className="small muted">{p.it}</span></span></li>)}</ul>
        </>}
        <div className="row mt">
          <label htmlFor="lvl" className="small"><b>Livello</b></label>
          <select id="lvl" value={level} onChange={e => setLevel(e.target.value)} style={{ width: 'auto' }}>
            {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <p className="small muted mt">
          {maxTurns} risposte tue, poi il pagellino. Il tutor parla a voce; tu rispondi a voce (il microfono si apre da solo quando lui ha finito; 2-3 secondi di silenzio chiudono il turno) o scrivendo.
          {' '}{Number.isFinite(left) ? <>Usa fino a {need} risposte AI: oggi ne restano {left}{quota ? ` su ${quota.max}` : ''}.{left < need && ' Non bastano tutte: alcune domande saranno quelle già pronte, il dialogo funziona lo stesso.'}</> : <>Usa fino a {need} risposte AI.</>}
        </p>
        {!canSpeak && <p className="tip small">Questo browser non permette di usare il microfono: si può rispondere scrivendo. Per parlare: Chrome, Edge o Safari.</p>}
        <button className="btn primary mt" onClick={start}>🎙️ Inizia il dialogo</button>
        {history.length > 0 && <p className="small muted mt">Fatto {history.length} {history.length === 1 ? 'volta' : 'volte'}: ultimo punteggio {history[history.length - 1]}/100.</p>}
      </section>
    )
  }

  if (phase === 'report') {
    return (
      <section className="card conv">
        <h2>Il pagellino</h2>
        {!rep ? <div className="center"><VoiceOrb state="thinking" label="Preparo il pagellino…" size={120} />{note && <p className="small muted" role="status">{note}</p>}</div>
          : <Report rep={rep} history={history} onPending={!rep.ai ? correctNow : null} pendingBusy={pendingBusy} />}
        {err && <div className="error mt">{err}</div>}
        {rep && <details className="mt"><summary>Rileggi il dialogo</summary>
          <div className="chat mt">{R.current.msgs.map((m, i) => <div key={i} className={'msg ' + m.role} lang="en">{m.content}</div>)}</div>
        </details>}
        {rep && <div className="row mt"><button className="btn" onClick={start}>Rifai il dialogo</button></div>}
      </section>
    )
  }

  const lastT = [...msgs].reverse().find(m => m.role === 'assistant')
  const busy = status === 'thinking' || status === 'speaking' || status === 'waiting'
  return (
    <section className="card conv">
      <div className="row small conv-bar">
        <span className="pill">{Math.min(userTurns, maxTurns)}/{maxTurns} risposte</span>
        <span className="spacer" />
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} /> Testo</label>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={showIt} onChange={e => setShowIt(e.target.checked)} /> Traduzione</label>
        {canSpeak && <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={handsFree} onChange={e => setHandsFree(e.target.checked)} /> Mani libere</label>}
      </div>

      <VoiceOrb state={status} levelRef={levelRef} label={status === 'listening' ? (partial ? 'Ti ascolto…' : 'Ti ascolto: parla in inglese') : undefined} />
      {status === 'listening' && partial && <p className="partial" lang="en">{partial}</p>}

      <div className="chat conv-chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={'msg ' + m.role}>
            {m.role === 'assistant'
              ? <>{showText ? <span lang="en">{m.content}</span> : <span className="muted small">(testo nascosto: ascolta) </span>}
                  {showIt && m.it && <div className="tr">{m.it}</div>}</>
              : <span lang="en">{m.content}</span>}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {note && <p className="small muted" role="status">{note}</p>}
      {err && <div className="error small">{err}</div>}

      <div className="conv-actions">
        {mode === 'voice' && (
          status === 'listening'
            ? <button className="mic on" onClick={() => R.current.cap?.stop()} aria-label="Ho finito di parlare"><span aria-hidden="true">■</span></button>
            : <button className="mic" onClick={listen} disabled={busy} aria-label="Parla"><span aria-hidden="true">🎙️</span></button>
        )}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn small" disabled={!lastT || status === 'listening'} onClick={async () => { setStatus('speaking'); await speak(lastT.content, { voice: cfg.voice || 1 }); setStatus('idle') }}>🔁 Ripeti</button>
          <button className="btn small" disabled={!lastT || status === 'listening'} onClick={async () => { setStatus('speaking'); await speak(lastT.content, { voice: cfg.voice || 1, rate: .75 }); setStatus('idle') }}>🐢 Più lento</button>
          <button className="btn small" onClick={() => setHelp(h => !h)} aria-expanded={help}>💡 Aiuto</button>
          {canSpeak && <button className="btn small ghost" onClick={() => { R.current.cap?.cancel(); R.current.cap = null; setStatus('idle'); setErr(''); setMode(mode === 'voice' ? 'text' : 'voice') }}>{mode === 'voice' ? '⌨️ Scrivi' : '🎙️ Parla'}</button>}
          {userTurns > 0 && <button className="btn small ghost" onClick={finish}>Termina e vedi il pagellino</button>}
        </div>
      </div>

      {help && (
        <div className="tip small mt">
          {hint && <p style={{ margin: '0 0 8px' }}>Potresti dire: <b lang="en">{hint}</b></p>}
          {cfg.phrases?.length > 0 && <ul style={{ margin: 0 }}>{cfg.phrases.slice(0, 8).map((p, i) => <li key={i}><span lang="en">{p.en}</span> <span className="muted">· {p.it}</span></li>)}</ul>}
          {!hint && !cfg.phrases?.length && <p style={{ margin: 0 }}>Rispondi con 2-3 frasi semplici. Se non sai una parola, dilla con altre parole: «the thing you use to…». Puoi anche chiedere: <b lang="en">Could you repeat, please?</b></p>}
        </div>
      )}

      {mode === 'text' && (
        <form className="row mt" style={{ flexWrap: 'nowrap' }} onSubmit={sendText}>
          <label htmlFor="conv-t" className="sr-only">Scrivi la risposta in inglese</label>
          <textarea id="conv-t" lang="en" value={text} onChange={e => setText(e.target.value)} placeholder="Scrivi in inglese" style={{ minHeight: 52 }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }} />
          <button className="btn primary" disabled={busy || !text.trim()}>Invia</button>
        </form>
      )}
    </section>
  )
}
