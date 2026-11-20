// Scrive public/content/lessons/index.json: l'elenco delle lezioni pronte (l'app segna le altre come "in arrivo")
import { readdirSync, writeFileSync } from 'node:fs'
const dir = new URL('../public/content/lessons/', import.meta.url)
const ids = readdirSync(dir).filter(f => /^L\d\d\.json$/.test(f)).map(f => Number(f.slice(1, 3))).sort((a, b) => a - b)
writeFileSync(new URL('index.json', dir), JSON.stringify({ lessons: ids }) + '\n')
console.log(`index.json: ${ids.length} lezioni`)
