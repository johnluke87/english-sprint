import { useEffect, useMemo, useRef, useState } from 'react'
import { ai } from '../lib/api.js'
import { useStore, getState, update, today, aiLeft } from '../lib/store.js'
import { useSyllabus, nextLesson, useLesson } from '../lib/useCourse.js'
import { useEnter } from '../lib/motion.js'
import { levelFor, WORK_LINES, SIMS } from '../lib/scenarios.js'
import { speak, stop as stopTts, onVoices, voicesFor } from '../lib/speech.js'
import { capture, canSpeak } from '../lib/voice.js'
import { scorePron, verdict } from '../lib/pron.js'
import { shuffle } from '../lib/check.js'
import { addXp } from '../lib/store.js'
import Conversation from '../components/Conversation.jsx'
import PronDrill from '../components/PronDrill.jsx'
import { SayBoth } from '../components/Speak.jsx'

function Back() { return <a className="btn small ghost" href="#/parla" onClick={() => stopTts()}>← Parla</a> }
function useCur() {
  const st = useStore()
  const syl = useSyllabus()
  const n = nextLesson(st, syl)
  return syl ? (n ? n.id : 60) : null
}
const sentences = t => String(t).split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 2)

// ---- #/parla/colloquio: preparazione al colloquio dal proprio profilo ----
const FIELDS = [
  ['target', 'Ruolo per cui ti candidi', 'es. consulente, project manager, presales, esperto di accessibilità'],
  ['current', 'Lavoro attuale o ultimo', 'es. sviluppatore web in un\'agenzia'],
  ['years', 'Anni di esperienza', 'es. 10'],
  ['sector', 'Settore e clienti', 'es. siti per aziende e pubblica amministrazione'],
  ['achievements', 'Progetti e risultati più importanti', 'es. audit di accessibilità per 30 siti, un team di 4 persone coordinato…'],
  ['strengths', 'Punti di forza', 'es. precisione, spiegare le cose tecniche in modo semplice'],
  ['why', 'Perché vuoi questo ruolo', 'es. lavorare di più con i clienti e coordinare progetti'],
]

export function Colloquio() {
  const ref = useRef(null)
  useEnter(ref, [])
  const cur = useCur()
  const saved = useStore(s => s.voice.profile)
  const [form, setForm] = useState(() => ({ ...(getState().voice.profile?.data || {}) }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [drill, setDrill] = useState(null)
  const [sim, setSim] = useState(false)
  useEffect(() => () => stopTts(), [])
  const answers = saved?.answers || []
  const level = getState().settings.voiceLevel || levelFor(cur || 1)

  async function prepare(e) {
    e.preventDefault()
    if (!form.target?.trim()) { setErr('Scrivi almeno il ruolo per cui ti candidi.'); return }
    setBusy(true); setErr('')
    try {
      const r = await ai('prep', { level, profile: form })
      const list = (r.answers || []).filter(a => a && a.q && a.en).slice(0, 8)
      if (!list.length) throw new Error('Il tutor non ha preparato le risposte: riprova.')
      update(s => { s.voice.profile = { data: form, answers: list, at: Date.now(), level } })
    } catch (er) { setErr(er.message) }
    setBusy(false)
  }

  const cfg = useMemo(() => {
    if (!answers.length) return null
    const p = saved.data || {}
    return {
      kind: 'sim', ref: 'colloquio-mio', title: 'Il mio colloquio: ' + (p.target || ''), partner: 'una selezionatrice di una società internazionale',
      goalIt: 'Rispondere alle domande del colloquio usando le risposte che hai preparato, con parole tue.',
      goal: 'Answer the interview questions clearly, with concrete examples from your own experience.',
      scenario: `You are a hiring manager at an international company interviewing the student for this role: ${p.target}. Their background (from their own notes, may be in Italian): current job ${p.current || '-'}, ${p.years || '?'} years of experience, sector ${p.sector || '-'}, achievements ${p.achievements || '-'}, strengths ${p.strengths || '-'}. Ask follow-up questions about their real experience.`,
      opener: { en: 'Hi, thanks for coming in today. Could you start by telling me a little about yourself?', it: 'Salve, grazie di essere qui oggi. Può iniziare parlandomi un po\' di sé?' },
      questions: answers.slice(1).map(a => a.q),
      phrases: answers.slice(0, 8).map(a => ({ en: sentences(a.en)[0], it: 'Per rispondere a: ' + a.qIt })),
      targets: answers.map(a => sentences(a.en)[0]),
      words: '', maxTurns: 6, voice: 2, level,
    }
  }, [answers, saved])

  return (
    <div ref={ref}>
      <div className="row mb" data-anim><Back /></div>
      <div data-anim>
        <div className="eyebrow">Preparazione al colloquio</div>
        <h1>Il mio colloquio in inglese</h1>
        <p className="muted">Scrivi in italiano chi sei e che lavoro cerchi: il tutor prepara le risposte alle 8 domande classiche con i tuoi fatti veri. Poi le alleni a voce frase per frase e fai il colloquio simulato.</p>
      </div>

      {sim && cfg ? (
        <div data-anim>
          <button className="btn small mb" onClick={() => { stopTts(); setSim(false) }}>← Le mie risposte</button>
          <Conversation cfg={cfg} key="sim" />
        </div>
      ) : drill ? (
        <section className="card" data-anim>
          <button className="btn small mb" onClick={() => { stopTts(); setDrill(null) }}>← Le mie risposte</button>
          <h2 lang="en">{drill.q}</h2>
          <p className="small muted">Ripeti la risposta una frase alla volta, finché la dici sciolta. Poi prova a dirla tutta senza leggere.</p>
          <PronDrill items={sentences(drill.en).map(en => ({ en }))} key={drill.q} />
        </section>
      ) : (
        <>
          <form className="card" onSubmit={prepare} data-anim>
            <h2>{answers.length ? 'Il tuo profilo' : '1 · Il tuo profilo'}</h2>
            <div className="grid grid-2">
              {FIELDS.map(([k, l, ph]) => (
                <label key={k} className={k === 'achievements' ? 'full' : ''} style={k === 'achievements' ? { gridColumn: '1 / -1' } : undefined}>
                  <span className="small"><b>{l}</b></span>
                  {k === 'achievements'
                    ? <textarea value={form[k] || ''} placeholder={ph} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ minHeight: 80 }} />
                    : <input value={form[k] || ''} placeholder={ph} onChange={e => setForm({ ...form, [k]: e.target.value })} />}
                </label>
              ))}
            </div>
            <p className="small muted mt">Il profilo resta in questo browser. Per scrivere le risposte viene mandato al tutor AI (Groq) e non viene salvato sul server. Niente dati sensibili: bastano ruolo, esperienza e risultati.</p>
            <button className="btn primary" disabled={busy}>{busy ? 'Preparo le risposte…' : answers.length ? '🤖 Rifai le risposte (1 risposta AI)' : '🤖 Prepara le risposte (1 risposta AI)'}</button>
            {Number.isFinite(aiLeft()) && <span className="small muted"> · oggi ne restano {aiLeft()}</span>}
            {err && <div className="error mt">{err}</div>}
          </form>

          {answers.length > 0 && (
            <section className="card mt" data-anim>
              <div className="row"><h2 style={{ margin: 0 }}>2 · Le tue risposte</h2><span className="spacer" /><button className="btn primary" onClick={() => setSim(true)}>🎭 Simula il colloquio</button></div>
              {answers.map((a, i) => (
                <details key={i} className="answer mt">
                  <summary><b lang="en">{a.q}</b> <span className="small muted">· {a.qIt}</span></summary>
                  <div className="row mt" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><SayBoth text={a.en} /><p lang="en" style={{ margin: 0 }}>{a.en}</p></div>
                  <p className="small muted mt">{a.it}</p>
                  {a.tipIt && <p className="tip small">💡 {a.tipIt}</p>}
                  <button className="btn small" onClick={() => setDrill(a)}>🗣️ Allena questa risposta</button>
                </details>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ---- #/parla/ascolto: capire l'inglese a velocità reale, con accenti diversi ----
const ACC = [['en-GB', 'britannico'], ['en-US', 'americano'], ['en-AU', 'australiano'], ['en-IE', 'irlandese'], ['en-IN', 'indiano'], ['en-CA', 'canadese']]
const SPEEDS = [[1, 'Normale'], [1.15, 'Veloce'], [1.3, 'Molto veloce']]

export function Ascolto() {
  const ref = useRef(null)
  useEnter(ref, [])
  const cur = useCur()
  const { lesson } = useLesson(cur || 1)
  const [, setV] = useState(0)
  useEffect(() => onVoices(() => setV(n => n + 1)), [])
  useEffect(() => () => stopTts(), [])
  const [speed, setSpeed] = useState(1.15)
  const [round, setRound] = useState(0)
  const [k, setK] = useState(0)
  const [ans, setAns] = useState('')
  const [res, setRes] = useState(null)
  const [plays, setPlays] = useState(0)
  const [scores, setScores] = useState([])
  const [listening, setListening] = useState(false)
  const cap = useRef(null)

  // una voce (la migliore) per ogni accento disponibile sul dispositivo
  const accents = useMemo(() => {
    const all = voicesFor('en')
    const out = []
    for (const [code, name] of ACC) {
      const v = all.find(x => x.lang.replace('_', '-').toLowerCase() === code.toLowerCase())
      if (v) out.push({ v: v.name, name })
    }
    if (!out.length && all[0]) out.push({ v: all[0].name, name: 'inglese' })
    return out
  }, [voicesFor('en').length]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    const lines = [
      ...(lesson?.dialogue?.lines || []).map(l => ({ en: l.en, it: l.it })),
      ...WORK_LINES,
      ...SIMS.flatMap(s => [{ en: s.opener.en, it: s.opener.it }, ...s.questions.slice(0, 3).map(q => ({ en: q }))]),
    ].filter(x => x.en.split(' ').length >= 5 && x.en.split(' ').length <= 22)
    return shuffle(lines).slice(0, 10)
  }, [lesson, round])
  const item = items[k]
  const acc = accents.length ? accents[(k + round) % accents.length] : null

  function play(rate = speed) { setPlays(p => p + 1); speak(item.en, { rate, voiceName: acc?.v }) }
  function check(text) {
    const r = scorePron(text, item.en)
    setRes(r)
    setScores(s => { const n = [...s]; n[k] = r.score; return n })
    addXp(r.score >= 80 ? 2 : 1)
  }
  function mic() {
    if (listening) { cap.current?.stop(); return }
    setListening(true)
    const c = capture({ continuous: false, record: false })
    cap.current = c
    c.promise.then(r => { setListening(false); if (r.text) { setAns(r.text); check(r.text) } }).catch(() => setListening(false))
  }
  const next = () => { stopTts(); setAns(''); setRes(null); setPlays(0); setK(x => x + 1) }

  if (!lesson) return <div className="loading">Preparo l'ascolto…</div>
  const doneAll = k >= items.length
  const avg = scores.filter(x => x != null).length ? Math.round(scores.filter(x => x != null).reduce((a, b) => a + b, 0) / scores.filter(x => x != null).length) : 0
  return (
    <div ref={ref}>
      <div className="row mb" data-anim><Back /></div>
      <div data-anim>
        <div className="eyebrow">Ascolto</div>
        <h1>Capire a velocità reale</h1>
        <p className="muted">Senti una frase di lavoro detta veloce, con accenti diversi. Scrivi (o ripeti) quello che hai capito: il punteggio dice quante parole hai preso. Il testo compare solo dopo.</p>
      </div>
      <div className="row mb" data-anim>
        <span className="small"><b>Velocità</b></span>
        {SPEEDS.map(([r, l]) => <button key={r} className={'btn small' + (speed === r ? ' dark' : '')} onClick={() => setSpeed(r)}>{l}</button>)}
        <span className="small muted">Accenti su questo dispositivo: {accents.map(a => a.name).join(', ') || 'nessuna voce inglese'}</span>
      </div>
      <section className="card" data-anim>
        {doneAll ? (
          <div className="center">
            <h2>Media: {avg}/100</h2>
            <p className="muted">{avg >= 85 ? 'Orecchio allenato: prova la velocità più alta.' : avg >= 60 ? 'Buono: le parole piccole (articoli, preposizioni) sono le più difficili, è normale.' : 'Riprova a velocità normale: si migliora in fretta ascoltando ogni giorno.'}</p>
            <button className="btn primary" onClick={() => { setRound(r => r + 1); setK(0); setScores([]); setRes(null); setAns('') }}>Altre 10 frasi</button>
          </div>
        ) : <>
          <div className="row small muted"><span>Frase {k + 1} di {items.length}</span><span className="spacer" />{acc && <span className="pill">Accento {acc.name}</span>}</div>
          <div className="center mt">
            <button className="btn primary" onClick={() => play()}>▶ Ascolta{plays ? ` (${plays})` : ''}</button>{' '}
            <button className="btn" onClick={() => play(0.75)}>🐢 Lenta</button>
          </div>
          {!res && (
            <form className="row mt" style={{ flexWrap: 'nowrap' }} onSubmit={e => { e.preventDefault(); if (ans.trim()) check(ans) }}>
              <label htmlFor="asc" className="sr-only">Scrivi quello che hai sentito</label>
              <input id="asc" lang="en" autoComplete="off" value={ans} onChange={e => setAns(e.target.value)} placeholder="Scrivi quello che hai sentito" className="spacer" />
              {canSpeak && <button type="button" className={'btn' + (listening ? ' bad' : '')} onClick={mic} aria-label={listening ? 'Ferma' : 'Ripeti a voce'}>{listening ? '■' : '🎙️'}</button>}
              <button className="btn primary" disabled={!ans.trim()}>Controlla</button>
            </form>
          )}
          {res && (
            <div className={'feedback mt ' + verdict(res.score).cls}>
              <p className="pron-en" lang="en" style={{ fontSize: '1.3rem' }}>{res.words.map((w, i) => <span key={i} className={'pw ' + (w.r === 'miss' ? 'no' : w.r)}>{w.w} </span>)}</p>
              {item.it && <p className="small muted" style={{ margin: 0 }}>{item.it}</p>}
              <p className="small mt"><b>{res.score}/100</b> · hai scritto: «<i lang="en">{ans}</i>». Le parole in rosso sono quelle perse: riascolta la frase guardando il testo.</p>
              <div className="row"><button className="btn small" onClick={() => play(speed)}>▶ Riascolta</button><span className="spacer" /><button className="btn small primary" onClick={next}>Dopo →</button></div>
            </div>
          )}
        </>}
      </section>
    </div>
  )
}

// ---- #/parla/caso: caso del giorno inventato dall'AI (1 risposta AI, poi resta salvato per oggi) ----
export function Caso() {
  const ref = useRef(null)
  useEnter(ref, [])
  const cur = useCur()
  const { lesson } = useLesson(cur || 1)
  const c = useStore(s => s.voice.cases?.[today()])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const level = getState().settings.voiceLevel || levelFor(cur || 1)

  async function create() {
    setBusy(true); setErr('')
    try {
      const r = await ai('case', { level, topic: lesson ? lesson.titleEn : 'work', seed: today() })
      if (!r.scenario || !r.opener?.en) throw new Error('Il caso non è arrivato completo: riprova.')
      update(s => {
        const cs = { ...(s.voice.cases || {}), [today()]: { ...r, questions: (r.questions || []).slice(0, 6), phrases: (r.phrases || []).slice(0, 6), lesson: lesson?.id } }
        s.voice.cases = Object.fromEntries(Object.entries(cs).sort().slice(-7))
      })
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const cfg = c ? {
    kind: 'sim', ref: 'caso', title: 'Caso del giorno: ' + c.t, partner: c.partner, scenario: c.scenario, goal: c.goal, goalIt: c.goalIt, level,
    opener: c.opener, questions: c.questions || [], phrases: c.phrases || [], targets: (c.phrases || []).map(p => p.en), words: '', maxTurns: 6, voice: 2,
  } : null
  return (
    <div ref={ref}>
      <div className="row mb" data-anim><Back /></div>
      <div data-anim>
        <div className="eyebrow">Caso del giorno</div>
        <h1>{c ? c.t : 'Una situazione nuova ogni giorno'}</h1>
        <p className="muted">{c ? c.d : 'Il tutor inventa una situazione di lavoro nuova, legata al tema della lezione a cui sei: così non si ripetono sempre le stesse domande.'}</p>
      </div>
      {cfg ? <div data-anim><Conversation cfg={cfg} key={today()} /></div> : (
        <section className="card" data-anim>
          <p>Creare il caso usa 1 risposta AI (poi il dialogo ne usa fino a 7). Resta salvato per tutta la giornata.</p>
          <button className="btn primary" disabled={busy || !lesson} onClick={create}>{busy ? 'Invento il caso…' : '🎲 Crea il caso di oggi'}</button>
          {err && <div className="error mt">{err}</div>}
        </section>
      )}
    </div>
  )
}
