import { useEffect, useState } from 'react'
import { speak, stop } from '../lib/speech.js'

// Pulsante ▶ che legge un testo (inglese di default)
export function Say({ text, lang = 'en', voice = 1, rate, small, label }) {
  const [on, setOn] = useState(false)
  useEffect(() => () => { if (on) stop() }, [on])
  return (
    <button type="button" className={'play' + (small ? ' sm' : '')} aria-label={label || `Ascolta: ${text}`}
      onClick={async e => {
        e.stopPropagation()
        if (on) { stop(); setOn(false); return }
        setOn(true)
        await speak(text, { lang, voice, rate })
        setOn(false)
      }}>
      <span aria-hidden="true">{on ? '■' : rate && rate < 1 ? '🐢' : '▶'}</span>
    </button>
  )
}

// Due pulsanti: normale e lento
export function SayBoth({ text }) {
  return (
    <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <Say text={text} small />
      <Say text={text} small rate={0.7} label={`Ascolta lento: ${text}`} />
    </span>
  )
}
