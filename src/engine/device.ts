/**
 * Una página web no puede escribir dentro de la Dynamic Island: eso es de apps nativas (Live Activities).
 * Lo que sí puede es saber dónde está y nacer de ella, para que el aviso se lea como la misma isla.
 */
export type HardwareIsland = { top: number; standalone: boolean }

export const SENSOR_W = 126
export const SENSOR_H = 37

/** Estos altos de pantalla son los iPhone con muesca. De ahí para arriba, con 3x, ya es isla. */
const NOTCH_HEIGHTS = new Set([812, 844, 896, 926])

function detect(): HardwareIsland | null {
  const forced = new URLSearchParams(window.location.search).get('isla')
  if (forced === 'no') return null
  const nav = navigator as Navigator & { standalone?: boolean }
  const standalone = forced === 'app' || nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  const long = Math.max(window.screen.width, window.screen.height)
  const short = Math.min(window.screen.width, window.screen.height)
  const isIphone = /iPhone/.test(navigator.userAgent) && window.devicePixelRatio >= 3 && long >= 852 && !NOTCH_HEIGHTS.has(long)
  if (!isIphone && forced !== 'iphone' && forced !== 'app') return null
  // Instalada, la página llega hasta el sensor. En Safari empieza debajo de la barra de estado.
  return { top: standalone ? (short >= 402 ? 14 : 11) : 6, standalone }
}

export const HARDWARE_ISLAND = detect()

if (HARDWARE_ISLAND) document.documentElement.dataset.hwIsland = HARDWARE_ISLAND.standalone ? 'app' : 'browser'
