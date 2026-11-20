import { useRef } from 'react'
import { useStore } from '../lib/store.js'
import { useSyllabus, lessonProgress, nextLesson } from '../lib/useCourse.js'
import { useEnter } from '../lib/motion.js'

export default function Course() {
  const ref = useRef(null)
  const st = useStore()
  const syl = useSyllabus()
  useEnter(ref, [!!syl])
  if (!syl) return <div className="loading">Carico il corso…</div>
  const next = nextLesson(st, syl)
  const done = Object.values(st.lessons).filter(l => l.completedAt).length

  return (
    <div ref={ref}>
      <div data-anim>
        <div className="eyebrow">60 lezioni · 12 settimane · 3.000 parole</div>
        <h1>Il corso</h1>
        <p className="muted">Mese 1: le basi solide del lavoro. Mese 2: riunioni, presentazioni e scrittura. Mese 3: parlare in modo naturale, convincere, livello pro. Puoi fare le lezioni in qualsiasi ordine.</p>
        <div className="progress" aria-label={`${done} lezioni finite su 60`}><span style={{ width: `${(done / 60) * 100}%` }} /></div>
      </div>
      {syl.weeks.map(w => (
        <section key={w.week} className="week" data-anim>
          <h3>Settimana {w.week}: {w.title} <small>{w.titleEn}</small></h3>
          <div className="lessons">
            {syl.lessons.filter(l => l.week === w.week).map(l => {
              const ok = syl.available.has(l.id)
              const pr = lessonProgress(st, l.id)
              const cls = 'ltile' + (st.lessons[l.id]?.completedAt ? ' done' : '') + (!ok ? ' missing' : '') + (next?.id === l.id ? ' next' : '')
              return (
                <a key={l.id} className={cls} href={ok ? `#/lezione/${l.id}` : undefined} aria-disabled={!ok || undefined}
                  title={ok ? l.grammar : 'In preparazione'}>
                  <span className="num">{String(l.id).padStart(2, '0')}</span>
                  <span className="t">{l.title}</span>
                  {!ok ? <span className="small muted">in arrivo</span> : <span className="bar" aria-label={`${pr}% fatto`}><span style={{ width: pr + '%' }} /></span>}
                </a>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
