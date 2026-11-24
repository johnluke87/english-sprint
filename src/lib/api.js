// Chiamate alle API PHP (api/index.php?r=...). L'app è pubblica: senza account si usa tutto,
// con l'account del portale /apps/ (il suo cookie viaggia da solo) i progressi si sincronizzano anche sul server.
export class ApiError extends Error {
  constructor(msg, status, limit) { super(msg); this.status = status; this.limit = limit }
}

export async function api(route, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`api/index.php?r=${encodeURIComponent(route)}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json', 'X-Requested-With': 'english-sprint' } : { 'X-Requested-With': 'english-sprint' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    throw new ApiError('Manca la connessione a internet: riprova quando torna.', 0)
  }
  let data = null
  try { data = await res.json() } catch (e) { /* risposta non JSON */ }
  if (!res.ok) {
    let msg = (data && data.error) || (res.status >= 500 ? 'Il server non risponde: riprova tra poco.' : 'Errore (' + res.status + ')')
    if (!data && !navigator.onLine) msg = 'Manca la connessione a internet: riprova quando torna.'
    throw new ApiError(msg, res.status, data && data.limit)
  }
  return data
}

// Correzione con l'AI (Groq, gratis, con un tetto giornaliero): kind = writing | translation | speaking | chat | explain
export const hooks = { onAi: null } // lo imposta store.js: conta le correzioni usate oggi
// Il server ne accetta 6 al minuto per IP: se nell'ultimo minuto ne sono già partite 6, aspetto il momento giusto
// invece di sbattere contro il limite (onWait(secondi) per dirlo nella pagina)
const recent = []
export async function aiSlot(onWait) {
  const now = Date.now()
  while (recent.length && now - recent[0] > 60000) recent.shift()
  if (recent.length >= 6) {
    const ms = recent[0] + 60500 - now
    onWait?.(Math.ceil(ms / 1000))
    await new Promise(r => setTimeout(r, ms))
    recent.shift()
  }
  recent.push(Date.now())
}

export async function ai(kind, payload, { onWait } = {}) {
  await aiSlot(onWait)
  try {
    const r = await api('ai', { method: 'POST', body: { kind, ...payload } })
    hooks.onAi?.(true)
    return r
  } catch (e) {
    if (e.status === 429) hooks.onAi?.(false, e.limit)
    throw e
  }
}
