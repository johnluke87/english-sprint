import { useEffect, useMemo, useRef, useState } from 'react'
import { useLesson } from '../lib/useCourse.js'
import { speak, stop, sleep } from '../lib/speech.js'

// Audio-lezione: tutta la lezione letta ad alta voce, da ascoltare in macchina o a piedi (con pause per ripetere)
function buildTrack(L, parts) {
  const t = []
  const sec = (title, it) => t.push({ section: title, text: it, lang: 'it', show: title })
  if (parts.intro) {
    sec('Introduzione', `Lezione ${L.id}. ${L.title}. ${L.intro}`)
  }
  if (parts.words) {
    sec('Le parole', 'Le parole della lezione. Ascolta e ripeti ad alta voce nella pausa.')
    L.words.forEach(w => {
      t.push({ text: w.en, lang: 'en', show: w.en, sub: w.it, pause: 1300 })
      t.push({ text: w.it, lang: 'it', show: w.en, sub: w.it, pause: 300 })
      t.push({ text: w.ex, lang: 'en', show: w.ex, sub: w.exIt, rate: .92, pause: 1800 })
    })
  }
  if (parts.grammar) {
    sec('Grammatica', L.grammar.title)
    L.grammar.explainIt.forEach(p => t.push({ text: p, lang: 'it', show: L.grammar.title, sub: p, pause: 300 }))
    L.grammar.rules.forEach(r => {
      t.push({ text: r.it, lang: 'it', show: r.en, sub: r.it, pause: 300 })
      r.examples.forEach(e => t.push({ text: e.en, lang: 'en', show: e.en, sub: e.it, pause: 1200 }))
    })
    t.push({ text: 'Il trucco. ' + L.grammar.tip, lang: 'it', show: 'Trucco', sub: L.grammar.tip })
  }
  if (parts.phrases) {
    sec('Espressioni', 'Le espressioni fatte. Senti l\'italiano: prova a dirlo in inglese prima della voce.')
    L.phrases.forEach(p => {
      t.push({ text: p.it, lang: 'it', show: p.it, pause: 2200 })
      t.push({ text: p.en, lang: 'en', show: p.en, sub: p.it, pause: 1600 })
    })
  }
  if (parts.dialogue) {
    sec('Dialogo', 'Il dialogo. ' + L.dialogue.context)
    L.dialogue.lines.forEach(l => t.push({ text: l.en, lang: 'en', voice: l.s === 'A' ? 1 : 2, show: `${l.name}: ${l.en}`, sub: l.it, pause: 400 }))
  }
  t.push({ section: 'Fine', text: 'Fine della audio-lezione. Ottimo lavoro!', lang: 'it', show: 'Fine' })
  return t
}

export default function AudioLesson({ id }) {
  const { lesson, error } = useLesson(id)
  const [parts, setParts] = useState({ intro: true, words: true, grammar: true, phrases: true, dialogue: true })
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const run = useRef(0)
  const track = useMemo(() => lesson ? buildTrack(lesson, parts) : [], [lesson, parts])
  useEffect(() => () => { run.current++; stop() }, [])

  async function play(from) {
    const my = ++run.current
    stop(); setPlaying(true)
    for (let k = from; k < track.length; k++) {
      if (my !== run.current) return
      setPos(k)
      const it = track[k]
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = new window.MediaMetadata({ title: it.show || '', artist: `English Sprint · Lezione ${id}` })
      await speak(it.text, { lang: it.lang, voice: it.voice || 1, rate: (it.rate || 1) * rate })
      if (my !== run.current) return
      await sleep((it.pause || 250) / rate)
    }
    if (my === run.current) setPlaying(false)
  }
  const pause = () => { run.current++; stop(); setPlaying(false) }
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', () => play(pos))
    navigator.mediaSession.setActionHandler('pause', pause)
  })

  if (error) return <div className="error">{error}</div>
  if (!lesson) return <div className="loading">Carico…</div>
  const cur = track[pos] || {}
  const sections = track.map((t, k) => t.section ? { k, name: t.section } : null).filter(Boolean)
  const curSection = [...sections].reverse().find(s => s.k <= pos)
  const minutes = Math.round(track.reduce((a, t) => a + t.text.length / 14 + (t.pause || 250) / 1000, 0) / 60)

  return (
    <div>
      <a className="btn small ghost" href={`#/lezione/${id}`}>← Lezione {id}</a>
      <div className="eyebrow mt">Audio-lezione · circa {minutes} minuti</div>
      <h1>{lesson.title}</h1>
      <section className="card">
        <div className="row"><span className="pill accent">{curSection?.name || 'Pronto'}</span><span className="spacer" /><div className={'wave' + (playing ? ' on' : '')} aria-hidden="true"><i /><i /><i /><i /><i /></div></div>
        <div className="now mt" lang={cur.lang === 'en' ? 'en' : undefined}>{cur.show}</div>
        <p className="muted">{cur.sub}</p>
        <div className="progress"><span style={{ width: `${(pos / Math.max(1, track.length - 1)) * 100}%` }} /></div>
        <div className="row mt">
          <button className="btn small" onClick={() => play(Math.max(0, pos - 3))} aria-label="Indietro">⏪</button>
          {playing ? <button className="btn dark" onClick={pause}>❚❚ Pausa</button> : <button className="btn primary" onClick={() => play(pos >= track.length - 1 ? 0 : pos)}>▶ {pos ? 'Riprendi' : 'Ascolta'}</button>}
          <button className="btn small" onClick={() => play(Math.min(track.length - 1, pos + 3))} aria-label="Avanti">⏩</button>
          <span className="spacer" />
          <label className="small" htmlFor="arate">Velocità</label>
          <select id="arate" value={rate} onChange={e => setRate(Number(e.target.value))} style={{ width: 'auto' }}>
            {[.75, .9, 1, 1.15, 1.3].map(r => <option key={r} value={r}>{r}×</option>)}
          </select>
        </div>
        <div className="row mt">
          {sections.map(s => <button key={s.k} className="btn small ghost" onClick={() => play(s.k)}>{s.name}</button>)}
        </div>
      </section>
      <section className="card">
        <h3>Cosa ascoltare</h3>
        <div className="row">
          {[['intro', 'Introduzione'], ['words', 'Parole'], ['grammar', 'Grammatica'], ['phrases', 'Espressioni'], ['dialogue', 'Dialogo']].map(([k, l]) => (
            <label key={k} className="row small" style={{ gap: 6, fontWeight: 500 }}>
              <input type="checkbox" checked={parts[k]} onChange={e => { pause(); setPos(0); setParts(p => ({ ...p, [k]: e.target.checked })) }} /> {l}
            </label>
          ))}
        </div>
        <p className="small muted mt">Nota: la voce è quella del telefono, quindi tieni lo schermo acceso (su molti telefoni la sintesi vocale si ferma a schermo spento). Le cuffie vanno benissimo.</p>
      </section>
    </div>
  )
}
