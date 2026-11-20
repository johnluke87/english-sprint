import { useEffect, useState } from 'react'
import { loadSyllabus, loadLesson } from './content.js'
import { STEPS } from './store.js'

let available = null
async function loadAvailable() {
  if (!available) available = fetch('content/lessons/index.json', { cache: 'no-cache' }).then(r => r.json()).then(d => new Set(d.lessons)).catch(() => new Set())
  return available
}

export function useSyllabus() {
  const [data, setData] = useState(null)
  useEffect(() => {
    let on = true
    Promise.all([loadSyllabus(), loadAvailable()]).then(([s, a]) => on && setData({ ...s, available: a }))
    return () => { on = false }
  }, [])
  return data
}

export function useLesson(id) {
  const [state, setState] = useState({ lesson: null, error: null })
  useEffect(() => {
    let on = true
    setState({ lesson: null, error: null })
    loadLesson(id).then(l => on && setState({ lesson: l, error: null })).catch(e => on && setState({ lesson: null, error: e.message }))
    return () => { on = false }
  }, [id])
  return state
}

export function lessonProgress(st, id) {
  const L = st.lessons[id]
  if (!L) return 0
  return Math.round((STEPS.filter(k => L.steps[k]).length / STEPS.length) * 100)
}

// Prossima lezione da fare: la prima non finita dal punto di partenza scelto (poi, finite quelle, le precedenti)
export function nextLesson(st, syllabus) {
  if (!syllabus) return null
  const start = Number(st.settings?.startLesson) || 1
  const open = l => syllabus.available.has(l.id) && !st.lessons[l.id]?.completedAt
  return syllabus.lessons.find(l => l.id >= start && open(l)) || syllabus.lessons.find(open) || null
}

// Punti di partenza proposti nella presentazione e nelle Opzioni
export const STARTS = [
  { id: 1, t: 'Parto dalle basi', d: "Ricordo l'inglese della scuola, ma poco: presentarsi, numeri, mail semplici.", lvl: 'A2' },
  { id: 21, t: 'Me la cavo', d: 'Scrivo mail semplici, ma in riunione e al telefono faccio fatica.', lvl: 'B1' },
  { id: 41, t: 'Voglio suonare naturale', d: "Uso già l'inglese al lavoro e voglio più scioltezza, stile e sicurezza.", lvl: 'B1+ / B2' },
]

export const STEP_INFO = {
  video: { label: 'Video-lezione', min: 8, ico: '🎬' },
  words: { label: '50 parole', min: 15, ico: '🔤' },
  grammar: { label: 'Grammatica', min: 10, ico: '📐' },
  phrases: { label: 'Espressioni', min: 7, ico: '💬' },
  dialogue: { label: 'Dialogo e ascolto', min: 6, ico: '🎧' },
  translate: { label: 'Traduzioni', min: 6, ico: '🔁' },
  writing: { label: 'Scrittura', min: 5, ico: '✍️' },
  speaking: { label: 'Parlato', min: 8, ico: '🎙️' },
}
