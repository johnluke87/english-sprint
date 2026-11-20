import { useEffect, useState } from 'react'
import { speakSequence, stop } from '../lib/speech.js'

export default function DialogueStep({ lesson, done }) {
  const d = lesson.dialogue
  const [cur, setCur] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [showIt, setShowIt] = useState(false)
  const [showText, setShowText] = useState(false)
  const [answers, setAnswers] = useState({})
  useEffect(() => () => stop(), [])

  async function play(rate = 1, from = 0) {
    if (playing) { stop(); setPlaying(false); setCur(-1); return }
    setPlaying(true)
    await speakSequence(d.lines.slice(from).map(l => ({ text: l.en, lang: 'en', voice: l.s === 'A' ? 1 : 2, rate: rate * (l.s === 'C' ? 1.05 : 1), pause: 350 })), k => setCur(from + k))
    setPlaying(false); setCur(-1)
  }
  const answered = Object.keys(answers).length
  const correct = lesson.listening.filter((q, i) => answers[i] === q.answer).length
  useEffect(() => { if (answered === lesson.listening.length) done(Math.round(correct / answered * 100)) }, [answered]) // eslint-disable-line

  return (
    <>
      <section className="card">
        <h2 lang="en">{d.title}</h2>
        <p className="muted">{d.context}</p>
        <p className="small"><b>Come fare:</b> 1) ascolta senza leggere e rispondi alle domande; 2) riascolta leggendo; 3) riascolta e ripeti ogni battuta.</p>
        <div className="row">
          <button className="btn primary small" onClick={() => play(1)}>{playing ? '■ Ferma' : '▶ Ascolta il dialogo'}</button>
          {!playing && <button className="btn small" onClick={() => play(.75)}>🐢 Lento</button>}
          <label className="row small" style={{ gap: 6, fontWeight: 500 }}><input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} /> Mostra il testo</label>
          {showText && <label className="row small" style={{ gap: 6, fontWeight: 500 }}><input type="checkbox" checked={showIt} onChange={e => setShowIt(e.target.checked)} /> Traduzione</label>}
        </div>
        {showText && (
          <div className="dialogue mt">
            {d.lines.map((l, i) => (
              <div key={i} className={`bubble ${l.s}${cur === i ? ' speaking' : ''}`} onClick={() => !playing && play(1, i)} style={{ cursor: 'pointer' }}>
                <div className="who">{l.name}</div>
                <div lang="en">{l.en}</div>
                {showIt && <div className="it">{l.it}</div>}
              </div>
            ))}
          </div>
        )}
        {!showText && playing && cur >= 0 && <p className="mt muted">🎧 Battuta {cur + 1} di {d.lines.length} · {d.lines[cur].name}</p>}
      </section>
      <section className="card">
        <h2>Hai capito?</h2>
        {lesson.listening.map((q, i) => (
          <div className="exercise" key={i}>
            <div className="q" lang="en">{i + 1}. {q.q}</div>
            <div className="choices">
              {q.options.map((o, j) => {
                const a = answers[i]
                const cls = a == null ? '' : j === q.answer ? ' ok' : a === j ? ' no' : ''
                return <button key={j} lang="en" className={'choice' + cls} disabled={a != null} onClick={() => setAnswers(s => ({ ...s, [i]: j }))}>{o}</button>
              })}
            </div>
          </div>
        ))}
        {answered === lesson.listening.length && <p className="mt"><b>{correct} su {answered} giuste.</b> {correct < answered && 'Riascolta il dialogo con il testo per vedere cosa ti è sfuggito.'}</p>}
      </section>
    </>
  )
}
