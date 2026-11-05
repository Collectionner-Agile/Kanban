import { animate, motionValue, type MotionValue } from 'motion/react'
import { worldRectOf } from './camera'
import { LANE_INDEX, type LaneId } from '../data/board'
import { findCard, isFull, isHeld, removeGhost, setState, type Face, type Ghost } from '../store/board'

export type PageRect = { x: number; y: number; w: number; h: number }

const LANE_GAP = 8

const pageRect = (el: Element): PageRect => worldRectOf(el)

export const cardEl = (id: string) => document.querySelector(`[data-card="${id}"]`)
export const laneEl = (lane: LaneId) => document.querySelector(`[data-lane="${lane}"]`)

export function cardRect(id: string) {
  const el = cardEl(id)
  return el ? pageRect(el) : null
}

/** Dónde se posa el cursor de una persona: sobre su propio retrato en la nota. */
export function portraitPoint(id: string) {
  const el = cardEl(id)?.querySelector('[data-portrait]')
  if (!el) return null
  const r = pageRect(el)
  return { x: r.x + r.w * 0.62, y: r.y + r.h * 0.62 }
}

/**
 * Centro del lugar libre del carril para una nota de alto `height`. `slot` son las notas que
 * llegan antes al mismo carril: cada una se coloca debajo de la anterior, sin encimarse.
 */
export function laneDropPoint(lane: LaneId, height: number, slot = 0) {
  const el = laneEl(lane)
  if (!el) return null
  const rect = pageRect(el)
  const notes = el.querySelectorAll('[data-card]')
  const last = notes[notes.length - 1]
  const lastRect = last ? pageRect(last) : null
  const list = el.querySelector('ul')
  const start = lastRect ? lastRect.y + lastRect.h + LANE_GAP : list ? pageRect(list).y : rect.y + 110
  return { x: rect.x + rect.w / 2, y: start + slot * (height + LANE_GAP) + height / 2 }
}

export function pickUp(id: string, by: Ghost['by']): Ghost | null {
  const card = findCard(id)
  if (!card || isHeld(id)) return null
  const el = cardEl(id)
  if (!el) return null
  const rect = pageRect(el)
  const ghost: Ghost = {
    id,
    by,
    x: motionValue(rect.x),
    y: motionValue(rect.y),
    w: rect.w,
    h: rect.h,
    from: card.lane,
    target: null,
    landing: false,
  }
  setState((s) => ({ ghosts: [...s.ghosts, ghost] }))
  return ghost
}

/** La curva de dejar algo con cuidado: llega con decisión y frena antes de tocar. */
export const PLACE_EASE = [0.22, 1, 0.36, 1] as const

const glide = (value: MotionValue<number>, to: number, seconds: number) =>
  new Promise<void>((resolve) => {
    animate(value, to, { duration: seconds, ease: PLACE_EASE, onComplete: () => resolve() })
  })

export async function settle(ghost: Ghost, rect: PageRect | null, seconds: number) {
  if (rect) await Promise.all([glide(ghost.x, rect.x, seconds), glide(ghost.y, rect.y, seconds)])
  removeGhost(ghost.id)
}

/** Lo que siente el personaje mientras su nota está en el aire, antes de soltarla. */
export function ghostFace(ghost: Ghost): Face {
  if (!ghost.target || ghost.target === ghost.from) return 'focus'
  if (LANE_INDEX[ghost.target] < LANE_INDEX[ghost.from]) return 'worried'
  if (isFull(ghost.target)) return 'confused'
  return 'happy'
}
