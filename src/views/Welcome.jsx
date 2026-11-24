import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { update, useStore, aiQuota } from '../lib/store.js'
import { STARTS, STEP_INFO } from '../lib/useCourse.js'
import { useEnter, gsap, reducedMotion, scrollToEl } from '../lib/motion.js'
import { speak, stop, ttsSupported } from '../lib/speech.js'

// Presentazione: cos'è il corso, come funziona, da dove partire. La prima visita arriva qui; poi resta in #/presentazione.

// L'unico effetto della pagina: la frase italiana che diventa inglese, parola per parola
const PAIRS = [
  ['Ti mando il preventivo entro venerdì.', "I'll send you the quote by Friday."],
  ['Possiamo spostare la riunione a giovedì?', 'Could we move the meeting to Thursday?'],
  ['Scusa, puoi ripetere? Non ti sento bene.', "Sorry, could you say that again? You're breaking up."],
  ['Ci aggiorniamo la settimana prossima.', "Let's catch up next week."],
  ['Ottima domanda: ci ritorno alla fine.', "Great question: I'll come back to it at the end."],
]

function Phrase() {
  const box = useRef(null)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(reducedMotion)
  const [it, en] = PAIRS[i]

  useLayoutEffect(() => {
    if (reducedMotion || !box.current) return
    const ctx = gsap.context(() => {
      gsap.timeline()
        .from('.ph-it', { opacity: 0, y: 10, duration: .45, ease: 'power2.out' })
        .from('.ph-en .w', { opacity: 0, y: '0.6em', rotateX: -70, duration: .5, ease: 'back.out(2)', stagger: .07 }, '+=.35')
        .from('.ph-line', { scaleX: 0, transformOrigin: 'left center', duration: .5, ease: 'power3.out' }, '<')
    }, box)
    return () => ctx.revert()
  }, [i])

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') setI(n => (n + 1) % PAIRS.length) }, 5200)
    return () => clearInterval(t)
  }, [paused])

  return (
    <figure className="w-phrase" ref={box}>
      <p className="ph-it" lang="it">{it}</p>
      <span className="ph-line" aria-hidden="true" />
      <p className="ph-en" lang="en">{en.split(' ').map((w, k) => <span className="w" key={k}>{w} </span>)}</p>
      <figcaption className="row small">
        {ttsSupported && <button type="button" className="btn small" onClick={() => speak(en, { lang: 'en' })}>🔊 Ascolta</button>}
        <button type="button" className="btn small ghost" onClick={() => { stop(); setPaused(true); setI(n => (n + 1) % PAIRS.length) }}>Un'altra frase</button>
        {!reducedMotion && <button type="button" className="btn small ghost" aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? '▶ Riprendi' : '⏸ Pausa'}</button>}
        <span className="muted">Frasi vere del lavoro, dalla prima lezione.</span>
      </figcaption>
    </figure>
  )
}

export default function Welcome() {
  const ref = useRef(null)
  useEnter(ref, [])
  const startLesson = useStore(s => s.settings.startLesson || 1)
  const started = useStore(s => Object.keys(s.lessons).length > 0)
  const [pick, setPick] = useState(startLesson)
  const quota = useStore(() => aiQuota)

  function toStart() {
    const el = document.getElementById('partenza')
    scrollToEl(el)
    el?.focus({ preventScroll: true })
  }

  function begin(id) {
    update(s => { s.welcome = true; s.settings.startLesson = id })
    location.hash = `#/lezione/${id}`
  }

  return (
    <div ref={ref} className="welcome">
      <section className="w-hero" data-anim>
        <div className="eyebrow">Corso gratuito · 60 lezioni · senza registrazione</div>
        <h1>L'inglese che serve al lavoro, un'ora al giorno.</h1>
        <p className="lead">Mail, telefonate, riunioni, clienti. English Sprint è un corso completo e gratuito per chi ha studiato inglese a scuola e vuole tornare a usarlo davvero: si parte subito, senza account.</p>
        <div className="row">
          <button type="button" className="btn primary" onClick={toStart}>Scegli da dove partire</button>
          <a className="btn" href="#/corso" onClick={() => update(s => { s.welcome = true })}>Guarda le 60 lezioni</a>
        </div>
      </section>

      <Phrase />

      <ul className="w-nums" data-anim aria-label="Il corso in numeri">
        <li><b>60</b><span>lezioni da circa un'ora</span></li>
        <li><b>12</b><span>settimane, 5 lezioni l'una</span></li>
        <li><b>3.000</b><span>parole ed espressioni del lavoro</span></li>
        <li><b>0 €</b><span>niente account, niente pubblicità</span></li>
      </ul>

      <section className="card" data-anim>
        <h2>Come funziona una lezione</h2>
        <p className="muted">Ogni lezione ha nove parti, sempre nello stesso ordine. Si può fermarsi e riprendere quando si vuole: il punto resta salvato.</p>
        <ol className="w-steps">
          {Object.entries(STEP_INFO).map(([k, s]) => (
            <li key={k}><span className="ico" aria-hidden="true">{s.ico}</span><b>{s.label}</b><span className="muted small">{s.min} min</span></li>
          ))}
        </ol>
        <p className="small muted">Poi, ogni giorno: <b>ripasso</b> delle parole (tornano proprio quando si stanno per dimenticare), 10 minuti di <b>allenamento a voce</b> (pronuncia con il punteggio e dialogo con il tutor, con una serie di giorni di fila da non interrompere), <b>simulazioni di lavoro</b> come colloqui, riunioni con i clienti e telefonate, con il pagellino finale e, se si vuole, l'<b>audio-lezione</b> da ascoltare in macchina o a piedi.</p>
      </section>

      <section className="card mt" data-anim>
        <h2>Per chi è</h2>
        <div className="grid grid-2">
          <p><b>Livello di partenza: A2–B1.</b> Pensato per chi ha fatto inglese a scuola o all'università e lo ha un po' arrugginito. Le spiegazioni di grammatica sono in italiano semplice.</p>
          <p><b>Obiettivo: l'inglese del lavoro.</b> Scrivere mail chiare, fare una call, guidare una riunione, presentare un progetto, trattare con un cliente. Inglese vero degli uffici, non da libro.</p>
          <p><b>Si parla dal primo giorno.</b> Voce e microfono sono quelli del dispositivo: si ascolta, si ripete ad alta voce e si controlla la pronuncia. Meglio Chrome, Edge o Safari.</p>
          <p><b>Correzioni con l'AI.</b> Le traduzioni, le mail e le risposte a voce le corregge un'intelligenza artificiale, con la spiegazione degli errori in italiano{quota ? ` (gratis, fino a ${quota.max} correzioni al giorno)` : ' (gratis, con un limite giornaliero)'}.</p>
        </div>
      </section>

      <section className="card mt start" id="partenza" tabIndex={-1} data-anim>
        <h2>Da dove partire?</h2>
        <p className="muted">Le lezioni si possono fare in qualsiasi ordine. Questa scelta decide solo quale lezione proporre per prima; si cambia quando si vuole nelle Opzioni.</p>
        <fieldset className="starts">
          <legend className="sr-only">Punto di partenza</legend>
          {STARTS.map(s => (
            <label key={s.id} className={'start-opt' + (pick === s.id ? ' on' : '')}>
              <input type="radio" name="start" value={s.id} checked={pick === s.id} onChange={() => setPick(s.id)} />
              <span className="lvl">{s.lvl}</span>
              <b>{s.t}</b>
              <span className="small muted">{s.d}</span>
              <span className="small">Si comincia dalla lezione {s.id}</span>
            </label>
          ))}
        </fieldset>
        <div className="row mt">
          <button type="button" className="btn primary" onClick={() => begin(pick)}>{started ? `Vai alla lezione ${pick}` : `Inizia dalla lezione ${pick}`}</button>
          <a className="btn ghost" href="#/" onClick={() => update(s => { s.welcome = true; s.settings.startLesson = pick })}>Vai al piano di oggi</a>
        </div>
      </section>

      <section className="card mt" data-anim>
        <h2>Domande frequenti</h2>
        <h3>È davvero gratis?</h3>
        <p>Sì. Non serve registrarsi e non ci sono pubblicità. Chi vuole può offrire un caffè con il pulsante ☕ in basso: aiuta a pagare il server.</p>
        <h3>Dove restano i progressi?</h3>
        <p>In questo browser, su questo dispositivo. Nelle Opzioni c'è «Scarica una copia» per salvarli o portarli su un altro dispositivo.</p>
        <h3>Quanto tempo serve?</h3>
        <p>Circa un'ora per lezione. Con una lezione al giorno, cinque giorni a settimana, il corso dura 12 settimane. Si può andare più piano: conta la costanza.</p>
        <h3>Funziona sul telefono?</h3>
        <p>Sì, anche sul telefono. Si può aggiungere alla schermata Home dal menu del browser, come un'app.</p>
      </section>
    </div>
  )
}
