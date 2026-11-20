// Controllo delle risposte scritte: maiuscole, punteggiatura e contrazioni non contano; piccoli errori di battitura = "quasi".

const CONTRACTIONS = [
  [/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'cannot'], [/\bshan't\b/g, 'shall not'],
  [/\bain't\b/g, 'is not'], [/\blet's\b/g, 'let us'],
  [/n't\b/g, ' not'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'],
  [/'d\b/g, ' would'], [/'m\b/g, ' am'], [/\b(it|he|she|that|there|what|who|where|here)'s\b/g, '$1 is'],
]

export function normalize(s) {
  let t = String(s || '').toLowerCase().trim()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep)
  t = t.replace(/\bcan not\b/g, 'cannot')
    .replace(/[.,!?;:"()\[\]…–—-]/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t
}

export function levenshtein(a, b) {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

// Ritorna 'ok' | 'almost' | 'no' confrontando con tutte le risposte accettate
export function checkAnswer(given, accepted) {
  const g = normalize(given)
  if (!g) return { result: 'no', best: accepted[0] }
  let best = accepted[0], bestD = Infinity
  for (const a of accepted) {
    const n = normalize(a)
    // per le parole "to send": accetta anche "send" senza to
    const variants = [n, n.replace(/^to /, '')]
    for (const v of variants) {
      const d = levenshtein(g, v)
      if (d < bestD) { bestD = d; best = a }
    }
  }
  if (bestD === 0) return { result: 'ok', best }
  const len = normalize(best).length
  const tol = len <= 4 ? 0 : len <= 10 ? 1 : len <= 30 ? 2 : 3
  return { result: bestD <= tol ? 'almost' : 'no', best }
}

// Somiglianza tra frase detta e frase attesa (parole in comune, in ordine): 0..100
export function speechScore(said, target) {
  const a = normalize(said).split(' ').filter(Boolean)
  const b = normalize(target).split(' ').filter(Boolean)
  if (!b.length) return 0
  // LCS sulle parole
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const common = dp[a.length][b.length]
  return Math.round((common / Math.max(b.length, a.length)) * 100)
}

// Quali parole della frase attesa sono state dette (per colorarle)
export function wordMatches(said, target) {
  const saidSet = new Set(normalize(said).split(' '))
  return String(target).split(/\s+/).map(w => ({ w, ok: saidSet.has(normalize(w)) || !normalize(w) }))
}

export function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
