import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { speak, stop, sleep } from '../lib/speech.js'
import { gsap, reducedMotion } from '../lib/motion.js'

// Video-lezione generata: scene animate (GSAP) con narrazione della voce sintetica (italiano + inglese) e sottotitoli.
export default function VideoPlayer({ lesson, onEnd }) {
  const scenes = lesson.video || []
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [caption, setCaption] = useState(null)
  const [subs, setSubs] = useState(true)
  const run = useRef(0)
  const stageRef = useRef(null)

  // animazione d'entrata di ogni scena
  useLayoutEffect(() => {
    if (!stageRef.current) return
    const ctx = gsap.context(() => {
      if (reducedMotion) return
      gsap.fromTo('.scene-n', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4 })
      gsap.fromTo('.scene h2', { opacity: 0, y: 30, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .7, ease: 'power3.out' })
      gsap.fromTo('.scene .line', { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: .55, ease: 'power2.out', stagger: .35, delay: .35 })
      gsap.to('.blob.b1', { x: gsap.utils.random(-60, 60), y: gsap.utils.random(-40, 40), duration: 6, ease: 'sine.inOut' })
      gsap.to('.blob.b2', { x: gsap.utils.random(-60, 60), y: gsap.utils.random(-40, 40), duration: 7, ease: 'sine.inOut' })
    }, stageRef)
    return () => ctx.revert()
  }, [i])

  useEffect(() => () => { run.current++; stop() }, [])

  async function playFrom(start) {
    const my = ++run.current
    stop()
    setPlaying(true)
    setStarted(true)
    for (let s = start; s < scenes.length; s++) {
      if (my !== run.current) return
      setI(s)
      await sleep(reducedMotion ? 150 : 700)
      for (const part of scenes[s].say) {
        if (my !== run.current) return
        setCaption(part)
        await speak(part.text, { lang: part.lang, voice: 1, rate: part.lang === 'en' ? 0.92 : 1 })
        if (my !== run.current) return
        await sleep(part.lang === 'en' ? 600 : 250)
      }
      await sleep(500)
    }
    if (my === run.current) { setPlaying(false); setCaption(null); onEnd?.() }
  }

  function pause() { run.current++; stop(); setPlaying(false) }
  const sc = scenes[i]
  if (!sc) return <p className="muted">Questa lezione non ha la video-lezione.</p>

  return (
    <section aria-label="Video-lezione">
      <div className="stage" ref={stageRef}>
        <div className="blob b1" style={{ width: 260, height: 260, background: '#ff7a45', left: '-60px', top: '-60px' }} />
        <div className="blob b2" style={{ width: 300, height: 300, background: '#2a9d8f', right: '-80px', bottom: '-90px' }} />
        <div className="scene" key={i}>
          <div className="scene-n">Scena {i + 1} di {scenes.length}</div>
          <h2>{sc.title}</h2>
          {sc.show.map((t, k) => <div className="line" key={k}>{t}</div>)}
        </div>
        {subs && caption && (
          <div className="caption" aria-live="off"><span className="lang">{caption.lang.toUpperCase()}</span><span lang={caption.lang}>{caption.text}</span></div>
        )}
        {!started && (
          <button className="start" onClick={() => playFrom(0)} aria-label="Avvia la video-lezione">
            <span aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      <div className="controls">
        {playing
          ? <button className="btn dark small" onClick={pause}>❚❚ Pausa</button>
          : <button className="btn primary small" onClick={() => playFrom(i)}>▶ {started ? 'Riprendi' : 'Avvia'}</button>}
        <button className="btn small" onClick={() => playFrom(Math.max(0, i - 1))} aria-label="Scena precedente">⏮</button>
        <button className="btn small" onClick={() => playFrom(Math.min(scenes.length - 1, i + 1))} aria-label="Scena successiva">⏭</button>
        <div className="scene-dots" role="group" aria-label="Scene">
          {scenes.map((s, k) => (
            <button key={k} className={k === i ? 'on' : k < i ? 'past' : ''} aria-label={`Scena ${k + 1}: ${s.title}`} onClick={() => playFrom(k)} />
          ))}
        </div>
        <label className="small row" style={{ gap: 6, fontWeight: 500 }}>
          <input type="checkbox" checked={subs} onChange={e => setSubs(e.target.checked)} /> Sottotitoli
        </label>
      </div>
      <details className="mt">
        <summary className="small muted">Testo completo della video-lezione</summary>
        {scenes.map((s, k) => (
          <div key={k} className="mt">
            <b>{k + 1}. {s.title}</b>
            {s.say.map((p, j) => <p key={j} lang={p.lang} className={p.lang === 'en' ? '' : 'muted'} style={{ margin: '4px 0' }}>{p.text}</p>)}
          </div>
        ))}
      </details>
    </section>
  )
}
