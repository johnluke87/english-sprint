import { useEffect, useRef } from 'react'
import { gsap, reducedMotion } from '../lib/motion.js'

// La sfera della voce: respira quando parla il tutor, segue il volume quando parli tu, gira mentre il tutor pensa.
// È l'unico effetto "forte" della parte a voce; con reduced-motion resta ferma e parla solo l'etichetta.
const LABEL = { idle: 'Pronto', speaking: 'Il tutor parla', listening: 'Ti ascolto', thinking: 'Il tutor pensa', waiting: 'Un attimo…' }

export default function VoiceOrb({ state = 'idle', levelRef, size = 168, label }) {
  const root = useRef(null)
  const core = useRef(null)
  const rings = useRef([])
  const spin = useRef(null)

  useEffect(() => {
    if (reducedMotion || !root.current) return
    const ctx = gsap.context(() => {
      gsap.set([core.current, ...rings.current], { scale: 1, opacity: 1 })
      if (state === 'speaking') {
        gsap.to(core.current, { scale: 1.09, duration: .55, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        rings.current.forEach((r, i) => gsap.fromTo(r, { scale: 1, opacity: .55 }, { scale: 1.55, opacity: 0, duration: 1.8, ease: 'power2.out', repeat: -1, delay: i * .6 }))
      } else if (state === 'thinking' || state === 'waiting') {
        gsap.to(spin.current, { rotate: 360, duration: 1.6, ease: 'none', repeat: -1 })
        gsap.to(core.current, { scale: .94, duration: .8, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      } else if (state === 'listening') {
        const qs = gsap.quickTo(core.current, 'scale', { duration: .12, ease: 'power2.out' })
        const qr = rings.current.map((r, i) => gsap.quickTo(r, 'scale', { duration: .25 + i * .08, ease: 'power2.out' }))
        const tick = () => {
          const l = levelRef?.current || 0
          qs(1 + l * .32)
          qr.forEach((q, i) => q(1 + l * (.35 + i * .25)))
        }
        gsap.ticker.add(tick)
        return () => gsap.ticker.remove(tick)
      }
    }, root)
    return () => ctx.revert()
  }, [state, levelRef])

  return (
    <div className={'orb orb-' + state} ref={root} style={{ '--orb': size + 'px' }}>
      <div className="orb-stage" aria-hidden="true">
        {[0, 1, 2].map(i => <span key={i} className="orb-ring" ref={el => { rings.current[i] = el }} />)}
        <span className="orb-spin" ref={spin} />
        <span className="orb-core" ref={core} />
      </div>
      <div className="orb-label" role="status" aria-live="polite">{label || LABEL[state]}</div>
    </div>
  )
}
