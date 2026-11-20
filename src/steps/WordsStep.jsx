import { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { Say, SayBoth } from '../components/Speak.jsx'
import { speak } from '../lib/speech.js'
import { checkAnswer, shuffle } from '../lib/check.js'
import { addLessonCards } from '../lib/srs.js'
import { useStore } from '../lib/store.js'
import { gsap, reducedMotion } from '../lib/motion.js'

const TYPES = { verb: 'verbo', noun: 'nome', adj: 'aggettivo', adv: 'avverbio', phrase: 'espressione', prep: 'preposizione', conj: 'congiunzione' }

export default function WordsStep({ lesson, done, id }) {
  const [mode, setMode] = useState('study')
  const words = lesson.words
  const finish = score => { addLessonCards(id, words.length); done(score) }
  return (
    <section className="card">
      <h2>Le 50 parole</h2>
      <p className="muted">Prima <b>studiale</b> ascoltandole ad alta voce (ripeti dopo la voce!), poi passa alle <b>flashcard</b> e mettiti alla prova con <b>quiz</b>, <b>scrittura</b> e <b>dettato</b>. Finito un esercizio, le parole entrano nel ripasso quotidiano.</p>
      <div className="tabs" role="group" aria-label="Modalità">
        {[['study', '📖 Studia'], ['flash', '🃏 Flashcard'], ['quiz', '✅ Quiz'], ['type', '⌨️ Scrivi'], ['dict', '👂 Dettato']].map(([k, l]) => (
          <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      {mode === 'study' && <Study words={words} falseFriends={lesson.falseFriends} />}
      {mode === 'flash' && <Flash words={words} onEnd={() => addLessonCards(id, words.length)} />}
      {mode === 'quiz' && <Quiz words={words} onEnd={finish} key="q" />}
      {mode === 'type' && <TypeDrill words={words} onEnd={finish} key="t" />}
      {mode === 'dict' && <Dictation words={words} onEnd={finish} key="d" />}
    </section>
  )
}

function Study({ words, falseFriends }) {
  const showPron = useStore(s => s.settings.showPron)
  const [playingAll, setPlayingAll] = useState(false)
  async function playAll() {
    setPlayingAll(true)
    const { speakSequence } = await import('../lib/speech.js')
    const items = []
    words.forEach(w => {
      items.push({ text: w.en.replace(/^to /, 'to '), lang: 'en', pause: 300 })
      items.push({ text: w.it, lang: 'it', pause: 200 })
      items.push({ text: w.ex, lang: 'en', rate: .92, pause: 900 })
    })
    await speakSequence(items, k => document.getElementById('w' + Math.floor(k / 3))?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' }))
    setPlayingAll(false)
  }
  return (
    <>
      <div className="row mb">
        <button className="btn small" onClick={async () => { if (playingAll) { (await import('../lib/speech.js')).stop(); setPlayingAll(false) } else playAll() }}>
          {playingAll ? '■ Ferma' : '🔊 Ascolta tutte (parola, traduzione, esempio)'}
        </button>
      </div>
      <div className="wordlist">
        {words.map((w, i) => (
          <div className="word" key={i} id={'w' + i}>
            <span className="muted small" style={{ minWidth: 22 }}>{i + 1}</span>
            <div>
              <div className="type">{TYPES[w.type] || w.type}</div>
              <div><span className="en" lang="en">{w.en}</span> {showPron !== false && <span className="pr">/{w.pron}/</span>}</div>
              <div className="it">{w.it}</div>
              <div className="ex"><span lang="en">{w.ex}</span><br />{w.exIt}</div>
            </div>
            <div className="row" style={{ flexDirection: 'column', gap: 6 }}>
              <SayBoth text={w.en} />
              <Say text={w.ex} small label={`Ascolta l'esempio: ${w.ex}`} />
            </div>
          </div>
        ))}
      </div>
      {falseFriends?.length > 0 && (
        <div className="tip mt2">
          <b>⚠️ Falsi amici</b>
          {falseFriends.map((f, i) => <p key={i} style={{ margin: '6px 0' }}><b lang="en">{f.en}</b> = {f.it}. {f.trap}</p>)}
        </div>
      )}
    </>
  )
}

function Flash({ words, onEnd }) {
  const [order] = useState(() => shuffle(words.map((_, i) => i)))
  const [k, setK] = useState(0)
  const [flip, setFlip] = useState(false)
  const [dir, setDir] = useState('it-en')
  const [known, setKnown] = useState(0)
  const inner = useRef(null)
  useLayoutEffect(() => {
    if (!inner.current) return
    if (reducedMotion) { inner.current.style.transform = flip ? 'rotateY(180deg)' : 'none'; return }
    gsap.to(inner.current, { rotateY: flip ? 180 : 0, duration: .5, ease: 'power2.inOut' })
  }, [flip])
  if (k >= order.length) {
    return <div className="center"><h3>Fatto! {known} su {order.length} le sapevi già.</h3><button className="btn primary" onClick={() => { setK(0); setKnown(0) }}>Ricomincia</button></div>
  }
  const w = words[order[k]]
  const front = dir === 'it-en' ? w.it : w.en
  const next = ok => { if (ok) setKnown(n => n + 1); setFlip(false); setTimeout(() => { setK(n => n + 1); if (k + 1 >= order.length) onEnd?.() }, reducedMotion ? 0 : 250) }
  return (
    <div>
      <div className="row mb">
        <span className="small muted">Carta {k + 1} di {order.length}</span><span className="spacer" />
        <button className="btn small ghost" onClick={() => setDir(d => d === 'it-en' ? 'en-it' : 'it-en')}>Direzione: {dir === 'it-en' ? 'IT → EN' : 'EN → IT'}</button>
      </div>
      <div className="flash">
        <div className="flash-inner" ref={inner} onClick={() => { setFlip(f => !f); if (!flip) speak(w.en) }} role="button" tabIndex={0}
          aria-label={flip ? `${w.en}: ${w.it}` : `${front}. Tocca per girare`}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlip(f => !f); if (!flip) speak(w.en) } }}>
          <div className="flash-face"><div className="big" lang={dir === 'it-en' ? 'it' : 'en'}>{front}</div><p className="muted small mt">Pensa alla risposta, poi tocca la carta</p></div>
          <div className="flash-face back"><div className="big" lang="en">{w.en}</div><div className="pr">/{w.pron}/</div><p style={{ margin: '8px 0 0' }}>{w.it}</p><p className="small" style={{ opacity: .8 }} lang="en">{w.ex}</p></div>
        </div>
      </div>
      <div className="row mt" style={{ justifyContent: 'center' }}>
        <button className="btn bad" onClick={() => next(false)}>Non la sapevo</button>
        <button className="btn good" onClick={() => next(true)}>La sapevo</button>
      </div>
    </div>
  )
}

function Result({ score, total, onRetry, wrong }) {
  const pct = Math.round((score / total) * 100)
  return (
    <div className="center">
      <div className="eyebrow">Risultato</div>
      <h2>{pct}% <span className="muted" style={{ fontSize: '1rem' }}>({score} su {total})</span></h2>
      <p>{pct >= 90 ? 'Eccellente! 🎉' : pct >= 70 ? 'Bene! Ripassa quelle sbagliate.' : 'Rifai l\'esercizio: la seconda volta va molto meglio.'}</p>
      {wrong?.length > 0 && <div className="wordlist" style={{ textAlign: 'left' }}>{wrong.map((w, i) => <div key={i} className="word"><span /><div><span className="en">{w.en}</span> <span className="pr">/{w.pron}/</span><div className="it">{w.it}</div></div><SayBoth text={w.en} /></div>)}</div>}
      <button className="btn primary mt" onClick={onRetry}>Rifai</button>
    </div>
  )
}

function Quiz({ words, onEnd }) {
  const [seed, setSeed] = useState(0)
  const qs = useMemo(() => shuffle(words.map((_, i) => i)).slice(0, 20).map((i, n) => {
    const dir = n % 2 ? 'en-it' : 'it-en'
    const others = shuffle(words.map((_, j) => j).filter(j => j !== i)).slice(0, 3)
    return { i, dir, opts: shuffle([i, ...others]) }
  }), [words, seed])
  const [k, setK] = useState(0)
  const [pick, setPick] = useState(null)
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState([])
  if (k >= qs.length) return <Result score={score} total={qs.length} wrong={wrong} onRetry={() => { setSeed(s => s + 1); setK(0); setScore(0); setWrong([]); setPick(null) }} />
  const q = qs[k], w = words[q.i]
  const label = j => q.dir === 'it-en' ? words[j].en : words[j].it
  const choose = j => {
    if (pick != null) return
    setPick(j)
    const ok = j === q.i
    if (ok) setScore(s => s + 1); else setWrong(x => [...x, w])
    speak(w.en)
    setTimeout(() => { setPick(null); setK(n => n + 1); if (k + 1 >= qs.length) onEnd(Math.round(((score + (ok ? 1 : 0)) / qs.length) * 100)) }, ok ? 900 : 2000)
  }
  return (
    <div>
      <div className="progress mb"><span style={{ width: `${(k / qs.length) * 100}%` }} /></div>
      <p className="small muted">Domanda {k + 1} di {qs.length} · {q.dir === 'it-en' ? 'Come si dice in inglese?' : 'Cosa vuol dire?'}</p>
      <h3 lang={q.dir === 'it-en' ? 'it' : 'en'}>{q.dir === 'it-en' ? w.it : w.en}</h3>
      <div className="choices">
        {q.opts.map(j => (
          <button key={j} className={'choice' + (pick != null && j === q.i ? ' ok' : pick === j ? ' no' : '')} disabled={pick != null} onClick={() => choose(j)}
            lang={q.dir === 'it-en' ? 'en' : 'it'}>{label(j)}</button>
        ))}
      </div>
    </div>
  )
}

function TypeDrill({ words, onEnd, dictation }) {
  const [seed, setSeed] = useState(0)
  const order = useMemo(() => shuffle(words.map((_, i) => i)).slice(0, dictation ? 10 : 15), [words, seed, dictation])
  const [k, setK] = useState(0)
  const [val, setVal] = useState('')
  const [res, setRes] = useState(null)
  const [score, setScore] = useState(0)
  const [wrong, setWrong] = useState([])
  const input = useRef(null)
  if (k >= order.length) return <Result score={score} total={order.length} wrong={wrong} onRetry={() => { setSeed(s => s + 1); setK(0); setScore(0); setWrong([]); setRes(null); setVal('') }} />
  const w = words[order[k]]
  const target = dictation ? w.ex : w.en
  const check = e => {
    e.preventDefault()
    if (res) { // avanti
      setRes(null); setVal(''); setK(n => n + 1)
      if (k + 1 >= order.length) onEnd(Math.round((score / order.length) * 100))
      setTimeout(() => input.current?.focus(), 50)
      return
    }
    const r = checkAnswer(val, [target])
    setRes(r)
    if (r.result !== 'no') setScore(s => s + 1); else setWrong(x => [...x, w])
    speak(target, { rate: dictation ? .9 : 1 })
  }
  return (
    <form onSubmit={check}>
      <div className="progress mb"><span style={{ width: `${(k / order.length) * 100}%` }} /></div>
      <p className="small muted">{k + 1} di {order.length} · {dictation ? 'Ascolta e scrivi la frase che senti' : 'Scrivi in inglese'}</p>
      {dictation ? (
        <div className="row mb"><Say text={w.ex} label="Ascolta la frase" /><Say text={w.ex} rate={.65} label="Ascolta lento" /><span className="muted small">Aiuto: contiene «{w.en.replace(/^to /, '')}»</span></div>
      ) : <h3>{w.it}</h3>}
      <label htmlFor="ans" className="sr-only">La tua risposta</label>
      <input id="ans" ref={input} type="text" autoComplete="off" autoCapitalize="off" spellCheck="false" lang="en" autoFocus value={val} onChange={e => setVal(e.target.value)}
        className={res ? 'input-' + res.result : ''} readOnly={!!res} />
      {res && (
        <div className={'feedback ' + res.result} role="status">
          {res.result === 'ok' ? '✓ Giusto!' : res.result === 'almost' ? '≈ Quasi: controlla come si scrive.' : '✗ Non proprio.'} <b lang="en">{target}</b>
          {!dictation && <> <span className="pr muted">/{w.pron}/</span></>}
        </div>
      )}
      <button className="btn primary mt" type="submit">{res ? 'Avanti →' : 'Controlla'}</button>
    </form>
  )
}

function Dictation(props) { return <TypeDrill {...props} dictation /> }
