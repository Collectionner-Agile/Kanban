import { getState, setState } from '../store/board'

/**
 * Calidad automática: si el equipo no da abasto, el tablero se aligera solo (sin desenfoques, sin
 * puntos de fondo, sin gestos de los personajes). Prioriza que todo se mueva fluido.
 */
const SLOW_FRAME_MS = 30
const WINDOW = 90
const STRIKES = 2

function apply() {
  document.documentElement.dataset.quality = 'lite'
  setState({ lite: true })
}

const weakDevice = () => {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  return (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) || navigator.hardwareConcurrency <= 2 || nav.connection?.saveData === true
}

export function startQuality() {
  if (new URLSearchParams(window.location.search).get('calidad') === 'alta') return () => {}
  if (weakDevice() || new URLSearchParams(window.location.search).get('calidad') === 'ligera') {
    apply()
    return () => {}
  }
  let frames: number[] = []
  let strikes = 0
  let last = performance.now()
  let id = 0

  const tick = (now: number) => {
    const delta = now - last
    last = now
    // Una pestaña oculta o un salto grande no dicen nada sobre la fluidez.
    if (delta < 250 && !document.hidden && getState().scene === 'live') frames.push(delta)
    if (frames.length >= WINDOW) {
      const sorted = [...frames].sort((a, b) => a - b)
      strikes = sorted[Math.floor(WINDOW / 2)] > SLOW_FRAME_MS ? strikes + 1 : 0
      frames = []
      if (strikes >= STRIKES) return apply()
    }
    id = requestAnimationFrame(tick)
  }
  id = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(id)
}
