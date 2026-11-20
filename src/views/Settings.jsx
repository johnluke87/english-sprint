import { useEffect, useState } from 'react'
import { useStore, update, exportJson, importJson, syncStatus, account } from '../lib/store.js'
import { STARTS } from '../lib/useCourse.js'
import { onVoices, voicesFor, speak, ttsSupported, sttSupported } from '../lib/speech.js'

export default function Settings() {
  const s = useStore(x => x.settings)
  const [, setV] = useState(0)
  const [msg, setMsg] = useState('')
  useEffect(() => onVoices(() => setV(n => n + 1)), [])
  const en = voicesFor('en'), it = voicesFor('it')
  const set = (k, v) => update(st => { st.settings[k] = v })
  const acc = useStore(() => account)
  useStore(() => syncStatus)

  const sel = (key, list, test, lang) => (
    <div className="row" style={{ flexWrap: 'nowrap' }}>
      <select value={s[key] || ''} onChange={e => set(key, e.target.value)} id={key}>
        <option value="">Automatica (la migliore trovata)</option>
        {list.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
      </select>
      <button className="btn small" type="button" onClick={() => speak(test, { lang, voice: key === 'voiceEn2' ? 2 : 1 })}>Prova</button>
    </div>
  )

  return (
    <div>
      <div className="eyebrow">Impostazioni</div>
      <h1>Opzioni</h1>
      <section className="card">
        <h2>Voci</h2>
        {!ttsSupported && <p className="error">Questo browser non ha la sintesi vocale.</p>}
        <p className="small muted">Le voci sono quelle del tuo dispositivo, gratis. Le più naturali: su PC usa <b>Microsoft Edge</b> (voci "Online (Natural)"); su Android Chrome con le voci Google; su iPhone scarica le voci "Avanzate" in Impostazioni → Accessibilità → Contenuto letto.</p>
        <label htmlFor="voiceEn">Voce inglese principale</label>
        {sel('voiceEn', en, 'Hi! I have just sent you the updated quote.', 'en')}
        <label htmlFor="voiceEn2" className="mt" style={{ display: 'block' }}>Seconda voce inglese (dialoghi)</label>
        {sel('voiceEn2', en, 'Thanks, I will check it and get back to you.', 'en')}
        <label htmlFor="voiceIt" className="mt" style={{ display: 'block' }}>Voce italiana (spiegazioni)</label>
        {sel('voiceIt', it, 'Ciao! Oggi impariamo il present perfect.', 'it')}
        <label htmlFor="rate" className="mt" style={{ display: 'block' }}>Velocità: {Math.round((s.rate || 1) * 100)}%</label>
        <input id="rate" type="range" min=".6" max="1.3" step=".05" value={s.rate || 1} onChange={e => set('rate', Number(e.target.value))} style={{ width: '100%' }} />
        <p className="small muted mt">Microfono: {sttSupported ? '✓ disponibile' : '✗ non disponibile in questo browser (usa Chrome, Edge o Safari)'}</p>
      </section>
      <section className="card">
        <h2>Studio</h2>
        <label htmlFor="goal">Obiettivo giornaliero: {s.dailyGoal || 60} minuti</label>
        <input id="goal" type="range" min="15" max="120" step="5" value={s.dailyGoal || 60} onChange={e => set('dailyGoal', Number(e.target.value))} style={{ width: '100%' }} />
        <label htmlFor="start" className="mt" style={{ display: 'block' }}>Punto di partenza (la prima lezione proposta)</label>
        <select id="start" value={s.startLesson || 1} onChange={e => set('startLesson', Number(e.target.value))}>
          {STARTS.map(o => <option key={o.id} value={o.id}>{o.t} ({o.lvl}): dalla lezione {o.id}</option>)}
        </select>
        <label className="row mt" style={{ gap: 8, fontWeight: 500 }}><input type="checkbox" checked={s.showPron !== false} onChange={e => set('showPron', e.target.checked)} /> Mostra la pronuncia scritta all'italiana</label>
      </section>
      <section className="card">
        <h2>I tuoi progressi</h2>
        {acc === 'logged'
          ? <p className="small muted">Si salvano da soli anche nell'account, così si ritrovano su telefono e PC. Stato: {syncStatus === 'saved' ? 'salvati ✓' : syncStatus === 'offline' ? 'non in linea, li salvo appena torna la rete' : syncStatus === 'saving' ? 'salvo…' : 'in attesa'}.</p>
          : <p className="small muted">Si salvano da soli <b>in questo browser</b>, su questo dispositivo: niente account. Se si cancellano i dati del browser si perdono, quindi ogni tanto conviene scaricarne una copia. Per continuare su un altro dispositivo: «Scarica una copia» qui e «Carica una copia» là (le due copie si uniscono, non si perde niente).</p>}
        <div className="row">
          <button className="btn small" onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }))
            a.download = 'english-sprint-progressi.json'; a.click()
          }}>Scarica una copia</button>
          <label className="btn small">Carica una copia<input type="file" accept="application/json" hidden onChange={async e => {
            const f = e.target.files[0]; if (!f) return
            try { importJson(await f.text()); setMsg('Progressi caricati ✓') } catch (er) { setMsg('Errore: ' + er.message) }
          }} /></label>
        </div>
        {msg && <p className="mt" role="status">{msg}</p>}
        {acc === 'guest' && <p className="small muted mt">Chi ha un account di accesso: <a href="../?next=english-sprint/">accedi</a> per sincronizzare i progressi.</p>}
      </section>
    </div>
  )
}
