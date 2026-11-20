import { Say } from './Speak.jsx'

// Risultato della correzione AI (scrittura e parlato)
export default function AiFeedback({ fb }) {
  if (!fb) return null
  return (
    <div className="ai-box" role="status">
      <div className="row"><span className="score">{fb.score}/10</span><span className="spacer" /><span className="pill accent">Correzione AI</span></div>
      <p className="mt">{fb.summaryIt}</p>
      {fb.errors?.length > 0 && <>
        <h3>Errori</h3>
        {fb.errors.map((e, i) => (
          <div className="err" key={i}><span className="w" lang="en">{e.wrong}</span> → <span className="r" lang="en">{e.right}</span><div className="small muted">{e.whyIt}</div></div>
        ))}
      </>}
      {fb.corrected && <>
        <h3 className="mt">Il tuo testo corretto</h3>
        <pre className="model" lang="en">{fb.corrected}</pre>
      </>}
      {fb.better && <>
        <div className="row mt"><h3 style={{ margin: 0 }}>Come lo direbbe un madrelingua</h3><Say text={fb.better} small /></div>
        <pre className="model mt" lang="en">{fb.better}</pre>
      </>}
      {fb.newWords?.length > 0 && <>
        <h3 className="mt">Parole utili</h3>
        <ul>{fb.newWords.map((w, i) => <li key={i}><b lang="en">{w.en}</b> = {w.it}</li>)}</ul>
      </>}
    </div>
  )
}
