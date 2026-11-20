// Contenuti del corso: syllabus e lezioni (file JSON statici in content/, caricati quando servono)
const cache = new Map()

export async function loadSyllabus() {
  if (!cache.has('syllabus')) cache.set('syllabus', fetch('content/syllabus.json').then(r => r.json()))
  return cache.get('syllabus')
}

export function lessonFile(id) { return `content/lessons/L${String(id).padStart(2, '0')}.json` }

export async function loadLesson(id) {
  const k = 'L' + id
  if (!cache.has(k)) {
    cache.set(k, fetch(lessonFile(id)).then(r => {
      if (!r.ok) throw new Error('Lezione non ancora disponibile')
      return r.json()
    }).catch(e => { cache.delete(k); throw e }))
  }
  return cache.get(k)
}

// Carica più lezioni (per il ripasso): quelle che mancano vengono saltate
export async function loadLessons(ids) {
  const out = {}
  await Promise.all(ids.map(async id => { try { out[id] = await loadLesson(id) } catch (e) { /* manca */ } }))
  return out
}
