import { useMemo } from 'react'
import { lessonTalk } from '../lib/scenarios.js'
import Conversation from '../components/Conversation.jsx'

// Ultima parte di ogni lezione: dialogo a voce di 4 battute sugli argomenti della lezione, con il pagellino
export default function TalkStep({ lesson, done, isDone }) {
  const cfg = useMemo(() => lessonTalk(lesson, { kind: 'lesson', maxTurns: 4 }), [lesson])
  return (
    <div>
      <section className="card mb">
        <h2>Dialogo a voce</h2>
        <p className="muted" style={{ margin: 0 }}>Per chiudere la lezione: 4 risposte a voce al tutor, sul tema di oggi. Prova a usare le parole e le frasi della lezione: il pagellino dice quali hai usato.{isDone ? ' (Parte già fatta: si può rifare quando si vuole.)' : ''}</p>
      </section>
      <Conversation cfg={cfg} onFinish={s => done(s.total)} />
      {!isDone && <p className="small muted mt">Se il microfono non va, si può rispondere scrivendo (tasto «Scrivi» durante il dialogo).</p>}
    </div>
  )
}
