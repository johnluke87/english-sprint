// Progressi dello studente: sempre nel browser (localStorage). Chi ha l'account del portale /apps/ li ritrova
// anche sul server (api/progress), così telefono e PC restano allineati: le due copie si UNISCONO (niente si perde).
import { useSyncExternalStore } from 'react'
import { api, hooks } from './api.js'

const KEY = 'english-sprint-v1'
export const STEPS = ['video', 'words', 'grammar', 'phrases', 'dialogue', 'translate', 'writing', 'speaking']

function empty() {
  return {
    version: 1,
    updatedAt: 0,
    startedAt: today(),
    welcome: false, // true dopo la pagina di presentazione (scelta del punto di partenza)
    lessons: {},   // "1": { steps: {words: true}, scores: {words: 85}, completedAt }
    srs: {},       // "1:12": { due, interval, ease, reps, lapses, last }
    days: {},      // "2026-11-16": { seconds, reviews, xp }
    settings: { rate: 1, voiceEn: '', voiceEn2: '', voiceIt: '', showPron: true, dailyGoal: 60, startLesson: 1 },
    writings: {},  // "1": { text, feedback, at }
  }
}

export function today(d = new Date()) {
  const z = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

function normalize(data) {
  const e = empty()
  const st = { ...e, ...data, settings: { ...e.settings, ...(data && data.settings) } }
  // chi aveva già iniziato prima della pagina di presentazione non la rivede
  if (!st.welcome && (Object.keys(st.lessons).length || Object.keys(st.srs).length)) st.welcome = true
  return st
}

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch (e) { /* storage non disponibile */ }
  return empty()
}

// Unione di due copie dei progressi: tiene il meglio di entrambe (lezioni, parole, giorni di studio, scritti)
export function mergeStates(a, b) {
  if (!b) return a
  if (!a) return b
  const newer = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b
  const older = newer === a ? b : a
  const out = structuredClone(newer)
  out.startedAt = [a.startedAt, b.startedAt].filter(Boolean).sort()[0] || today()
  out.welcome = !!(a.welcome || b.welcome)
  for (const [id, L] of Object.entries(older.lessons || {})) {
    const M = out.lessons[id]
    if (!M) { out.lessons[id] = structuredClone(L); continue }
    M.steps = { ...(L.steps || {}), ...(M.steps || {}) }
    for (const k of Object.keys(M.steps)) M.steps[k] = !!(M.steps[k] || L.steps?.[k])
    M.scores = M.scores || {}
    for (const [k, v] of Object.entries(L.scores || {})) M.scores[k] = Math.max(M.scores[k] || 0, v || 0)
    const done = [M.completedAt, L.completedAt].filter(Boolean).sort()[0]
    if (done) M.completedAt = done
  }
  for (const [k, c] of Object.entries(older.srs || {})) {
    const m = out.srs[k]
    if (!m) { out.srs[k] = structuredClone(c); continue }
    const lm = m.last || '', lc = c.last || ''
    if (lc > lm || (lc === lm && (c.reps || 0) + (c.lapses || 0) > (m.reps || 0) + (m.lapses || 0))) out.srs[k] = structuredClone(c)
  }
  for (const [d, v] of Object.entries(older.days || {})) {
    const m = out.days[d]
    if (!m) { out.days[d] = { ...v }; continue }
    for (const f of ['seconds', 'reviews', 'xp']) m[f] = Math.max(m[f] || 0, v[f] || 0)
  }
  for (const [id, w] of Object.entries(older.writings || {})) {
    if (!out.writings[id] || (w.at || 0) > (out.writings[id].at || 0)) out.writings[id] = structuredClone(w)
  }
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0)
  return out
}

let state = read()
const subs = new Set()
let syncTimer = null
export let syncStatus = 'idle' // idle | saving | saved | offline (solo con l'account)
// account: 'unknown' finché non risponde il server; 'guest' = progressi solo nel browser; 'logged' = anche sul server
export let account = 'unknown'
export let aiQuota = null // { used, max } delle correzioni AI di oggi

function emit() { subs.forEach(f => f()) }

function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { /* pieno o bloccato */ }
}

function persist(push = true) {
  saveLocal()
  emit()
  if (push && account === 'logged') {
    clearTimeout(syncTimer)
    syncTimer = setTimeout(pushNow, 2500)
  }
}

async function pushNow() {
  if (account !== 'logged') return
  syncStatus = 'saving'; emit()
  try {
    await api('progress', { method: 'POST', body: state })
    syncStatus = 'saved'
  } catch (e) {
    syncStatus = 'offline'
  }
  emit()
}

// Chi sono? (account del portale o no) e quante correzioni AI restano oggi
export async function initAccount() {
  try {
    const r = await api('session')
    account = r && r.logged ? 'logged' : 'guest'
    aiQuota = (r && r.ai) || null
  } catch (e) {
    if (account === 'unknown') account = 'guest'
  }
  emit()
  if (account === 'logged') await pullFromServer()
}

// correzioni AI rimaste oggi (Infinity se non si sa ancora)
export function aiLeft() { return aiQuota ? Math.max(0, aiQuota.max - aiQuota.used) : Infinity }

// dopo ogni correzione AI: una in meno per oggi (o finite, se il server dice che il tetto è raggiunto)
hooks.onAi = (ok, limit) => {
  if (!aiQuota) return
  if (ok) aiQuota = { ...aiQuota, used: aiQuota.used + 1 }
  else if (limit === 'day') aiQuota = { ...aiQuota, used: aiQuota.max }
  else return
  emit()
}

export async function pullFromServer() {
  if (account !== 'logged') return
  try {
    const res = await api('progress')
    const server = res && res.data ? normalize(res.data) : null
    const merged = mergeStates(state, server)
    const same = server && JSON.stringify(merged) === JSON.stringify(server)
    state = merged
    persist(false)
    if (!same) await pushNow()
    syncStatus = 'saved'
  } catch (e) {
    syncStatus = 'offline'
  }
  emit()
}

export function update(fn) {
  const next = structuredClone(state)
  fn(next)
  next.updatedAt = Date.now()
  state = next
  persist()
}

export function getState() { return state }
export function useStore(sel = s => s) {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb) }, () => sel(state))
}

// ---- Tempo di studio: chiamato ogni 15 secondi mentre la pagina è visibile ----
let lastTick = Date.now()
export function tickStudyTime() {
  const now = Date.now()
  const delta = Math.min(30, Math.round((now - lastTick) / 1000))
  lastTick = now
  if (document.visibilityState !== 'visible' || delta <= 0) return
  const d = today()
  const day = state.days[d] || { seconds: 0, reviews: 0, xp: 0 }
  // oggetto nuovo (non modificato sul posto), così la pagina si aggiorna: anello dei minuti, giorni di fila
  state = { ...state, days: { ...state.days, [d]: { ...day, seconds: day.seconds + delta } }, updatedAt: Date.now() }
  saveLocal()
  emit()
}
export function resetTick() { lastTick = Date.now() }

export function addXp(n) {
  update(s => {
    const d = today()
    s.days[d] = s.days[d] || { seconds: 0, reviews: 0, xp: 0 }
    s.days[d].xp += n
  })
}

export function markStep(lessonId, step, score) {
  update(s => {
    const L = (s.lessons[lessonId] = s.lessons[lessonId] || { steps: {}, scores: {} })
    L.steps[step] = true
    if (score != null) L.scores[step] = Math.max(L.scores[step] || 0, score)
    if (STEPS.every(k => L.steps[k]) && !L.completedAt) L.completedAt = today()
    const d = today()
    s.days[d] = s.days[d] || { seconds: 0, reviews: 0, xp: 0 }
    s.days[d].xp += 20
  })
}

export function streak(st = state) {
  let n = 0
  const d = new Date()
  // oggi conta se c'è già studio, altrimenti si parte da ieri
  if (!(st.days[today(d)]?.seconds >= 300)) d.setDate(d.getDate() - 1)
  while (st.days[today(d)]?.seconds >= 300) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export function exportJson() { return JSON.stringify(state, null, 1) }
export function importJson(text) {
  const data = JSON.parse(text)
  if (!data || data.version !== 1) throw new Error('File non valido')
  // la copia caricata si unisce a quella del browser: non si perde niente
  state = mergeStates(state, normalize(data))
  state.updatedAt = Date.now()
  persist()
}
