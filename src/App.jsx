import { useEffect, useState } from 'react'
import { useStore, initAccount, pullFromServer, tickStudyTime, resetTick, syncStatus, account } from './lib/store.js'
import { setSpeechSettings } from './lib/speech.js'
import { dueKeys } from './lib/srs.js'
import { scrollTop } from './lib/motion.js'
import Home from './views/Home.jsx'
import Course from './views/Course.jsx'
import Lesson from './views/Lesson.jsx'
import Review from './views/Review.jsx'
import Tutor from './views/Tutor.jsx'
import Glossary from './views/Glossary.jsx'
import Settings from './views/Settings.jsx'
import AudioLesson from './views/AudioLesson.jsx'
import Welcome from './views/Welcome.jsx'
import Parla from './views/Parla.jsx'
import { Simulazione, Conversazione, Pronuncia, Allenamento } from './views/ParlaPagine.jsx'
import { Colloquio, Ascolto, Caso } from './views/ParlaExtra.jsx'

// Rotte con # (la pagina vera è una sola: pagina.php). Alla prima visita la home è la presentazione.
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '')
  const [path, query] = h.split('?')
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query || '') }
}

export function go(to) { location.hash = to }

const NAV = [
  ['', 'Oggi', '☀️'],
  ['corso', 'Corso', '🗺️'],
  ['ripasso', 'Ripasso', '🔁'],
  ['parla', 'Parla', '🎙️'],
  ['parole', 'Parole', '📖'],
  ['impostazioni', 'Opzioni', '⚙️'],
]

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const settings = useStore(s => s.settings)
  const due = useStore(s => dueKeys(s).length)
  const welcomed = useStore(s => s.welcome)
  useStore(() => syncStatus)
  const acc = useStore(() => account)

  useEffect(() => {
    const on = () => { setRoute(parseHash()); scrollTop() }
    window.addEventListener('hashchange', on)
    initAccount()
    const t = setInterval(tickStudyTime, 15000)
    const vis = () => { if (document.visibilityState === 'visible') { resetTick(); pullFromServer() } }
    document.addEventListener('visibilitychange', vis)
    return () => { window.removeEventListener('hashchange', on); clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [])

  useEffect(() => { setSpeechSettings(settings) }, [settings])

  const [p0, p1, p2] = route.parts
  let view
  if (!p0) view = welcomed ? <Home /> : <Welcome />
  else if (p0 === 'presentazione') view = <Welcome />
  else if (p0 === 'corso') view = <Course />
  else if (p0 === 'lezione' && p1) view = <Lesson id={Number(p1)} step={p2 || ''} key={p1} />
  else if (p0 === 'audio' && p1) view = <AudioLesson id={Number(p1)} key={p1} />
  else if (p0 === 'ripasso') view = <Review mode={p1 || 'due'} />
  else if (p0 === 'parla' && p1 === 'simulazione' && p2) view = <Simulazione id={p2} key={p2} />
  else if (p0 === 'parla' && p1 === 'conversazione') view = <Conversazione lessonId={Number(route.query.get('lezione')) || 0} chatId={route.query.get('s') || ''} key={location.hash} />
  else if (p0 === 'parla' && p1 === 'pronuncia') view = <Pronuncia tab={p2 || ''} key={p2 || 'p'} />
  else if (p0 === 'parla' && p1 === 'oggi') view = <Allenamento />
  else if (p0 === 'parla' && p1 === 'colloquio') view = <Colloquio />
  else if (p0 === 'parla' && p1 === 'ascolto') view = <Ascolto />
  else if (p0 === 'parla' && p1 === 'caso') view = <Caso />
  else if (p0 === 'parla') view = <Parla />
  else if (p0 === 'tutor') view = <Tutor lessonId={Number(route.query.get('lezione')) || 0} />
  else if (p0 === 'parole') view = <Glossary />
  else if (p0 === 'impostazioni') view = <Settings />
  else view = <Home />

  const syncLabel = acc === 'logged' ? { saving: 'Salvo…', saved: 'Salvato ✓', offline: 'Non in linea: salvo dopo', idle: '' }[syncStatus] : ''
  const legal = (e, page) => { if (window.gdLegal) { e.preventDefault(); window.gdLegal(page) } }

  return (
    <>
      <a className="skip" href="#contenuto" onClick={e => { e.preventDefault(); document.getElementById('contenuto')?.focus() }}>Vai al contenuto</a>
      <header className="topbar">
        <a className="brand" href="#/"><img src="./icon.svg" alt="" />English Sprint</a>
        <span className="sync" role="status">{syncLabel}</span>
        <nav className="nav" aria-label="Menu principale">
          {NAV.map(([to, label, ico]) => (
            <a key={to} href={'#/' + to} aria-current={(p0 || '') === to || (to === 'corso' && (p0 === 'lezione' || p0 === 'audio')) || (to === 'parla' && p0 === 'tutor') ? 'page' : undefined}>
              <i className="ico" aria-hidden="true">{ico}</i>{label}
              {to === 'ripasso' && due > 0 && <span className="badge" aria-label={`${due} da ripassare`}>{due}</span>}
            </a>
          ))}
        </nav>
      </header>
      <main id="contenuto" tabIndex={-1}>{view}</main>
      <footer className="foot">
        <p><b>English Sprint</b> è un corso gratuito di <a href="https://kindwarelab.it/">Kindware Lab</a>: niente account, niente pubblicità. {acc === 'logged' ? 'I progressi si salvano anche nel tuo account.' : 'I progressi restano in questo browser.'}</p>
        <nav aria-label="Informazioni">
          <a href="#/presentazione">Cos'è English Sprint</a>
          <a href="#/corso">Le 60 lezioni</a>
          <a href="https://www.gianlucadario.com/apps/supporto/privacy.php?app=english-sprint" onClick={e => legal(e, 'privacy')}>Privacy</a>
          <a href="https://www.gianlucadario.com/apps/supporto/cookie.php?app=english-sprint" onClick={e => legal(e, 'cookie')}>Cookie</a>
          <a href="https://www.gianlucadario.com/apps/supporto/?app=english-sprint" onClick={e => legal(e, 'scrivimi')}>Scrivici</a>
          <a href="https://ko-fi.com/KindwareLab" target="_blank" rel="noopener">Offri un caffè <span className="sr-only">(si apre in una nuova scheda)</span></a>
        </nav>
      </footer>
    </>
  )
}
