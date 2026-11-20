import { useState } from 'react'
import { SayBoth } from '../components/Speak.jsx'
import { speakSequence, stop } from '../lib/speech.js'

export default function PhrasesStep({ lesson, done, isDone }) {
  const [hide, setHide] = useState(false)
  const [shown, setShown] = useState({})
  const [playing, setPlaying] = useState(false)
  const groups = []
  lesson.phrases.forEach((p, i) => {
    let g = groups.find(x => x.name === p.group)
    if (!g) groups.push(g = { name: p.group, items: [] })
    g.items.push({ ...p, i })
  })
  async function playAll() {
    if (playing) { stop(); setPlaying(false); return }
    setPlaying(true)
    await speakSequence(lesson.phrases.flatMap(p => [{ text: p.it, lang: 'it', pause: 1500 }, { text: p.en, lang: 'en', pause: 1200 }]))
    setPlaying(false)
  }
  return (
    <section className="card">
      <h2>Come si dice: {lesson.phrases.length} espressioni fatte</h2>
      <p className="muted">Sono frasi pronte: impara a memoria i "pezzi" interi, non le singole parole. Ripetile ad alta voce dopo la voce inglese.</p>
      <div className="row">
        <button className="btn small" onClick={playAll}>{playing ? '■ Ferma' : '🔊 Prima l\'italiano, poi l\'inglese (con pausa per rispondere)'}</button>
        <label className="row small" style={{ gap: 6, fontWeight: 500 }}><input type="checkbox" checked={hide} onChange={e => { setHide(e.target.checked); setShown({}) }} /> Nascondi l'inglese (mettiti alla prova)</label>
      </div>
      {groups.map(g => (
        <div className="phrase-group" key={g.name}>
          <div className="eyebrow">{g.name}</div>
          {g.items.map(p => (
            <div className="phrase" key={p.i}>
              <SayBoth text={p.en} />
              <div>
                <div className={'en' + (hide && !shown[p.i] ? ' hidden-en' : '')} lang="en"
                  onClick={() => setShown(s => ({ ...s, [p.i]: true }))}
                  role={hide && !shown[p.i] ? 'button' : undefined} tabIndex={hide && !shown[p.i] ? 0 : undefined}
                  aria-label={hide && !shown[p.i] ? 'Mostra la frase inglese' : undefined}
                  onKeyDown={e => { if (e.key === 'Enter') setShown(s => ({ ...s, [p.i]: true })) }}>{p.en}</div>
                <div className="it">{p.it}</div>
                {p.note && <div className="note">{p.note}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {!isDone && <button className="btn good mt" onClick={() => done()}>Le ho ripetute tutte ✓</button>}
    </section>
  )
}
