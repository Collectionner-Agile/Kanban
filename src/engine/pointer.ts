import type { MotionValue } from 'motion/react'

/**
 * Los personajes miran al puntero cuando pasa cerca. Un solo ciclo lee todas las posiciones y
 * luego escribe: así 20 personajes no provocan 20 mediciones por cada movimiento del ratón.
 */
type Watcher = { el: HTMLElement; x: MotionValue<number>; y: MotionValue<number>; reach: number }

const watchers = new Set<Watcher>()
let pointerX = -1
let pointerY = -1
let scheduled = false

function tick() {
  scheduled = false
  const readings = [...watchers].map((w) => ({ w, r: w.el.getBoundingClientRect() }))
  for (const { w, r } of readings) {
    const dx = pointerX - (r.left + r.width / 2)
    const dy = pointerY - (r.top + r.height * 0.35)
    const distance = Math.hypot(dx, dy)
    if (distance > 340 || pointerX < 0) {
      w.x.set(0)
      w.y.set(0)
      continue
    }
    const strength = Math.min(1, distance / 90) * w.reach
    w.x.set((dx / Math.max(distance, 1)) * strength)
    w.y.set((dy / Math.max(distance, 1)) * strength * 0.7)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (event) => {
      pointerX = event.clientX
      pointerY = event.clientY
      if (!scheduled) {
        scheduled = true
        requestAnimationFrame(tick)
      }
    },
    { passive: true },
  )
}

export function watchPointer(watcher: Watcher) {
  watchers.add(watcher)
  return () => {
    watchers.delete(watcher)
  }
}
