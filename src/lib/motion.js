// Animazioni (GSAP) e scroll fluido (Lenis), spenti se il sistema chiede meno movimento.
import { useLayoutEffect } from 'react'
import gsap from 'gsap'
import Lenis from 'lenis'

export const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let lenis = null
export function startSmoothScroll() {
  if (reducedMotion || lenis) return
  lenis = new Lenis({ duration: 1.05, smoothWheel: true })
  gsap.ticker.add(t => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
}
export function scrollTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}
export function scrollToEl(el) {
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset: -80 })
  else el.scrollIntoView({ block: 'start' })
}

// Entrata degli elementi con [data-anim] dentro ref, a cascata
export function useEnter(ref, deps = []) {
  useLayoutEffect(() => {
    if (reducedMotion || !ref.current) return
    const ctx = gsap.context(() => {
      gsap.from('[data-anim]', { y: 18, opacity: 0, duration: .55, ease: 'power3.out', stagger: .05, clearProps: 'all' })
    }, ref)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export { gsap }
