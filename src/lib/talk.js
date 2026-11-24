// Dialoghi a voce (VOCE.md): misure fatte nel browser (senza AI), pagellino, salvataggio in state.voice.
import { normalize } from './check.js'
import { update, today, getState } from './store.js'
import { addPronWords } from './pron.js'
import { ai } from './api.js'

// Misure locali sulle risposte dello studente: [{ content, ms }]
export function localMetrics(userTurns, targets = []) {
  const texts = userTurns.map(t => normalize(t.content))
  const all = texts.join(' ').split(' ').filter(Boolean)
  const words = all.length
  const spokenMs = userTurns.reduce((a, t) => a + (t.ms || 0), 0)
  const spokenTurns = userTurns.filter(t => t.ms)
  const spokenWords = spokenTurns.reduce((a, t) => a + normalize(t.content).split(' ').filter(Boolean).length, 0)
  const wpm = spokenTurns.length && spokenMs > 3000 ? Math.round(spokenWords / (spokenMs / 60000)) : null
  const avg = userTurns.length ? Math.round(words / userTurns.length) : 0
  const distinct = new Set(all.filter(w => w.length > 2)).size
  const variety = words ? distinct / Math.max(1, all.filter(w => w.length > 2).length) : 0
  const joined = ' ' + texts.join(' ') + ' '
  // parole/frasi della lezione o della simulazione usate (per le frasi basta il "cuore": le prime 3 parole senza i puntini)
  const used = []
  for (const t of targets) {
    const n = normalize(String(t).replace(/…|\.\.\./g, ' ')).replace(/^to /, '')
    if (!n) continue
    const core = n.split(' ').slice(0, Math.min(4, n.split(' ').length)).join(' ')
    if (core.length > 2 && joined.includes(' ' + core + ' ')) used.push(t)
  }
  return { words, wpm, avg, variety: Math.round(variety * 100), used, turns: userTurns.length }
}

const clamp = (n, a = 1, b = 10) => Math.max(a, Math.min(b, Math.round(n)))

// Punteggi senza AI: fluidità (velocità e lunghezza delle risposte) e vocabolario (varietà e parole usate)
export function localScores(m) {
  const lenPart = Math.min(1, m.avg / 18) // 18 parole a risposta = pieno
  const speedPart = m.wpm == null ? lenPart : Math.min(1, m.wpm / 110)
  const fluency = clamp(1 + 9 * (0.6 * lenPart + 0.4 * speedPart))
  const vocabulary = clamp(1 + 9 * (0.6 * Math.min(1, m.variety / 75) + 0.4 * Math.min(1, m.used.length / 3)) * Math.min(1, m.words / 40))
  return { fluency, vocabulary }
}

export function metricsText(m) {
  return `${m.turns} answers, ${m.words} words in total, about ${m.avg} words per answer` + (m.wpm ? `, speaking speed about ${m.wpm} words per minute` : '') + (m.used.length ? `, used target phrases: ${m.used.slice(0, 6).join('; ')}` : '')
}

// Pagellino finale: quello dell'AI se c'è, altrimenti quello locale (grammatica non valutata)
export function buildReport({ aiRep, metrics, collected }) {
  const loc = localScores(metrics)
  if (aiRep && aiRep.scores) {
    const s = aiRep.scores
    const scores = { fluency: clamp(s.fluency || loc.fluency), vocabulary: clamp(s.vocabulary || loc.vocabulary), grammar: clamp(s.grammar || 5), task: clamp(s.task || 5) }
    const total = Number.isFinite(aiRep.total) ? Math.max(0, Math.min(100, Math.round(aiRep.total))) : Math.round((scores.fluency + scores.vocabulary + scores.grammar + scores.task) * 2.5)
    const errs = (aiRep.errors?.length ? aiRep.errors : collected).slice(0, 8)
    return { ai: true, scores, total, summaryIt: aiRep.summaryIt || '', strengthsIt: aiRep.strengthsIt || [], improveIt: aiRep.improveIt || [], errors: errs, phrases: aiRep.phrases || [], reviewWords: aiRep.reviewWords || [], better: aiRep.better || null, metrics }
  }
  const scores = { fluency: loc.fluency, vocabulary: loc.vocabulary, grammar: null, task: null }
  const total = Math.round((loc.fluency + loc.vocabulary) * 5)
  return {
    ai: false, scores, total, metrics, errors: collected.slice(0, 8), phrases: [], reviewWords: [], better: null, strengthsIt: [], improveIt: [],
    summaryIt: 'Pagellino senza AI: fluidità e vocabolario misurati dall\'app. La grammatica e le frasi migliori arrivano con la correzione completa, che si può chiedere quando tornano le risposte AI.',
  }
}

// Pagellino dell'AI (1 chiamata). Lancia l'errore se non si può.
export async function requestReport({ scenario, goal, level, messages, metrics }, opts) {
  return ai('report', {
    scenario, goal, level, metrics: metricsText(metrics),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  }, opts)
}

// Correzione completa di un dialogo rimasto in attesa: sostituisce il pagellino locale con quello dell'AI
export async function correctPending(p) {
  const aiRep = await requestReport(p)
  const rep = buildReport({ aiRep, metrics: p.metrics, collected: [] })
  const old = (getState().voice.sessions || []).find(x => x.id === p.id) || {}
  saveSession({ ...old, ...rep, id: p.id, at: old.at || p.at, day: old.day || p.day, kind: p.kind, ref: p.ref, title: p.title, level: p.level, transcript: p.messages.map(m => [m.role === 'assistant' ? 'a' : 'u', m.content]) })
  return rep
}

// Salva il pagellino (e mette le parole da ripassare nel ripasso di pronuncia)
export function saveSession(sess) {
  update(s => {
    const v = s.voice
    const i = v.sessions.findIndex(x => x.id === sess.id)
    if (i >= 0) v.sessions[i] = sess; else v.sessions.push(sess)
    v.sessions = v.sessions.slice(-80)
    if (sess.ai) v.pending = v.pending.filter(p => p.id !== sess.id)
    const d = today()
    s.days[d] = s.days[d] || { seconds: 0, reviews: 0, xp: 0 }
    if (i < 0) s.days[d].xp += 10 + Math.round((sess.total || 0) / 10)
  })
  if (sess.reviewWords?.length) addPronWords(sess.reviewWords)
}

// Dialogo finito senza AI: resta in attesa della correzione completa (max 5)
export function savePending(p) {
  update(s => {
    s.voice.pending = [...s.voice.pending.filter(x => x.id !== p.id), p].slice(-5)
  })
}

export function sessionsFor(ref, st = getState()) {
  return (st.voice?.sessions || []).filter(x => x.ref === ref)
}

// ---- allenamento quotidiano a voce (10 minuti) ----
export const DAILY_SECONDS = 600
export function addVoiceSeconds(sec) {
  if (sec <= 0) return
  update(s => {
    const d = today()
    const v = s.voice.days[d] || { seconds: 0, done: false }
    v.seconds = Math.min(3 * 3600, (v.seconds || 0) + sec)
    s.voice.days[d] = v
  })
}
export function markDailyDone() {
  update(s => {
    const d = today()
    const v = s.voice.days[d] || { seconds: 0, done: false }
    if (!v.done) {
      v.done = true
      s.days[d] = s.days[d] || { seconds: 0, reviews: 0, xp: 0 }
      s.days[d].xp += 30
    }
    s.voice.days[d] = v
  })
}
// giorni di fila con l'allenamento a voce fatto (oggi conta se è già fatto, altrimenti si parte da ieri)
export function voiceStreak(st = getState()) {
  const days = st.voice?.days || {}
  let n = 0
  const d = new Date()
  if (!days[today(d)]?.done) d.setDate(d.getDate() - 1)
  while (days[today(d)]?.done) { n++; d.setDate(d.getDate() - 1) }
  return n
}
export function bestVoiceStreak(st = getState()) {
  const ds = Object.keys(st.voice?.days || {}).filter(k => st.voice.days[k].done).sort()
  let best = 0, cur = 0, prev = null
  for (const k of ds) {
    const t = new Date(k + 'T12:00:00')
    cur = prev && Math.round((t - prev) / 86400000) === 1 ? cur + 1 : 1
    best = Math.max(best, cur); prev = t
  }
  return best
}
