// Pronuncia senza AI: confronto parola per parola tra la frase attesa e quello che ha capito il riconoscimento vocale.
// Le parole sbagliate entrano in un ripasso a intervalli (state.voice.pron): tornano dopo 1, 3, 7, 15, 30 giorni se le dici bene.
import { normalize, levenshtein } from './check.js'
import { update, today, getState } from './store.js'

const NUM = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 15: 'fifteen', 20: 'twenty', 30: 'thirty', 50: 'fifty', 100: 'hundred' }
const ORD = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 12: 'twelfth', 20: 'twentieth' }
// parole che il riconoscimento confonde e che si pronunciano uguali (non sono errori di pronuncia)
const SAME = [['to', 'too', 'two'], ['for', 'four'], ['there', 'their', 'theyre'], ['your', 'youre'], ['its', 'it is'], ['know', 'no'], ['right', 'write'], ['by', 'buy', 'bye'], ['here', 'hear'], ['weather', 'whether'], ['ok', 'okay'], ['e-mail', 'email'], ['mr', 'mister'], ['ms', 'miss']]
const sameMap = new Map()
SAME.forEach(g => g.forEach(w => sameMap.set(w, g[0])))
const canon = w => sameMap.get(w) || w

const STOP = new Set('a an the to of in on at for and or but is are am was were be been it i you we they he she me my your our their this that these those with as by do does did have has had will would can could not no so if from up out about just'.split(' '))

function tok(s) {
  return normalize(String(s).replace(/\b(\d+)(st|nd|rd|th)\b/gi, (m, n) => ORD[n] || m).replace(/\b\d+\b/g, n => NUM[n] || n)).split(' ').filter(Boolean)
}

// Somiglianza tra due parole: 1 uguale, 0.5 quasi (un suono diverso), 0 diversa
function sim(a, b) {
  if (a === b || canon(a) === canon(b)) return 1
  const d = levenshtein(a, b)
  const L = Math.max(a.length, b.length)
  if (L >= 4 && d <= (L <= 6 ? 1 : 2)) return 0.5
  return 0
}

// Allinea le parole dette con quelle attese (programmazione dinamica): ogni parola attesa = ok | almost | miss
function alignTokens(said, target) {
  const n = said.length, m = target.length
  const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const s = sim(said[i - 1], target[j - 1])
    S[i][j] = Math.max(S[i - 1][j], S[i][j - 1], s > 0 ? S[i - 1][j - 1] + s : -1)
  }
  const res = new Array(m).fill('miss')
  let i = n, j = m, extra = 0
  while (i > 0 && j > 0) {
    const s = sim(said[i - 1], target[j - 1])
    if (s > 0 && S[i][j] === S[i - 1][j - 1] + s) { res[j - 1] = s === 1 ? 'ok' : 'almost'; i--; j-- }
    else if (S[i][j] === S[i - 1][j]) { i--; extra++ }
    else j--
  }
  return { res, extra: extra + i }
}

/**
 * Punteggio di pronuncia. said: testo riconosciuto (o elenco di alternative), target: frase attesa.
 * Ritorna { score 0-100, words: [{ w (come scritta), n (normalizzata), r: 'ok'|'almost'|'miss' }], heard }
 */
export function scorePron(said, target) {
  const options = (Array.isArray(said) ? said : [said]).filter(Boolean)
  const display = String(target).split(/\s+/).filter(Boolean)
  // ogni parola scritta può diventare più parole normalizzate (I've -> i have)
  const parts = display.map(w => tok(w))
  const flat = parts.flat()
  let best = null
  for (const opt of options.length ? options : ['']) {
    const { res, extra } = alignTokens(tok(opt), flat)
    let k = 0
    const words = display.map((w, i) => {
      const rs = parts[i].map(() => res[k++])
      const r = !rs.length ? 'ok' : rs.every(x => x === 'ok') ? 'ok' : rs.some(x => x !== 'miss') ? 'almost' : 'miss'
      return { w, n: parts[i].join(' '), r }
    })
    const counted = words.filter(x => x.n)
    const pts = counted.reduce((a, x) => a + (x.r === 'ok' ? 1 : x.r === 'almost' ? 0.5 : 0), 0)
    const score = counted.length ? Math.max(0, Math.round((pts / counted.length) * 100 - Math.min(15, extra * 4))) : 0
    if (!best || score > best.score) best = { score, words, heard: opt }
  }
  return best
}

export function verdict(score) {
  if (score >= 90) return { cls: 'ok', t: 'Ottimo: si capisce benissimo.' }
  if (score >= 70) return { cls: 'almost', t: 'Bene: ripeti le parole in giallo e in rosso.' }
  if (score >= 40) return { cls: 'almost', t: 'Si capisce in parte: riascolta lento e riprova.' }
  return { cls: 'no', t: 'Non si capisce ancora: ascolta la frase lenta, poi ripetila a pezzi.' }
}

// ---- ripasso a intervalli delle parole che si sbagliano ----
const STEPS_D = [1, 3, 7, 15, 30, 60]
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return today(d) }
const keyOf = n => n.replace(/[^a-z' -]/g, '').trim()

// Dopo ogni tentativo: le parole "vere" sbagliate entrano (o tornano oggi); quelle già nel ripasso dette bene avanzano
export function recordPron(words, sentence) {
  update(s => {
    const P = s.voice.pron
    for (const x of words) {
      const k = keyOf(x.n)
      if (!k || k.length < 3 || STOP.has(k)) continue
      const c = P[k]
      if (x.r === 'miss' || (x.r === 'almost' && c)) {
        const e = c || { miss: 0, hits: 0, interval: 0 }
        e.miss++; e.interval = 0; e.due = today(); e.last = today(); e.ex = sentence.slice(0, 160)
        P[k] = e
      } else if (x.r === 'ok' && c && c.due <= today()) { // avanza una volta sola, quando era da ripassare
        c.hits++
        const i = STEPS_D.findIndex(d => d > (c.interval || 0))
        c.interval = STEPS_D[i < 0 ? STEPS_D.length - 1 : i]
        c.due = addDays(c.interval); c.last = today()
      }
    }
    // tetto: tengo le 300 più sbagliate
    const keys = Object.keys(P)
    if (keys.length > 300) keys.sort((a, b) => (P[a].miss - P[a].hits) - (P[b].miss - P[b].hits)).slice(0, keys.length - 300).forEach(k => delete P[k])
  })
}

// Parole da aggiungere al ripasso di pronuncia (es. "parole da ripassare" del pagellino)
export function addPronWords(list) {
  if (!list?.length) return
  update(s => {
    for (const w of list) {
      const k = keyOf(normalize(w.en))
      if (!k || k.length < 3 || s.voice.pron[k]) continue
      s.voice.pron[k] = { miss: 1, hits: 0, interval: 0, due: today(), last: today(), ex: w.ex || w.en, it: w.it || '' }
    }
  })
}

// Parole di pronuncia da ripassare oggi, le più sbagliate prima
export function duePron(st = getState()) {
  const t = today()
  return Object.entries(st.voice?.pron || {}).filter(([, c]) => c.due <= t)
    .sort((a, b) => (b[1].miss - b[1].hits) - (a[1].miss - a[1].hits)).map(([w, c]) => ({ w, ...c }))
}

export function hardestPron(st = getState(), n = 12) {
  return Object.entries(st.voice?.pron || {}).sort((a, b) => (b[1].miss - b[1].hits) - (a[1].miss - a[1].hits)).slice(0, n).map(([w, c]) => ({ w, ...c }))
}
