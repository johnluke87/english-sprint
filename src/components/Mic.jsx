import { useRef, useState, useEffect } from 'react'
import { listen, sttSupported } from '../lib/speech.js'

// Pulsante del microfono: tieni premuto o tocca per parlare; restituisce il testo riconosciuto
export default function Mic({ onResult, continuous = false, label = 'Parla' }) {
  const [on, setOn] = useState(false)
  const [partial, setPartial] = useState('')
  const [err, setErr] = useState('')
  const rec = useRef(null)
  useEffect(() => () => rec.current?.stop(), [])

  if (!sttSupported) return <p className="small muted">🎙️ Il riconoscimento vocale funziona in Chrome, Edge e Safari. Qui puoi scrivere la risposta.</p>

  async function toggle() {
    if (on) { rec.current?.stop(); return }
    setErr(''); setPartial(''); setOn(true)
    rec.current = listen({ onPartial: setPartial, continuous })
    try {
      const r = await rec.current.promise
      onResult(r.text, r)
    } catch (e) { setErr(e.message) }
    setOn(false)
  }

  return (
    <div className="center">
      <button type="button" className={'mic' + (on ? ' on' : '')} onClick={toggle} aria-pressed={on} aria-label={on ? 'Ferma la registrazione' : label}>
        <span aria-hidden="true">{on ? '■' : '🎙️'}</span>
      </button>
      <div className="small muted mt" aria-live="polite">{on ? (partial || 'Ti ascolto… parla in inglese') : label}</div>
      {err && <div className="error mt small">{err}</div>}
    </div>
  )
}
