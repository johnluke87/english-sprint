import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, getState, today } from '../lib/store.js'
import { useSyllabus, nextLesson, useLesson } from '../lib/useCourse.js'
import { useEnter, gsap, reducedMotion } from '../lib/motion.js'
import { SIMS, CHATS, SOUNDS, WORK_LINES, simById, levelFor, lessonTalk } from '../lib/scenarios.js'
import { duePron, hardestPron } from '../lib/pron.js'
import { addVoiceSeconds, markDailyDone, voiceStreak, DAILY_SECONDS } from '../lib/talk.js'
import { stop as stopTts } from '../lib/speech.js'
import Conversation from '../components/Conversation.jsx'
import PronDrill from '../components/PronDrill.jsx'
import { Say } from '../components/Speak.jsx'

function Back() {
  return <a className="btn small ghost" href="#/parla" onClick={() => stopTts()}>← Parla</a>
}

function useCurrentLessonId() {
  const st = useStore()
  const syl = useSyllabus()
  const n = nextLesson(st, syl)
  return syl ? (n ? n.id : 60) : null
}

// ---- #/parla/simulazione/:id ----
export function Simulazione({ id }) {
  const ref = useRef(null)
  useEnter(ref, [id])
  const cur = useCurrentLessonId()
  const sim = simById(id)
  if (!sim) return <div className="card">Simulazione non trovata. <a href="#/parla">Torna a Parla</a></div>
  if (cur == null) return <div className="loading">Carico…</div>
  const cfg = {
    kind: 'sim', ref: sim.id, title: sim.t, partner: sim.partner, scenario: sim.scenario, goal: sim.goal, goalIt: sim.goalIt,
    level: levelFor(cur), opener: sim.opener, questions: sim.questions, phrases: sim.phrases,
    targets: sim.phrases.map(p => p.en), words: sim.phrases.map(p => p.en.replace(/…/g, '')).join(' | '), maxTurns: 6, voice: sim.voice,
  }
  return (
    <div ref={ref}>
      <div className="row mb" data-anim><Back /></div>
      <div data-anim>
        <div className="eyebrow">Simulazione di lavoro</div>
        <h1><span aria-hidden="true">{sim.ico}</span> {sim.t}</h1>
        <p className="muted">{sim.d}</p>
      </div>
      <div data-anim><Conversation cfg={cfg} key={sim.id} /></div>
      <p className="small muted mt">Altre simulazioni: {SIMS.filter(s => s.id !== sim.id).slice(0, 4).map((s, i) => <span key={s.id}>{i ? ' · ' : ''}<a href={`#/parla/simulazione/${s.id}`}>{s.t}</a></span>)}</p>
    </div>
  )
}

// ---- #/parla/conversazione?lezione=N | ?s=id ----
export function Conversazione({ lessonId, chatId }) {
  const ref = useRef(null)
  useEnter(ref, [lessonId, chatId])
  const cur = useCurrentLessonId()
  const lid = lessonId || (!chatId ? cur : null)
  const { lesson } = useLesson(lid || 1)
  const chat = CHATS.find(c => c.id === chatId)
  let cfg = null
  if (chat && cur != null) {
    cfg = {
      kind: 'free', ref: 'chat:' + chat.id, title: chat.t, scenario: chat.s, goalIt: chat.d, level: levelFor(cur),
      opener: chat.opener, questions: [], phrases: [], targets: [], maxTurns: 6, voice: 1,
    }
  } else if (!chat && lid && lesson && lesson.id === lid) {
    cfg = { ...lessonTalk(lesson, { kind: 'free', maxTurns: 6 }), ref: 'free:' + lesson.id }
  }
  return (
    <div ref={ref}>
      <div className="row mb" data-anim><Back /></div>
      <div data-anim>
        <div className="eyebrow">Conversazione a voce</div>
        <h1>{cfg ? cfg.title : 'Conversazione'}</h1>
        <p className="muted">Il tutor parla, tu rispondi. Durante il dialogo non ti interrompe: gli errori, la frase giusta e le parole da ripassare arrivano alla fine.</p>
      </div>
      {cfg ? <div data-anim><Conversation cfg={cfg} key={cfg.ref} /></div> : <div className="loading">Carico…</div>}
      <div className="chips mt">
        {CHATS.filter(c => c.id !== chatId).map(c => <a key={c.id} className="btn small ghost" href={`#/parla/conversazione?s=${c.id}`}>{c.t}</a>)}
      </div>
    </div>
  )
}

// ---- #/parla/pronuncia[/ripasso|/suoni|/lavoro|/lezione] ----
export function Pronuncia({ tab: tab0 }) {
  const ref = useRef(null)
  const cur = useCurrentLessonId()
  const pron = useStore(s => s.voice.pron)
  const due = useMemo(() => duePron(getState()), [pron])
  const hard = useMemo(() => hardestPron(getState()), [pron])
  const [tab, setTab] = useState(tab0 || (due.length ? 'ripasso' : 'lezione'))
  // le parole del ripasso si fissano quando si apre la scheda: così non cambiano a metà esercizio
  const [snap, setSnap] = useState(() => due)
  useEffect(() => { if (tab === 'ripasso') setSnap(duePron(getState())) }, [tab])
  const [lid, setLid] = useState(null)
  const [sound, setSound] = useState(SOUNDS[0].id)
  const { lesson } = useLesson(lid || cur || 1)
  useEnter(ref, [tab])
  useEffect(() => () => stopTts(), [])

  const items = useMemo(() => {
    if (tab === 'ripasso') return snap.slice(0, 12).map(w => ({ en: w.ex || w.w, it: w.it || '', tip: `Parola da ripassare: «${w.w}» (sbagliata ${w.miss} ${w.miss === 1 ? 'volta' : 'volte'}).` }))
    if (tab === 'suoni') { const s = SOUNDS.find(x => x.id === sound); return s.lines.map(en => ({ en, tip: s.tip })) }
    if (tab === 'lavoro') return WORK_LINES
    if (lesson) return [...lesson.speaking.shadowing.map(en => ({ en })), ...lesson.phrases.slice(0, 6).map(p => ({ en: p.en, it: p.it }))]
    return []
  }, [tab, sound, lesson, snap])

  const TABS = [['ripasso', `Da ripassare (${due.length})`], ['lezione', 'Frasi della lezione'], ['suoni', 'Suoni difficili'], ['lavoro', 'Frasi di lavoro']]
  return (
    <div ref={ref}>
      <div className="row mb" data-anim><Back /></div>
      <div data-anim>
        <div className="eyebrow">Pronuncia</div>
        <h1>Ripeti e misura</h1>
        <p className="muted">Ascolta la frase, tocca il microfono e ripetila. Il punteggio dice quanto il riconoscimento vocale capisce: se capisce lui, capisce anche un collega straniero. Le parole sbagliate tornano nel ripasso dopo 1, 3, 7, 15 giorni.</p>
      </div>
      <div className="tabs" role="group" aria-label="Cosa allenare" data-anim>
        {TABS.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <section className="card" data-anim>
        {tab === 'lezione' && cur != null && (
          <div className="row mb">
            <label htmlFor="pl" className="small"><b>Lezione</b></label>
            <select id="pl" value={lid || cur} onChange={e => setLid(Number(e.target.value))} style={{ width: 'auto' }}>
              {Array.from({ length: 60 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {lesson && <span className="small muted">{lesson.title}</span>}
          </div>
        )}
        {tab === 'suoni' && (
          <div className="chips mb">{SOUNDS.map(s => <button key={s.id} className={'btn small' + (sound === s.id ? ' dark' : '')} onClick={() => setSound(s.id)}>{s.t}</button>)}</div>
        )}
        {tab === 'ripasso' && !items.length
          ? <p>Niente da ripassare oggi ✓ Le parole sbagliate entrano qui da sole quando le pronunci male.</p>
          : items.length > 0 && <PronDrill items={items} key={tab + sound + (lesson?.id || '')} />}
      </section>
      {hard.length > 0 && (
        <section className="card mt" data-anim>
          <h2>Le parole più difficili</h2>
          <div className="row">{hard.map(w => <span key={w.w} className="pill"><Say text={w.w} small rate={.7} /> <span lang="en">{w.w}</span> <span className="muted">×{w.miss}</span></span>)}</div>
        </section>
      )}
    </div>
  )
}

// ---- #/parla/oggi: allenamento quotidiano di 10 minuti ----
export function Allenamento() {
  const ref = useRef(null)
  const cur = useCurrentLessonId()
  const { lesson } = useLesson(cur || 1)
  const st = useStore()
  const day = st.voice.days[today()] || { seconds: 0, done: false }
  const [step, setStep] = useState('warm')
  const [active, setActive] = useState(true)
  const done = useRef(null)
  useEnter(ref, [step, !!lesson])

  // tempo: conta mentre la pagina è aperta e visibile
  useEffect(() => {
    let last = Date.now()
    const t = setInterval(() => {
      const now = Date.now()
      const d = Math.min(30, Math.round((now - last) / 1000))
      last = now
      if (document.visibilityState === 'visible' && active) addVoiceSeconds(d)
    }, 15000)
    return () => clearInterval(t)
  }, [active])
  useEffect(() => () => stopTts(), [])
  useEffect(() => {
    if (step !== 'done' || reducedMotion || !done.current) return
    const ctx = gsap.context(() => {
      gsap.from('.fire', { scale: 0, rotate: -30, duration: .9, ease: 'elastic.out(1, .5)' })
      gsap.from('.done-n', { y: 20, opacity: 0, duration: .6, delay: .3 })
    }, done)
    return () => ctx.revert()
  }, [step])

  const warm = useMemo(() => {
    if (!lesson) return []
    const d = duePron(getState()).slice(0, 2).map(w => ({ en: w.ex || w.w, it: w.it || '', tip: `Parola da ripassare: «${w.w}».` }))
    return [...d, ...lesson.speaking.shadowing.slice(0, 5 - d.length).map(en => ({ en }))]
  }, [lesson])
  const cfg = useMemo(() => lesson ? lessonTalk(lesson, { kind: 'daily', maxTurns: 3 }) : null, [lesson])
  const pct = Math.min(100, Math.round((day.seconds / DAILY_SECONDS) * 100))

  if (!lesson || !cfg) return <div className="loading">Preparo l'allenamento…</div>
  return (
    <div ref={ref}>
      <div className="row mb" data-anim><Back /><span className="spacer" /><span className="small muted">{Math.floor(day.seconds / 60)} di 10 min oggi</span></div>
      <div data-anim>
        <div className="eyebrow">Allenamento di oggi · 10 minuti</div>
        <h1>Parla ogni giorno</h1>
        <div className="progress" aria-label={`${pct}% dei 10 minuti`}><span style={{ width: pct + '%' }} /></div>
        <ol className="daily-steps">
          <li className={step === 'warm' ? 'on' : 'past'}>1 · Pronuncia (3 min)</li>
          <li className={step === 'talk' ? 'on' : step === 'done' ? 'past' : ''}>2 · Dialogo a voce (5 min)</li>
          <li className={step === 'done' ? 'on' : ''}>3 · Pagellino e serie</li>
        </ol>
      </div>
      {step === 'warm' && (
        <section className="card" data-anim>
          <h2>Riscaldamento: 5 frasi</h2>
          <p className="small muted">Dalla lezione {lesson.id} ({lesson.title}){warm.length && duePron(getState()).length ? ' e dal ripasso di pronuncia' : ''}.</p>
          <PronDrill items={warm} onDone={() => {}} compact />
          <div className="row mt"><span className="spacer" /><button className="btn primary" onClick={() => { stopTts(); setStep('talk') }}>Avanti: il dialogo →</button></div>
        </section>
      )}
      {step === 'talk' && (
        <div data-anim>
          <Conversation cfg={cfg} onActive={setActive} onFinish={() => { markDailyDone() }} />
          <div className="row mt"><span className="spacer" /><button className="btn primary" onClick={() => setStep('done')}>Chiudi l'allenamento →</button></div>
        </div>
      )}
      {step === 'done' && (
        <section className="card center" ref={done}>
          <div className="fire" aria-hidden="true">🔥</div>
          {day.done ? <>
            <h2 className="done-n">{voiceStreak(st)} {voiceStreak(st) === 1 ? 'giorno' : 'giorni'} di fila</h2>
            <p className="muted">Allenamento di oggi fatto. Domani altri 10 minuti per non interrompere la serie.</p>
          </> : <>
            <h2 className="done-n">Quasi fatto</h2>
            <p className="muted">Per contare il giorno nella serie serve finire il dialogo a voce.</p>
            <button className="btn" onClick={() => setStep('talk')}>Torna al dialogo</button>
          </>}
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <a className="btn primary" href="#/">Torna a Oggi</a>
            <a className="btn" href="#/parla">Altro da allenare</a>
          </div>
        </section>
      )}
    </div>
  )
}
