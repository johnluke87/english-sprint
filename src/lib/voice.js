// Microfono "completo" per la parte a voce (VOCE.md): riconoscimento del browser (Web Speech API) e, insieme,
// registrazione dell'audio (MediaRecorder) per riascoltarsi. Se il riconoscimento del browser non c'è o non capisce,
// l'audio va a Groq Whisper (api/?r=stt, gratis, con tetti suoi). Mani libere: il silenzio chiude il turno.
import { stop as stopTts, sttSupported } from './speech.js'
import { ApiError } from './api.js'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
export const canRecord = typeof window !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)
export const canSpeak = sttSupported || canRecord
export const PERMISSION_HINT = "Il browser chiede il permesso del microfono: tocca «Consenti» in alto. Se non vedi la richiesta, tocca l'icona a sinistra dell'indirizzo del sito, attiva «Microfono» e ricarica la pagina."

// Su alcuni telefoni il riconoscimento e la registrazione non possono usare il microfono insieme:
// se succede una volta, lo ricordo e da lì in poi il riconoscimento va da solo (niente riascolto, niente Whisper sprecato)
const CONFLICT = 'english-sprint-mic-conflict'
function conflictKnown() { try { return localStorage.getItem(CONFLICT) === '1' } catch (e) { return false } }
function setConflict() { try { localStorage.setItem(CONFLICT, '1') } catch (e) { /* */ } }
export function recordingAvailable() { return canRecord && (!SR || !conflictKnown()) }

function pickMime() {
  if (!window.MediaRecorder?.isTypeSupported) return ''
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported(m)) return m
  return ''
}

// Trascrizione con Whisper (server). prompt: parole del contesto (solo nei dialoghi, mai nella pronuncia: falserebbe il punteggio)
export async function whisper(blob, prompt = '') {
  const fd = new FormData()
  const ext = /mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm'
  fd.append('audio', blob, 'audio.' + ext)
  if (prompt) fd.append('prompt', prompt.slice(0, 400))
  let res
  try {
    res = await fetch('api/index.php?r=stt', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-Requested-With': 'english-sprint' } })
  } catch (e) { throw new ApiError('Manca la connessione a internet.', 0) }
  let data = null
  try { data = await res.json() } catch (e) { /* */ }
  if (!res.ok) throw new ApiError((data && data.error) || 'La trascrizione non ha risposto.', res.status, data && data.limit)
  return (data && data.text) || ''
}

/**
 * Ascolta una risposta in inglese.
 * opts: continuous (dialoghi: più frasi, chiude il silenzio), silenceMs, maxMs, onPartial(testo), onLevel(0..1),
 *       record (true = registra anche l'audio, se si può), whisperPrompt, lang
 * Ritorna { promise, stop, cancel }. La promessa dà { text, alternatives, audioUrl, ms, source }.
 */
export function capture(opts = {}) {
  const { continuous = false, silenceMs = 2500, maxMs = 90000, onPartial, onLevel, record = true, whisperPrompt = '', lang = 'en-US', onPermission } = opts
  stopTts()
  let rec = null, recorder = null, stream = null, ctx = null, raf = 0, timer = 0
  let finalText = '', interim = '', alts = []
  let firstAt = 0, lastAt = 0, startAt = Date.now(), heard = false
  let srFailed = !SR, stopped = false, cancelled = false
  let resolveDone
  const ended = new Promise(r => { resolveDone = r })
  const chunks = []

  let resolveStop
  const stopSignal = new Promise(r => { resolveStop = r })
  const finish = () => {
    resolveStop()
    if (stopped) return
    stopped = true
    clearInterval(timer); cancelAnimationFrame(raf)
    try { rec?.stop() } catch (e) { /* */ }
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop() } catch (e) { resolveDone() } } else resolveDone()
  }

  const promise = (async () => {
    const wantRec = record && recordingAvailable()
    if (wantRec || !SR) {
      try {
        // se il browser aspetta il permesso del microfono, dopo 3 secondi lo dico nella pagina; il tasto Ferma funziona sempre
        const ask = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        const hint = setTimeout(() => onPermission?.(), 3000)
        stream = await Promise.race([ask, stopSignal.then(() => null)])
        clearTimeout(hint)
        if (!stream) ask.then(st => st.getTracks().forEach(t => t.stop())).catch(() => {})
      } catch (e) {
        if (!SR) throw new Error(e.name === 'NotAllowedError' ? 'Permesso del microfono negato: consentilo dalle impostazioni del browser (icona del lucchetto).' : 'Microfono non disponibile: ' + (e.message || e.name))
      }
    }
    if (stopped) { // fermato mentre il browser chiedeva il permesso
      stream?.getTracks().forEach(t => t.stop())
      return { text: '', alternatives: [], audioUrl: '', ms: 0, source: 'none', cancelled: true }
    }
    if (stream) {
      const mime = pickMime()
      try {
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
        recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data) }
        recorder.onstop = () => resolveDone()
        recorder.start(250)
      } catch (e) { recorder = null }
      // livello del microfono: anima la sfera e, senza riconoscimento del browser, capisce quando si smette di parlare
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        ctx = new AC()
        const an = ctx.createAnalyser()
        an.fftSize = 512
        ctx.createMediaStreamSource(stream).connect(an)
        const buf = new Uint8Array(an.fftSize)
        const loop = () => {
          an.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
          const lvl = Math.min(1, Math.sqrt(sum / buf.length) * 4)
          onLevel?.(lvl)
          if (lvl > 0.12) { heard = true; if (!firstAt) firstAt = Date.now(); if (srFailed) lastAt = Date.now() }
          raf = requestAnimationFrame(loop)
        }
        loop()
      } catch (e) { /* niente livello */ }
    }

    if (SR) {
      rec = new SR()
      rec.lang = lang
      rec.interimResults = true
      rec.continuous = continuous
      rec.maxAlternatives = 4
      rec.onresult = e => {
        interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) {
            finalText += (finalText ? ' ' : '') + r[0].transcript.trim()
            alts = Array.from(r).map(a => a.transcript.trim())
          } else interim += r[0].transcript
        }
        const now = Date.now()
        if (!firstAt) firstAt = now
        lastAt = now
        heard = true
        onPartial?.((finalText + ' ' + interim).trim())
      }
      rec.onerror = e => {
        if (e.error === 'not-allowed' && !stream) { srFailed = true; finish(); return }
        if (['audio-capture', 'network', 'service-not-allowed', 'language-not-supported'].includes(e.error)) {
          srFailed = true
          if (e.error === 'audio-capture' && stream) setConflict()
          if (!recorder) finish()
        }
      }
      rec.onend = () => {
        // senza "continuous" il riconoscimento finisce da solo alla prima pausa: chiudo tutto
        if (!srFailed || !recorder) finish()
      }
      try { rec.start() } catch (e) { srFailed = true }
    }

    // chiusura: silenzio dopo aver parlato, oppure tempo massimo
    timer = setInterval(() => {
      const now = Date.now()
      if (now - startAt > maxMs) finish()
      else if ((continuous || srFailed) && heard && lastAt && now - lastAt > silenceMs) finish()
      else if (!heard && now - startAt > 12000 && srFailed) finish() // nessuno parla
    }, 250)

    await ended
    stream?.getTracks().forEach(t => t.stop())
    try { ctx?.close() } catch (e) { /* */ }
    onLevel?.(0)
    if (cancelled) return { text: '', alternatives: [], audioUrl: '', ms: 0, source: 'none', cancelled: true }

    let text = (finalText || interim).trim()
    const blob = chunks.length ? new Blob(chunks, { type: chunks[0].type || recorder?.mimeType || 'audio/webm' }) : null
    const audioUrl = blob && blob.size > 1500 ? URL.createObjectURL(blob) : ''
    const ms = firstAt ? Math.max(800, (lastAt || Date.now()) - firstAt + 600) : Date.now() - startAt
    let source = text ? 'browser' : 'none'
    // il browser non ha capito (o non sa riconoscere): provo con Whisper
    if (!text && blob && blob.size > 3000 && (heard || !SR)) {
      text = (await whisper(blob, whisperPrompt)).trim()
      source = text ? 'whisper' : 'none'
    }
    if (!alts.length && text) alts = [text]
    return { text, alternatives: alts, audioUrl, ms, source }
  })()

  return {
    promise,
    stop: () => finish(),
    cancel: () => { cancelled = true; finish() },
  }
}
