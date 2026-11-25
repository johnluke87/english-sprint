// Voce del browser (gratis, niente server): sintesi vocale (TTS) e riconoscimento vocale (STT).
// Le voci migliori: Edge su Windows ("Microsoft ... Online (Natural)"), Chrome ("Google UK English"), Safari/iOS (Siri).

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
let voices = []
const listeners = new Set()

function loadVoices() {
  if (!synth) return
  voices = synth.getVoices()
  listeners.forEach(fn => fn(voices))
}
if (synth) {
  loadVoices()
  synth.addEventListener?.('voiceschanged', loadVoices)
}

export const ttsSupported = !!synth
export function onVoices(fn) { listeners.add(fn); fn(voices); return () => listeners.delete(fn) }

// Punteggio di una voce: le "naturali" (neural) prima, poi Google, poi le altre
function score(v) {
  const n = v.name.toLowerCase()
  let s = 0
  if (/natural|neural|online/.test(n)) s += 50
  if (/google/.test(n)) s += 30
  if (/siri|enhanced|premium|avanzat|migliorat/.test(n)) s += 35
  // voci note per essere chiare (Edge, macOS/iOS)
  if (/\b(aria|jenny|guy|sonia|ryan|libby|ava|andrew|emma|brian|samantha|daniel|serena|karen|moira)\b/.test(n)) s += 8
  if (/en[-_](gb|us)/i.test(v.lang)) s += 4
  // voci robotiche o compresse in fondo
  if (/espeak|compact|desktop|zira|david|hazel|mark/.test(n) && !/natural|online/.test(n)) s -= 20
  if (v.localService === false) s += 5
  return s
}

export function voicesFor(lang) {
  const base = lang.slice(0, 2)
  return voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(base)).sort((a, b) => score(b) - score(a))
}

// settings: { voiceEn, voiceEn2, voiceIt, rate }
let settings = { rate: 1 }
export function setSpeechSettings(s) { settings = { ...settings, ...s } }

function pickVoice(lang, which) {
  const list = voicesFor(lang)
  if (!list.length) return null
  const wanted = lang === 'it' ? settings.voiceIt : which === 2 ? settings.voiceEn2 : settings.voiceEn
  const found = wanted && list.find(v => v.name === wanted)
  if (found) return found
  if (lang === 'en') {
    // seconda voce (dialoghi): una diversa dalla prima, se possibile di altro genere/accento
    const first = (settings.voiceEn && list.find(v => v.name === settings.voiceEn)) || list[0]
    if (which === 2) return list.find(v => v.name !== first.name) || first
    const en = list.filter(v => /en-(gb|us)/i.test(v.lang))
    return en[0] || list[0]
  }
  return list[0]
}

let token = 0
export function stop() { token++; synth?.cancel() }

// Dice un testo. Ritorna una promessa che si risolve alla fine (o subito se interrotto).
export function speak(text, { lang = 'en', voice = 1, rate, voiceName } = {}) {
  if (!synth || !text) return Promise.resolve(false)
  const my = token
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text)
    const v = (voiceName && voices.find(x => x.name === voiceName)) || pickVoice(lang, voice)
    if (v) { u.voice = v; u.lang = v.lang } else u.lang = lang === 'it' ? 'it-IT' : 'en-GB'
    u.rate = (rate || 1) * (settings.rate || 1) * (lang === 'en' ? 1 : 1.05)
    let done = false
    const end = ok => { if (!done) { done = true; clearInterval(keep); resolve(ok && my === token) } }
    u.onend = () => end(true)
    u.onerror = () => end(false)
    // Chrome si "addormenta" sulle frasi lunghe: pause/resume periodico lo tiene sveglio
    const keep = setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume() } }, 10000)
    synth.speak(u)
  })
}

// Dice una sequenza [{text, lang, voice, pause}] in ordine; si ferma se viene chiamato stop()
export async function speakSequence(items, onItem) {
  stop()
  const my = token
  for (let i = 0; i < items.length; i++) {
    if (my !== token) return false
    onItem?.(i)
    const it = items[i]
    if (it.text) await speak(it.text, it)
    if (my !== token) return false
    if (it.pause) await new Promise(r => setTimeout(r, it.pause))
  }
  return my === token
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))

// ---- Riconoscimento vocale (Chrome, Edge, Safari) ----
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
export const sttSupported = !!SR

// Ascolta una frase in inglese. onPartial(testo) durante il parlato. Ritorna { text, alternatives }.
export function listen({ lang = 'en-GB', onPartial, continuous = false } = {}) {
  if (!SR) return { promise: Promise.reject(new Error('Il riconoscimento vocale non è disponibile in questo browser (usa Chrome o Edge).')), stop() {} }
  stop()
  const rec = new SR()
  rec.lang = lang
  rec.interimResults = true
  rec.continuous = continuous
  rec.maxAlternatives = 3
  let finalText = ''
  let alts = []
  const promise = new Promise((resolve, reject) => {
    rec.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          finalText += (finalText ? ' ' : '') + r[0].transcript.trim()
          alts = Array.from(r).map(a => a.transcript.trim())
        } else interim += r[0].transcript
      }
      onPartial?.((finalText + ' ' + interim).trim())
    }
    rec.onerror = e => {
      if (e.error === 'no-speech') resolve({ text: '', alternatives: [] })
      else if (e.error === 'aborted') resolve({ text: finalText, alternatives: alts })
      else reject(new Error(e.error === 'not-allowed' ? 'Permesso del microfono negato: consentilo dalle impostazioni del browser.' : 'Errore del microfono: ' + e.error))
    }
    rec.onend = () => resolve({ text: finalText, alternatives: alts })
  })
  try { rec.start() } catch (e) { /* già avviato */ }
  return { promise, stop: () => { try { rec.stop() } catch (e) { /* */ } } }
}
