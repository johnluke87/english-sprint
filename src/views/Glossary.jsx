import { useEffect, useMemo, useState } from 'react'
import { loadLessons } from '../lib/content.js'
import { useSyllabus } from '../lib/useCourse.js'
import { SayBoth } from '../components/Speak.jsx'
import { useStore } from '../lib/store.js'

// Tutte le parole del corso, con ricerca in italiano o in inglese
export default function Glossary() {
  const syl = useSyllabus()
  const srs = useStore(s => s.srs)
  const [all, setAll] = useState(null)
  const [q, setQ] = useState('')
  const [only, setOnly] = useState('all')

  useEffect(() => {
    if (!syl) return
    loadLessons([...syl.available]).then(ls => {
      const out = []
      Object.values(ls).sort((a, b) => a.id - b.id).forEach(l => {
        l.words.forEach((w, i) => out.push({ ...w, lid: l.id, key: `${l.id}:${i}` }))
        l.phrases.forEach(p => out.push({ en: p.en, it: p.it, type: 'frase', lid: l.id, key: null, ex: p.note || '' }))
      })
      setAll(out)
    })
  }, [syl])

  const list = useMemo(() => {
    if (!all) return []
    const t = q.trim().toLowerCase()
    return all.filter(w => {
      if (only === 'studied' && !(w.key && srs[w.key])) return false
      if (only === 'phrases' && w.type !== 'frase') return false
      return !t || w.en.toLowerCase().includes(t) || w.it.toLowerCase().includes(t)
    }).slice(0, 300)
  }, [all, q, only, srs])

  return (
    <div>
      <div className="eyebrow">Dizionario del corso</div>
      <h1>Parole ed espressioni</h1>
      <div className="row mb">
        <label htmlFor="gq" className="sr-only">Cerca</label>
        <input id="gq" type="text" placeholder="Cerca in italiano o in inglese…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <div className="tabs" style={{ margin: 0 }}>
          <button aria-pressed={only === 'all'} onClick={() => setOnly('all')}>Tutto</button>
          <button aria-pressed={only === 'studied'} onClick={() => setOnly('studied')}>Studiate</button>
          <button aria-pressed={only === 'phrases'} onClick={() => setOnly('phrases')}>Frasi</button>
        </div>
      </div>
      {!all ? <div className="loading">Carico le parole…</div> : <>
        <p className="small muted">{list.length === 300 ? 'Primi 300 risultati' : `${list.length} risultati`} · in tutto {all.length} voci</p>
        <div className="wordlist">
          {list.map((w, i) => (
            <div className="word" key={i}>
              <span className="pill">L{w.lid}</span>
              <div>
                <div><span className="en" lang="en">{w.en}</span> {w.pron && <span className="pr">/{w.pron}/</span>}</div>
                <div className="it">{w.it}</div>
                {w.ex && <div className="ex" lang={w.type === 'frase' ? 'it' : 'en'}>{w.ex}</div>}
              </div>
              <SayBoth text={w.en} />
            </div>
          ))}
        </div>
      </>}
    </div>
  )
}
