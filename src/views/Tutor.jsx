import { useEffect, useRef, useState } from 'react'
import { ai } from '../lib/api.js'
import { speak, stop } from '../lib/speech.js'
import { loadLesson } from '../lib/content.js'
import { Say } from '../components/Speak.jsx'
import Mic from '../components/Mic.jsx'
import { addXp, useStore, aiQuota } from '../lib/store.js'

const SCENARIOS = [
  { t: 'Chiacchierata sul lavoro', d: 'Un collega straniero ti chiede del tuo lavoro.', s: 'You are Emma, a friendly project manager from London who just joined the team. Ask the student about their job, their projects and their day.' },
  { t: 'Call con un cliente', d: 'Il cliente vuole aggiornamenti sul suo sito.', s: 'You are Mr Thompson, a British client whose company website is being rebuilt by the student. You want a status update, dates and costs. Be polite but demanding.' },
  { t: 'Presentare un progetto', d: 'Spieghi a una responsabile i risultati del lavoro.', s: 'You are Ms Rivera, head of operations at a US company. The student has just finished a project or an analysis for your company. Ask about the main results, problems found, priorities, costs and timeline.' },
  { t: 'Riunione di progetto', d: 'Stand-up con il team internazionale.', s: 'You are Raj, the team lead running a short daily stand-up meeting in English. Ask what the student did yesterday, what they will do today and if anything is blocking them.' },
  { t: 'Trattativa sul preventivo', d: 'Il cliente trova il prezzo troppo alto.', s: 'You are Ms Becker, a German client negotiating in English. You think the quote is too expensive and want a discount or a shorter timeline. Push back politely.' },
  { t: 'Colloquio di lavoro', d: 'Un recruiter ti fa le domande classiche.', s: 'You are a recruiter interviewing the student for a job at an international company. First ask which role they are applying for, then ask typical interview questions one at a time.' },
  { t: 'Assistenza clienti', d: 'Un cliente segnala un problema con un ordine.', s: 'You are a frustrated customer: the order you placed two weeks ago has not arrived and the online tracking does not work. The student works in customer service: they must understand the problem and help you.' },
  { t: 'Small talk a un evento', d: 'Networking alla pausa caffè di una fiera.', s: 'You are Chloe, a marketing manager you meet at the coffee break of an international trade fair in Berlin. Make small talk: travel, the fair, work, hobbies.' },
]

export default function Tutor({ lessonId }) {
  const [sc, setSc] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [voice, setVoice] = useState(true)
  const [showTr, setShowTr] = useState(false)
  const [lessonSc, setLessonSc] = useState(null)
  const end = useRef(null)
  const quota = useStore(() => aiQuota)

  useEffect(() => {
    if (!lessonId) return
    loadLesson(lessonId).then(l => setLessonSc({
      t: `Lezione ${l.id}: ${l.title}`, d: 'Conversazione sul tema della lezione, usando le sue parole.',
      s: `A realistic work conversation about "${l.titleEn}". Context: ${l.dialogue.context} Encourage the student to use these words and phrases: ${l.words.slice(0, 20).map(w => w.en).join(', ')}; ${l.phrases.slice(0, 8).map(p => p.en).join(' | ')}`,
    })).catch(() => {})
  }, [lessonId])
  useEffect(() => () => stop(), [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy])

  async function send(content, scenario = sc, history = msgs) {
    setErr('')
    const userMsg = content != null ? [{ role: 'user', content }] : []
    const h = [...history, ...userMsg]
    setMsgs(h); setText(''); setBusy(true)
    try {
      const r = await ai('chat', { scenario: scenario.s, messages: h.map(m => ({ role: m.role, content: m.content })) })
      const withCorr = userMsg.length && r.correction ? h.map((m, i) => i === h.length - 1 ? { ...m, correction: r.correction } : m) : h
      setMsgs([...withCorr, { role: 'assistant', content: r.reply, it: r.replyIt, suggestion: r.suggestion }])
      if (content != null) addXp(3)
      if (voice && r.reply) speak(r.reply)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  if (!sc) {
    return (
      <div>
        <div className="eyebrow">Conversazione con l'AI</div>
        <h1>Tutor AI</h1>
        <p className="muted">Scegli una situazione. Il tutor parla in inglese (a voce), tu rispondi con il microfono o scrivendo. Se sbagli, ti corregge con una spiegazione in italiano. Fai almeno 10 minuti al giorno: è l'allenamento che fa la differenza.</p>
        {quota && <p className="small muted">Ogni risposta del tutor usa una delle correzioni AI gratuite di oggi: {Math.max(0, quota.max - quota.used)} rimaste su {quota.max}.</p>}
        <div className="scenarios mt">
          {[lessonSc, ...SCENARIOS].filter(Boolean).map((s, i) => (
            <button key={i} className="scenario" onClick={() => { setSc(s); setMsgs([]); send(null, s, []) }} style={i === 0 && lessonSc ? { borderColor: 'var(--accent)' } : undefined}>
              <b>{s.t}</b><span className="small muted">{s.d}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const last = msgs[msgs.length - 1]
  return (
    <div>
      <div className="row mb">
        <button className="btn small" onClick={() => { stop(); setSc(null); setMsgs([]) }}>← Situazioni</button>
        <h2 style={{ margin: 0 }}>{sc.t}</h2><span className="spacer" />
        <label className="row small" style={{ gap: 6, fontWeight: 500 }}><input type="checkbox" checked={voice} onChange={e => { setVoice(e.target.checked); if (!e.target.checked) stop() }} /> Voce</label>
        <label className="row small" style={{ gap: 6, fontWeight: 500 }}><input type="checkbox" checked={showTr} onChange={e => setShowTr(e.target.checked)} /> Traduzione</label>
      </div>
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <div className={'msg ' + m.role} lang="en">
              {m.role === 'assistant' && <span style={{ float: 'right', marginLeft: 8 }}><Say text={m.content} small /></span>}
              {m.content}
              {m.role === 'assistant' && showTr && m.it && <div className="tr" lang="it">{m.it}</div>}
            </div>
            {m.correction && <div className="corr">✏️ <s lang="en">{m.correction.wrong}</s> → <b lang="en">{m.correction.right}</b><br /><span className="small">{m.correction.whyIt}</span></div>}
          </div>
        ))}
        {busy && <div className="msg assistant muted">…</div>}
        {err && <div className="error">{err} <button className="btn small" onClick={() => send(null, sc, msgs)}>Riprova</button></div>}
        <div ref={end} />
      </div>
      {last?.suggestion && !busy && (
        <p className="small muted mt">💡 Potresti dire: <button className="btn ghost small" lang="en" onClick={() => setText(last.suggestion)}>{last.suggestion}</button></p>
      )}
      <div className="chat-input">
        <Mic continuous label="Parla" onResult={t => { if (t) send(t) }} />
        <form className="row spacer" style={{ flexWrap: 'nowrap' }} onSubmit={e => { e.preventDefault(); if (text.trim()) send(text.trim()) }}>
          <label htmlFor="chat-t" className="sr-only">Scrivi in inglese</label>
          <textarea id="chat-t" lang="en" value={text} onChange={e => setText(e.target.value)} placeholder="…oppure scrivi in inglese"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) send(text.trim()) } }} />
          <button className="btn primary" disabled={busy || !text.trim()}>Invia</button>
        </form>
      </div>
    </div>
  )
}
