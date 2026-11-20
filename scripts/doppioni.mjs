// Elenca le parole doppie tra le lezioni (resta la prima, vanno cambiate le successive).
// Esenti: lezioni di ripasso (10, 40, 59, 60) e la 56 (pronuncia: i doppioni sono voluti).
// Scrive scripts/doppioni.json: { "L14": ["to apologise", ...], ... } e scripts/parole-usate.txt (tutte le parole del corso).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
const dir = new URL('../public/content/lessons/', import.meta.url)
const EXEMPT = [10, 40, 56, 59, 60]
const files = readdirSync(dir).filter(f => /^L\d\d\.json$/.test(f)).sort()
const seen = new Map(), dup = {}, all = new Set()
const norm = s => s.toLowerCase().replace(/^(to|a|an|the) /, '').trim()
for (const f of files) {
  const id = Number(f.slice(1, 3))
  const L = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
  for (const w of L.words) {
    const k = norm(w.en)
    all.add(w.en.toLowerCase())
    if (seen.has(k) && !EXEMPT.includes(id)) (dup[f.slice(0, 3)] ||= []).push(w.en)
    else if (!seen.has(k)) seen.set(k, id)
  }
}
writeFileSync(new URL('doppioni.json', import.meta.url), JSON.stringify(dup, null, 1))
writeFileSync(new URL('parole-usate.txt', import.meta.url), [...all].sort().join('\n'))
console.log(Object.entries(dup).map(([k, v]) => `${k}: ${v.length}`).join(', '))
console.log('totale doppioni:', Object.values(dup).flat().length, '· parole diverse:', seen.size)
