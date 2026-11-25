import { useMemo, useRef, useState } from 'react'
import { useStore, aiQuota, today } from '../lib/store.js'
import { useSyllabus, nextLesson } from '../lib/useCourse.js'
import { useEnter } from '../lib/motion.js'
import { SIMS, SIM_CATS, CHATS } from '../lib/scenarios.js'
import { voiceStreak, bestVoiceStreak, correctPending, DAILY_SECONDS, dueErrors, topErrors, voiceStats } from '../lib/talk.js'
import { duePron } from '../lib/pron.js'
import { canSpeak } from '../lib/voice.js'
import { Trend } from '../components/Report.jsx'

const KIND = { sim: 'Simulazione', free: 'Conversazione', daily: 'Allenamento', lesson: 'Fine lezione' }

// #/parla: la parte a voce del corso (VOCE.md)
export default function Parla() {
  const ref = useRef(null)
  const st = useStore()
  const syl = useSyllabus()
  const quota = useStore(() => aiQuota)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  useEnter(ref, [!!syl])
  const next = nextLesson(st, syl)
  const v = st.voice
  const day = v.days[today()] || { seconds: 0, done: false }
  const streak = voiceStreak(st)
  const best = bestVoiceStreak(st)
  const due = duePron(st).length
  const dueE = dueErrors(st).length
  const stats = voiceStats(st)
  const top = topErrors(st)
  const caso = v.cases?.[today()]
  const recent = v.sessions.slice(-8).reverse()
  const bySim = useMemo(() => {
    const m = {}
    for (const s of v.sessions) if (s.kind === 'sim') (m[s.ref] = m[s.ref] || []).push(s.total)
    return m
  }, [v.sessions])
  const left = quota ? Math.max(0, quota.max - quota.used) : null

  async function fix(p) {
    setBusy(p.id); setMsg('')
    try { await correctPending(p); setMsg('Corretto: il pagellino è aggiornato.') } catch (e) { setMsg(e.message) }
    setBusy('')
  }

  return (
    <div ref={ref}>
      <section className="parla-hero" data-anim>
        <div>
          <div className="eyebrow">Parlare in inglese</div>
          <h1>Parla</h1>
          <p className="muted">Conversazione a voce con il tutor, pronuncia con il punteggio, colloqui e riunioni simulate con il pagellino. Il modo più veloce per sbloccarsi è parlare un po' ogni giorno.</p>
          {!canSpeak && <p className="tip small">Questo browser non permette di usare il microfono: le attività funzionano anche scrivendo, ma per parlare servono Chrome, Edge o Safari.</p>}
        </div>
        <div className="streak-box" aria-label={`${streak} giorni di fila di allenamento a voce`}>
          <b>{streak}</b><span>{streak === 1 ? 'giorno' : 'giorni'} di fila 🔥</span>
          {best > streak && <span className="small muted">record: {best}</span>}
        </div>
      </section>

      <section className={'card daily-card mt' + (day.done ? ' done' : '')} data-anim>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="spacer">
            <h2 style={{ marginBottom: 4 }}>{day.done ? '✓ Allenamento di oggi fatto' : 'Allenamento di oggi · 10 minuti'}</h2>
            <p className="muted small" style={{ margin: 0 }}>Riscaldamento di pronuncia, poi un dialogo a voce sul tema della {next ? `lezione ${next.id}` : 'lezione'}, poi il pagellino. {day.done ? 'Si può rifare quando si vuole.' : 'Fallo ogni giorno per non interrompere la serie.'}</p>
            <div className="progress mt" aria-label={`Oggi ${Math.round(day.seconds / 60)} minuti di 10`}><span style={{ width: Math.min(100, (day.seconds / DAILY_SECONDS) * 100) + '%' }} /></div>
          </div>
          <a className={'btn ' + (day.done ? '' : 'primary')} href="#/parla/oggi">{day.done ? 'Rifai' : 'Inizia'}</a>
        </div>
      </section>

      <div className="grid grid-2 mt" data-anim>
        <section className="card">
          <h2>💬 Conversazione</h2>
          <p className="small muted">Dialogo libero a voce: il tutor adatta il livello alla lezione a cui sei. Correzioni gentili alla fine.</p>
          <div className="chips">
            {next && <a className="btn small primary" href={`#/parla/conversazione?lezione=${next.id}`}>Lezione {next.id}: {next.title}</a>}
            {CHATS.map(c => <a key={c.id} className="btn small" href={`#/parla/conversazione?s=${c.id}`}>{c.t}</a>)}
          </div>
          <p className="small muted mt">Preferisci scrivere? <a href={next ? `#/tutor?lezione=${next.id}` : '#/tutor'}>Tutor in chat</a>.</p>
        </section>
        <section className="card">
          <h2>🗣️ Pronuncia</h2>
          <p className="small muted">Ripeti la frase e ricevi un punteggio con le parole colorate. Riascolta la tua voce e quella giusta, anche lenta. Non usa l'AI: illimitata.</p>
          <div className="row">
            <a className="btn small primary" href="#/parla/pronuncia">Allenati</a>
            {due > 0 && <a className="btn small" href="#/parla/pronuncia/ripasso">Ripasso: {due} {due === 1 ? 'parola' : 'parole'}</a>}
            {dueE > 0 && <a className="btn small" href="#/parla/pronuncia/errori">Errori da correggere: {dueE}</a>}
          </div>
        </section>
        <section className="card">
          <h2>🎧 Ascolto</h2>
          <p className="small muted">Frasi di lavoro dette veloci, con accenti diversi (britannico, americano e altri, se il dispositivo li ha). Scrivi quello che capisci. Non usa l'AI.</p>
          <a className="btn small primary" href="#/parla/ascolto">Allena l'orecchio</a>
        </section>
        <section className="card">
          <h2>🎲 Caso del giorno</h2>
          <p className="small muted">{caso ? <><b>{caso.t}</b>: {caso.d}</> : 'Il tutor inventa una situazione di lavoro nuova ogni giorno, sul tema della lezione.'}</p>
          <a className="btn small primary" href="#/parla/caso">{caso ? 'Vai al caso' : 'Crea il caso di oggi'}</a>
        </section>
      </div>

      <section className="card mt colloquio-card" data-anim>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="spacer">
            <h2 style={{ marginBottom: 4 }}>💼 Il mio colloquio in inglese</h2>
            <p className="small muted" style={{ margin: 0 }}>{v.profile?.answers?.length ? `Risposte pronte per: ${v.profile.data?.target || 'il tuo ruolo'}. Allenale a voce e simula il colloquio.` : 'Scrivi il tuo profilo: il tutor prepara le risposte alle 8 domande classiche con la tua esperienza vera, poi le alleni a voce.'}</p>
          </div>
          <a className="btn primary" href="#/parla/colloquio">{v.profile?.answers?.length ? 'Allena' : 'Prepara'}</a>
        </div>
      </section>

      <section className="card mt" data-anim>
        <h2>🎭 Simulazioni di lavoro</h2>
        <p className="small muted">Il tutor recita la parte (selezionatore, cliente, collega). Alla fine il pagellino con fluidità, vocabolario, grammatica e obiettivo: rifacendole, il punteggio sale.</p>
        {Object.entries(SIM_CATS).map(([cat, name]) => (
          <div key={cat} className="mt">
            <h3 className="small-h">{name}</h3>
            <div className="scenarios">
              {SIMS.filter(s => s.cat === cat).map(s => {
                const h = bySim[s.id]
                return (
                  <a key={s.id} className="scenario" href={`#/parla/simulazione/${s.id}`}>
                    <b><span aria-hidden="true">{s.ico}</span> {s.t}</b>
                    <span className="small muted">{s.d}</span>
                    {h && <span className="small"><b>{h[h.length - 1]}/100</b> · {h.length} {h.length === 1 ? 'volta' : 'volte'}{h.length > 1 && ` · ${h[h.length - 1] - h[0] >= 0 ? '+' : ''}${h[h.length - 1] - h[0]}`}</span>}
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {stats.count >= 2 && (
        <section className="card mt" data-anim>
          <h2>📊 I tuoi progressi a voce</h2>
          <p className="small muted">{stats.count} pagellini · {stats.minutes} minuti di allenamento a voce{stats.wpm ? ` · velocità media ${stats.wpm} parole al minuto` : ''}. Media degli ultimi 10 pagellini{stats.dims.some(d => d.before != null) ? ', confrontata con i 10 prima' : ''}:</p>
          <div className="rep-bars">
            {stats.dims.map(d => (
              <div key={d.k} className="rep-row">
                <div className="row" style={{ gap: 6 }}><b>{({ fluency: 'Fluidità', vocabulary: 'Vocabolario', grammar: 'Grammatica', task: 'Obiettivo' })[d.k]}</b><span className="spacer" /><b>{d.now == null ? '—' : d.now + '/10'}</b>{d.now != null && d.before != null && <span className={'small ' + (d.now >= d.before ? 'up' : 'down')}>{d.now >= d.before ? '▲' : '▼'} {Math.abs(Math.round((d.now - d.before) * 10) / 10)}</span>}</div>
                <div className="rep-bar"><i style={{ width: (d.now || 0) * 10 + '%' }} /></div>
              </div>
            ))}
          </div>
          <Trend totals={stats.totals} />
          {top.length > 0 && <>
            <h3 className="mt">Gli errori che ripeti</h3>
            {top.map((e, i) => <div className="err" key={i}><span className="w" lang="en">{e.wrong}</span> → <span className="r" lang="en">{e.right}</span> <span className="pill">×{e.count}</span>{e.whyIt && <div className="small muted">{e.whyIt}</div>}</div>)}
            <a className="btn small mt" href="#/parla/pronuncia/errori">Ripassali a voce</a>
          </>}
        </section>
      )}

      {v.pending.length > 0 && (
        <section className="card mt" data-anim>
          <h2>Dialoghi da correggere</h2>
          <p className="small muted">Finiti quando le risposte AI erano esaurite: hanno il pagellino dell'app. La correzione completa (grammatica, errori, frasi migliori) usa 1 risposta AI.</p>
          {v.pending.map(p => (
            <div key={p.id} className="todo">
              <div className="spacer"><b>{p.title}</b><div className="small muted">{p.day}</div></div>
              <button className="btn small" disabled={!!busy} onClick={() => fix(p)}>{busy === p.id ? 'Correggo…' : '🤖 Correggi'}</button>
            </div>
          ))}
          {msg && <p className="small mt" role="status">{msg}</p>}
        </section>
      )}

      {recent.length > 0 && (
        <section className="card mt" data-anim>
          <h2>Gli ultimi pagellini</h2>
          {recent.map(s => (
            <div key={s.id} className="todo">
              <div className="n">{s.total}</div>
              <div className="spacer"><b>{s.title}</b><div className="small muted">{KIND[s.kind] || ''} · {s.day}{s.ai ? '' : ' · senza AI'}</div></div>
              {s.kind === 'sim' && bySim[s.ref]?.length > 1 && <Trend totals={bySim[s.ref]} />}
            </div>
          ))}
        </section>
      )}

      <p className="small muted mt">{left != null ? `Risposte AI rimaste oggi: ${left} su ${quota.max}. ` : ''}La pronuncia non le usa; un dialogo ne usa da 4 a 7. Quando finiscono, i dialoghi continuano con domande già pronte.</p>
    </div>
  )
}
