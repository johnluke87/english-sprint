// Ripetizione dilazionata (SM-2 semplificato): ogni parola studiata torna quando stai per dimenticarla.
import { update, today, getState } from './store.js'

function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return today(d)
}

// Aggiunge le parole di una lezione al ripasso (se non ci sono già): tornano domani
export function addLessonCards(lessonId, count) {
  update(s => {
    for (let i = 0; i < count; i++) {
      const k = `${lessonId}:${i}`
      if (!s.srs[k]) s.srs[k] = { due: addDays(1), interval: 0, ease: 2.5, reps: 0, lapses: 0 }
    }
  })
}

// grade: 0 = non la sapevo, 1 = difficile, 2 = bene, 3 = facile
export function grade(key, g) {
  update(s => {
    const c = s.srs[key] || { interval: 0, ease: 2.5, reps: 0, lapses: 0 }
    if (g === 0) {
      c.reps = 0; c.lapses++; c.interval = 0
      c.ease = Math.max(1.3, c.ease - 0.2)
      c.due = today() // torna oggi stesso
    } else {
      if (c.reps === 0) c.interval = g === 3 ? 4 : g === 2 ? 1 : 1
      else if (c.reps === 1) c.interval = g === 3 ? 7 : g === 2 ? 3 : 2
      else c.interval = Math.round(c.interval * (g === 1 ? 1.2 : g === 3 ? c.ease * 1.3 : c.ease))
      c.ease = Math.max(1.3, c.ease + (g === 1 ? -0.15 : g === 3 ? 0.15 : 0))
      c.reps++
      c.due = addDays(c.interval)
    }
    c.last = today()
    s.srs[key] = c
    const d = today()
    s.days[d] = s.days[d] || { seconds: 0, reviews: 0, xp: 0 }
    s.days[d].reviews++
    s.days[d].xp += 2
  })
}

export function dueKeys(st = getState()) {
  const t = today()
  return Object.entries(st.srs).filter(([, c]) => c.due <= t).map(([k]) => k)
}

// Parole "imparate": viste almeno 2 volte con successo e intervallo ≥ 3 giorni
export function learnedCount(st = getState()) {
  return Object.values(st.srs).filter(c => c.interval >= 3).length
}
