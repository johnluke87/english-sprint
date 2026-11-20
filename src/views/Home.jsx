import { useRef } from 'react'
import { useStore, streak, today, STEPS } from '../lib/store.js'
import { dueKeys, learnedCount } from '../lib/srs.js'
import { useSyllabus, nextLesson, STEP_INFO } from '../lib/useCourse.js'
import { useEnter } from '../lib/motion.js'

function Ring({ value, goal }) {
  const pct = Math.min(1, value / goal)
  const r = 64, c = 2 * Math.PI * r
  return (
    <div className="ring" role="img" aria-label={`Oggi ${value} minuti su ${goal}`}>
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--paper-2)" strokeWidth="12" />
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="lbl" aria-hidden="true"><div><b>{value}</b><span className="small muted">di {goal} min</span></div></div>
    </div>
  )
}

export default function Home() {
  const ref = useRef(null)
  const st = useStore()
  const syl = useSyllabus()
  useEnter(ref, [!!syl])
  const day = st.days[today()] || { seconds: 0, reviews: 0, xp: 0 }
  const minutes = Math.round(day.seconds / 60)
  const due = dueKeys(st).length
  const next = nextLesson(st, syl)
  const nextState = next ? st.lessons[next.id] : null
  const nextStep = next ? STEPS.find(k => !nextState?.steps?.[k]) || 'video' : null
  const completed = Object.values(st.lessons).filter(l => l.completedAt).length
  const doneToday = Object.values(st.lessons).filter(l => l.completedAt === today()).length
  const dayN = Math.max(1, Math.round((new Date(today()) - new Date(st.startedAt)) / 86400000) + 1)
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div ref={ref}>
      <section className="hero" data-anim>
        <div>
          <div className="eyebrow">Giorno {dayN} · settimana {Math.ceil(dayN / 7)}</div>
          <h1>{hello}! <span className="muted" style={{ fontWeight: 400 }}>Iniziamo?</span></h1>
          <p className="muted">Un'ora al giorno: ripasso, una lezione nuova, conversazione con il tutor. Dodici settimane per passare dalle basi alle riunioni in inglese. <a href="#/presentazione">Come funziona il corso</a></p>
        </div>
        <Ring value={minutes} goal={st.settings.dailyGoal || 60} />
      </section>

      <div className="stats mt2" data-anim>
        <div className="stat"><b>{streak(st)} 🔥</b><span>giorni di fila</span></div>
        <div className="stat"><b>{learnedCount(st)}</b><span>parole imparate</span></div>
        <div className="stat"><b>{completed}/60</b><span>lezioni finite</span></div>
        <div className="stat"><b>{day.xp}</b><span>punti oggi</span></div>
      </div>

      <section className="card mt2" data-anim>
        <h2>Il piano di oggi</h2>
        <div className={'todo' + (due === 0 ? ' done' : '')}>
          <div className="n">1</div>
          <div className="spacer">
            <b>Ripasso delle parole</b> <span className="muted small">· circa {Math.max(5, Math.min(15, Math.ceil(due / 5)))} min</span>
            <div className="small muted">{due ? `${due} parole da ripassare oggi: tornano proprio quando stai per dimenticarle.` : 'Niente da ripassare: ottimo!'}</div>
          </div>
          {due > 0 && <a className="btn primary small" href="#/ripasso">Ripassa</a>}
        </div>
        <div className={'todo' + (doneToday ? ' done' : '')}>
          <div className="n">2</div>
          <div className="spacer">
            {next ? <>
              <b>Lezione {next.id}: {next.title}</b> <span className="muted small">· circa 60 min</span>
              <div className="small muted">{nextState ? `Riprendi da: ${STEP_INFO[nextStep].label}` : `Grammatica: ${next.grammar}`}</div>
            </> : <b>{syl ? 'Hai finito tutte le lezioni disponibili!' : 'Carico il corso…'}</b>}
          </div>
          {next && <a className="btn primary small" href={`#/lezione/${next.id}/${nextStep}`}>{nextState ? 'Continua' : 'Inizia'}</a>}
        </div>
        <div className="todo">
          <div className="n">3</div>
          <div className="spacer">
            <b>Conversazione con il tutor AI</b> <span className="muted small">· 10 min</span>
            <div className="small muted">Parli (o scrivi) in inglese, lui risponde a voce e ti corregge.</div>
          </div>
          <a className="btn small" href={next ? `#/tutor?lezione=${next.id}` : '#/tutor'}>Parla</a>
        </div>
        {next && <div className="todo">
          <div className="n">🎧</div>
          <div className="spacer">
            <b>Extra: audio-lezione</b>
            <div className="small muted">Ascolta parole, frasi e dialogo in macchina o a piedi.</div>
          </div>
          <a className="btn small" href={`#/audio/${next.id}`}>Ascolta</a>
        </div>}
      </section>

      <section className="card mt" data-anim>
        <h3>Come funziona il metodo</h3>
        <div className="grid grid-2 small">
          <p><b>Ripetizione dilazionata.</b> Le parole tornano dopo 1, 3, 7, 15… giorni: il cervello le fissa con il minimo sforzo. Il ripasso quotidiano è la parte più importante.</p>
          <p><b>Imparare in frasi.</b> Ogni parola ha un esempio di lavoro; le espressioni fatte ti danno frasi pronte da usare subito nelle mail e nelle call.</p>
          <p><b>Parlare dal giorno uno.</b> Ripeti ad alta voce (shadowing) e il microfono ti dice cosa ha capito. Il tutor AI ti fa fare conversazione vera.</p>
          <p><b>Correzione immediata.</b> Le traduzioni e le mail che scrivi le corregge l'AI, spiegando gli errori in italiano.</p>
        </div>
      </section>
    </div>
  )
}
