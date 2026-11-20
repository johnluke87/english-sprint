import { useRef } from 'react'
import { useStore, STEPS } from '../lib/store.js'
import { useLesson, STEP_INFO, lessonProgress } from '../lib/useCourse.js'
import { useEnter } from '../lib/motion.js'
import { stop } from '../lib/speech.js'
import VideoPlayer from '../components/VideoPlayer.jsx'
import WordsStep from '../steps/WordsStep.jsx'
import GrammarStep from '../steps/GrammarStep.jsx'
import PhrasesStep from '../steps/PhrasesStep.jsx'
import DialogueStep from '../steps/DialogueStep.jsx'
import TranslateStep from '../steps/TranslateStep.jsx'
import WritingStep from '../steps/WritingStep.jsx'
import SpeakingStep from '../steps/SpeakingStep.jsx'
import { markStep } from '../lib/store.js'

export default function Lesson({ id, step }) {
  const ref = useRef(null)
  const { lesson, error } = useLesson(id)
  const st = useStore()
  useEnter(ref, [!!lesson, step])
  if (error) return <div className="error">{error}. <a href="#/corso">Torna al corso</a></div>
  if (!lesson) return <div className="loading">Carico la lezione {id}…</div>

  const L = st.lessons[id] || { steps: {}, scores: {} }
  const cur = STEPS.includes(step) ? step : ''
  const idx = STEPS.indexOf(cur)
  const nextStep = STEPS[idx + 1]
  const goNext = () => { stop(); location.hash = nextStep ? `#/lezione/${id}/${nextStep}` : `#/lezione/${id}` }
  const done = (score) => markStep(id, cur, score)

  const props = { lesson, done, goNext, isDone: !!L.steps[cur], id }
  const body = {
    video: <VideoPlayer lesson={lesson} onEnd={() => done()} />,
    words: <WordsStep {...props} />,
    grammar: <GrammarStep {...props} />,
    phrases: <PhrasesStep {...props} />,
    dialogue: <DialogueStep {...props} />,
    translate: <TranslateStep {...props} />,
    writing: <WritingStep {...props} />,
    speaking: <SpeakingStep {...props} />,
  }[cur]

  return (
    <div ref={ref}>
      <div className="lesson-head" data-anim>
        <div className="eyebrow">Lezione {id} · settimana {lesson.week} · {lessonProgress(st, id)}% fatto</div>
        <h1>{lesson.title}</h1>
        <p className="muted" lang="en" style={{ marginTop: -6 }}>{lesson.titleEn}</p>
      </div>

      <nav className="steps" aria-label="Parti della lezione" data-anim>
        <button type="button" aria-current={!cur ? 'step' : undefined} onClick={() => { stop(); location.hash = `#/lezione/${id}` }}>
          <span className="s1">Inizio</span><span className="s2">obiettivi</span>
        </button>
        {STEPS.map(k => (
          <button key={k} type="button" className={L.steps[k] ? 'done' : ''} aria-current={cur === k ? 'step' : undefined}
            onClick={() => { stop(); location.hash = `#/lezione/${id}/${k}` }}>
            <span className="s1">{STEP_INFO[k].ico} {STEP_INFO[k].label}</span><span className="s2">{STEP_INFO[k].min} min{L.scores[k] != null ? ` · ${L.scores[k]}%` : ''}</span>
          </button>
        ))}
      </nav>

      {!cur ? (
        <div className="grid grid-2" data-anim>
          <section className="card">
            <h2>Oggi impari</h2>
            <p>{lesson.intro}</p>
            <ul>{lesson.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
            <div className="row mt">
              <a className="btn primary" href={`#/lezione/${id}/${STEPS.find(k => !L.steps[k]) || 'video'}`}>{Object.keys(L.steps).length ? 'Continua' : 'Inizia la lezione'}</a>
              <a className="btn" href={`#/audio/${id}`}>🎧 Audio-lezione</a>
            </div>
          </section>
          <section className="card">
            <h2>Il percorso (circa 60 minuti)</h2>
            {STEPS.map((k, i) => (
              <div key={k} className={'todo' + (L.steps[k] ? ' done' : '')}>
                <div className="n">{L.steps[k] ? '✓' : i + 1}</div>
                <a className="spacer" href={`#/lezione/${id}/${k}`} style={{ color: 'inherit' }}>{STEP_INFO[k].ico} {STEP_INFO[k].label}</a>
                <span className="small muted">{STEP_INFO[k].min} min</span>
              </div>
            ))}
          </section>
        </div>
      ) : (
        <div data-anim key={cur}>
          {body}
          <div className="row mt2">
            {cur === 'video' && !L.steps.video && <button className="btn" onClick={() => done()}>Segna come vista</button>}
            <span className="spacer" />
            <button className="btn primary" onClick={goNext}>{nextStep ? `Avanti: ${STEP_INFO[nextStep].label} →` : 'Fine lezione ✓'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
