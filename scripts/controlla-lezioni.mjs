// Controlla i file delle lezioni in public/content/lessons (formato in FORMATO-LEZIONE.md).
// Uso: node scripts/controlla-lezioni.mjs [L01 L02 ...]   (senza argomenti: tutte)
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const dir = new URL('../public/content/lessons/', import.meta.url)
const syllabus = JSON.parse(readFileSync(new URL('../public/content/syllabus.json', import.meta.url), 'utf8'))
const only = process.argv.slice(2).map(s => s.replace(/\.json$/, ''))
const files = (existsSync(dir) ? readdirSync(dir) : []).filter(f => /^L\d\d\.json$/.test(f))
  .filter(f => !only.length || only.includes(f.replace('.json', '')))
  .sort()

let errors = 0
const seen = new Map() // parola -> lezione
const err = (f, m) => { errors++; console.log(`✗ ${f}: ${m}`) }
const str = v => typeof v === 'string' && v.trim().length > 0
const BAD = /[*#<>`]|\p{Extended_Pictographic}/u

for (const f of files) {
  let L
  try { L = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) } catch (e) { err(f, 'JSON non valido: ' + e.message); continue }
  const id = Number(f.slice(1, 3))
  const s = syllabus.lessons.find(x => x.id === id)
  if (L.id !== id) err(f, `id ${L.id} ≠ ${id}`)
  if (s && L.week !== s.week) err(f, `week ${L.week} ≠ ${s.week}`)
  for (const k of ['title', 'titleEn', 'intro']) if (!str(L[k])) err(f, `manca ${k}`)
  if (!Array.isArray(L.goals) || L.goals.length < 3) err(f, 'goals: almeno 3')

  const W = L.words || []
  if (W.length !== 50) err(f, `words: ${W.length} invece di 50`)
  const local = new Set()
  W.forEach((w, i) => {
    for (const k of ['en', 'pron', 'it', 'type', 'ex', 'exIt']) if (!str(w[k])) err(f, `words[${i}] (${w.en}) manca ${k}`)
    if (!['verb', 'noun', 'adj', 'adv', 'phrase', 'prep', 'conj'].includes(w.type)) err(f, `words[${i}] type "${w.type}"`)
    const key = String(w.en || '').toLowerCase().trim()
    if (local.has(key)) err(f, `parola doppia nella lezione: ${w.en}`)
    local.add(key)
    if (seen.has(key) && ![10, 40, 59, 60].includes(id)) console.log(`  ! ${f}: "${w.en}" già in ${seen.get(key)}`)
    else if (!seen.has(key)) seen.set(key, f)
  })

  const G = L.grammar || {}
  if (!str(G.title)) err(f, 'grammar.title')
  for (const k of ['explainIt', 'explainEn']) if (!Array.isArray(G[k]) || G[k].length < 3) err(f, `grammar.${k}: almeno 3 paragrafi`)
  if (!Array.isArray(G.rules) || G.rules.length < 3) err(f, 'grammar.rules: almeno 3')
  ;(G.rules || []).forEach((r, i) => { if (!str(r.it) || !str(r.en) || !Array.isArray(r.examples) || r.examples.length < 2) err(f, `grammar.rules[${i}] incompleta`) })
  if (!str(G.tip)) err(f, 'grammar.tip')
  if (!Array.isArray(G.mistakes) || G.mistakes.length < 3) err(f, 'grammar.mistakes: almeno 3')

  const GE = L.grammarExercises || []
  if (GE.length !== 12) err(f, `grammarExercises: ${GE.length} invece di 12`)
  GE.forEach((e, i) => { if (!str(e.q) || !e.q.includes('___') || !Array.isArray(e.a) || !e.a.length) err(f, `grammarExercises[${i}] non valido`) })

  const P = L.phrases || []
  if (P.length !== 25) err(f, `phrases: ${P.length} invece di 25`)
  P.forEach((p, i) => { if (!str(p.group) || !str(p.en) || !str(p.it)) err(f, `phrases[${i}] incompleta`) })

  const D = L.dialogue || {}
  if (!str(D.title) || !str(D.context) || !Array.isArray(D.lines) || D.lines.length < 12) err(f, 'dialogue: servono titolo, contesto e 12+ battute')
  ;(D.lines || []).forEach((l, i) => { if (!['A', 'B', 'C'].includes(l.s) || !str(l.name) || !str(l.en) || !str(l.it)) err(f, `dialogue.lines[${i}] incompleta`) })

  const LI = L.listening || []
  if (LI.length !== 4) err(f, `listening: ${LI.length} invece di 4`)
  LI.forEach((q, i) => { if (!str(q.q) || !Array.isArray(q.options) || q.options.length !== 3 || ![0, 1, 2].includes(q.answer)) err(f, `listening[${i}] non valida`) })

  const T = L.translations || []
  if (T.length !== 12) err(f, `translations: ${T.length} invece di 12`)
  T.forEach((t, i) => { if (!str(t.it) || !str(t.en)) err(f, `translations[${i}] incompleta`) })

  const WR = L.writing || {}
  if (!str(WR.taskIt) || !str(WR.taskEn) || !str(WR.model)) err(f, 'writing incompleto')

  const SP = L.speaking || {}
  if (!Array.isArray(SP.shadowing) || SP.shadowing.length < 8) err(f, 'speaking.shadowing: 8 frasi')
  if (!Array.isArray(SP.prompts) || SP.prompts.length < 5) err(f, 'speaking.prompts: 5 domande')

  const V = L.video || []
  if (V.length < 7 || V.length > 10) err(f, `video: ${V.length} scene (servono 7-10)`)
  V.forEach((sc, i) => {
    if (!str(sc.title) || !Array.isArray(sc.show) || !Array.isArray(sc.say) || !sc.say.length) err(f, `video[${i}] incompleta`)
    ;(sc.say || []).forEach(x => {
      if (!['it', 'en'].includes(x.lang) || !str(x.text)) err(f, `video[${i}].say non valido`)
      else if (BAD.test(x.text)) err(f, `video[${i}].say contiene simboli/emoji: ${x.text.slice(0, 40)}`)
    })
  })
}

console.log(`\n${files.length} lezioni controllate, ${errors} errori.`)
process.exit(errors ? 1 : 0)
