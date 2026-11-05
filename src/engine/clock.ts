import { useSyncExternalStore } from 'react'
import type { Card } from '../data/board'

let offset = 0
/** La hora común. Si el reloj de este equipo está mal, se corrige con la del servidor. */
export const serverNow = () => Date.now() + offset

/** El encabezado Date solo da segundos: por debajo de 2 s el reloj local es mejor que esta lectura. */
export async function syncServerTime() {
  try {
    const before = Date.now()
    const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
    const header = response.headers.get('date')
    if (!header) return
    const server = new Date(header).getTime() + 500
    const difference = server - (before + Date.now()) / 2
    if (Number.isFinite(difference) && Math.abs(difference) > 2000) offset = difference
  } catch {
    // Sin conexión se sigue con el reloj del equipo.
  }
}

/** Un solo reloj para toda la página. Cada componente se redibuja solo si su lectura cambia. */
let now = Date.now()
const listeners = new Set<() => void>()
let timer = 0

function schedule() {
  // Se alinea con el cambio de segundo real, para que el reloj no vaya a saltos desiguales.
  timer = window.setTimeout(() => {
    now = serverNow()
    listeners.forEach((listener) => listener())
    schedule()
  }, 1000 - (serverNow() % 1000) + 4)
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    now = serverNow()
    schedule()
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.clearTimeout(timer)
  }
}

export function useClock<T extends string | number>(read: (now: number) => T): T {
  return useSyncExternalStore(subscribe, () => read(now))
}

export const getNow = () => now

const two = (n: number) => String(n).padStart(2, '0')
export const clockText = (at: number) => {
  const d = new Date(at)
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}
export const hourText = (at: number) => clockText(at).slice(0, 5)
export const dayText = (at: number) => new Date(at).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '')
export const longDayText = (at: number) => new Date(at).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })

/** El saludo sigue la hora real de quien abre el tablero. */
export function greeting(at = Date.now()) {
  const hour = new Date(at).getHours()
  if (hour >= 5 && hour < 12) return 'Buenos días, equipo.'
  if (hour >= 12 && hour < 19) return 'Buenas tardes, equipo.'
  return 'Buenas noches, equipo.'
}

export function spanText(ms: number) {
  const total = Math.round(Math.abs(ms) / 1000)
  if (total < 60) return `${total} s`
  const min = Math.floor(total / 60)
  const sec = total % 60
  if (min >= 60) return `${Math.floor(min / 60)} h ${min % 60} min`
  return sec ? `${min} min ${sec} s` : `${min} min`
}

/* ---------- Tiempo real de cada nota contra lo planificado ---------- */

export type TimeStatus = 'waiting' | 'ok' | 'risk' | 'late' | 'ontime' | 'overtime'

/** Lo planificado para una nota: un tramo base y un tanto por cada punto de esfuerzo. */
export const planFor = (points: number) => 180_000 + points * 40_000

export function statusOf(card: Card, at: number): TimeStatus {
  if (!card.startedAt || !card.dueAt) return 'waiting'
  if (card.doneAt) return card.doneAt <= card.dueAt ? 'ontime' : 'overtime'
  const left = card.dueAt - at
  if (left < 0) return 'late'
  return left < (card.planMs ?? 0) * 0.22 ? 'risk' : 'ok'
}

/**
 * El estado de una nota. Cambia solo, según lo que le pasa:
 * gris sin iniciar, azul en curso, ámbar con algún riesgo, rojo atrasada y verde entregada.
 */
export type HealthState = 'waiting' | 'ontrack' | 'regular' | 'critical' | 'complete'

export function healthOf(card: Card, at: number, blocked = false): HealthState {
  const status = statusOf(card, at)
  if (status === 'waiting') return 'waiting'
  if (status === 'ontime' || status === 'overtime') return 'complete'
  if (status === 'late') return 'critical'
  return status === 'risk' || card.returned || blocked ? 'regular' : 'ontrack'
}

/** Cuánto se adelantó (negativo) o se pasó (positivo) al terminar. */
export const deltaOf = (card: Card) => (card.doneAt && card.dueAt ? card.doneAt - card.dueAt : 0)

/** El estado del sprint en una sola lectura: de aquí saca Clawd su ánimo. */
export function sprintPulse(cards: Card[], lastLane: string, at: number) {
  let done = 0
  let onTime = 0
  let late = 0
  let risk = 0
  for (const card of cards) {
    if (card.lane === lastLane) {
      done += 1
      if (statusOf(card, at) !== 'overtime') onTime += 1
    } else {
      const status = statusOf(card, at)
      if (status === 'late') late += 1
      else if (status === 'risk') risk += 1
    }
  }
  return { total: cards.length, done, onTime, late, risk }
}

/** La semana 1 empezó el lunes 24 de agosto de 2026. Las demás se cuentan desde ahí. */
const WEEK_ONE = new Date(2026, 7, 24).getTime()
export const weekOf = (at: number) => Math.floor((at - WEEK_ONE) / (7 * 24 * 60 * 60 * 1000)) + 1
