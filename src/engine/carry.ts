import { animate, motionValue, type MotionValue } from 'motion/react'
import { markInput, panBy, stageBox, toWorld, worldRectOf } from './camera'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { LANE, LANE_INDEX, NEXT, PREVIOUS, type LaneId } from '../data/board'
import type { PersonId } from '../data/team'
import { planFor } from './clock'
import {
  findCard,
  flashLane,
  getState,
  isActive,
  isFull,
  isHeld,
  lanesNow,
  progressOf,
  react,
  removeGhost,
  notify,
  setGhost,
  setState,
  tidy,
  type Face,
  type Ghost,
} from '../store/board'

export type PageRect = { x: number; y: number; w: number; h: number }

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

/** Punto libre del carril: justo debajo de la última nota. */
export function laneDropPoint(lane: LaneId) {
  const el = laneEl(lane)
  if (!el) return null
  const rect = pageRect(el)
  const notes = el.querySelectorAll('[data-card]')
  const last = notes[notes.length - 1]
  const lastRect = last ? pageRect(last) : null
  const y = lastRect ? lastRect.y + lastRect.h + 60 : rect.y + 110
  return { x: rect.x + rect.w / 2, y: Math.min(y, rect.y + rect.h - 12) }
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
    from: card.lane,
    target: null,
    landing: false,
  }
  setState((s) => ({ ghosts: [...s.ghosts, ghost] }))
  return ghost
}

const nextFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

const glide = (value: MotionValue<number>, to: number, seconds: number) =>
  new Promise<void>((resolve) => {
    animate(value, to, { type: 'spring', visualDuration: seconds, bounce: 0, onComplete: () => resolve() })
  })

async function settle(ghost: Ghost, rect: PageRect | null, seconds: number) {
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

/**
 * Suelta la nota en un carril. Es el único camino de cualquier movimiento, tuyo o de un agente:
 * así las reglas de WIP y las reacciones son las mismas para todos. La reacción llega al aterrizar,
 * para que la causa se vea antes que el efecto.
 */
export async function land(ghost: Ghost, to: LaneId | null, actor: PersonId | 'user'): Promise<boolean> {
  const live = getState().ghosts.find((g) => g.id === ghost.id)
  if (!live) return false // El viaje entre pisos ya la devolvió a su sitio.
  const card = findCard(ghost.id)
  const seconds = actor === 'user' ? 0.42 : 0.7
  setGhost(ghost.id, { target: null, landing: true, airFace: ghostFace(live) })

  if (!card || !to || to === ghost.from) {
    await settle(ghost, cardRect(ghost.id), seconds)
    return false
  }

  if (isFull(to)) {
    flashLane(to)
    notify({ who: actor, owner: card.owner, kind: 'full', card: card.id, title: card.title, from: ghost.from, to })
    await settle(ghost, cardRect(ghost.id), seconds)
    react(card.id, 'huh')
    return false
  }

  const movingBack = LANE_INDEX[to] < LANE_INDEX[ghost.from]

  const ended = LANE[to].kind === 'end'
  const moment = Date.now()
  const planMs = card.planMs ?? planFor(card.points)
  const startedAt = card.startedAt ?? (LANE_INDEX[to] > 0 ? moment : undefined)
  const dueAt = card.dueAt ?? (startedAt ? startedAt + planMs : undefined)
  const doneAt = ended ? moment : undefined
  setState((s) => ({
    cards: [
      ...s.cards.filter((c) => c.id !== card.id),
      { ...card, lane: to, returned: movingBack, returns: card.returns + (movingBack ? 1 : 0), planMs, startedAt, dueAt, doneAt },
    ],
  }))

  const progress = progressOf(card.id)
  if (ended) progress.set(1)
  else if (isActive(to) || movingBack) progress.set(0)

  notify({ who: actor, owner: card.owner, kind: ended ? 'done' : movingBack ? 'back' : 'move', card: card.id, title: card.title, from: ghost.from, to, deltaMs: ended && dueAt ? moment - dueAt : undefined })

  await nextFrames()
  const rect = cardRect(card.id)
  await settle(ghost, rect, seconds)

  react(card.id, ended ? 'done' : movingBack ? 'down' : 'up')

  tidy()
  return true
}

/** Mover con teclado o con las flechas de la nota: misma animación, sin arrastrar. */
export async function nudge(id: string, step: 1 | -1) {
  const card = findCard(id)
  if (!card) return
  const to = step > 0 ? NEXT[card.lane] : PREVIOUS[card.lane]
  if (!to) return
  const ghost = pickUp(id, 'user')
  if (!ghost) return
  await land(ghost, to, 'user')
  cardEl(id)?.querySelector<HTMLElement>('[data-note]')?.focus({ preventScroll: true })
}

function laneAt(clientX: number, clientY: number): LaneId | null {
  for (const lane of lanesNow()) {
    const el = laneEl(lane.id)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top - 90 && clientY <= r.bottom + 220) {
      return lane.id
    }
  }
  return null
}

/**
 * Arrastre con eventos de puntero. Con ratón se activa al moverse 5 px; con dedo pide una
 * pulsación de 220 ms para que deslizar el tablero siga funcionando.
 */
export function beginDrag(event: ReactPointerEvent, id: string) {
  if (event.button !== 0 || isHeld(id) || getState().scene !== 'live') return
  const startX = event.clientX
  const startY = event.clientY
  const isTouch = event.pointerType === 'touch'
  let ghost: Ghost | null = null
  let target: LaneId | null = null
  let offsetX = 0
  let offsetY = 0
  let lastX = startX
  let lastY = startY
  let frame = 0

  const blockScroll = (e: TouchEvent) => {
    if (ghost) e.preventDefault()
  }

  const place = () => {
    if (!ghost) return
    const point = toWorld(lastX, lastY)
    ghost.x.set(point.x - offsetX)
    ghost.y.set(point.y - offsetY)
    const over = laneAt(lastX, lastY)
    if (over !== target) {
      target = over
      setGhost(ghost.id, { target })
    }
  }

  const autoScroll = () => {
    if (ghost) {
      // Cerca del borde, la cámara acompaña a la nota.
      markInput()
      const r = stageBox()
      const edge = 70
      if (r && lastX < r.left + edge) panBy(8, 0)
      else if (r && lastX > r.right - edge) panBy(-8, 0)
      place()
    }
    frame = requestAnimationFrame(autoScroll)
  }

  const activate = () => {
    ghost = pickUp(id, 'user')
    if (!ghost) {
      cleanup()
      return
    }
    const grab = toWorld(startX, startY)
    offsetX = grab.x - ghost.x.get()
    offsetY = grab.y - ghost.y.get()
    markInput()
    document.body.classList.add('is-dragging')
    window.addEventListener('touchmove', blockScroll, { passive: false })
    frame = requestAnimationFrame(autoScroll)
    place()
  }

  const timer = isTouch ? window.setTimeout(activate, 220) : 0

  const onMove = (e: PointerEvent) => {
    lastX = e.clientX
    lastY = e.clientY
    if (ghost) {
      place()
      return
    }
    const moved = Math.hypot(lastX - startX, lastY - startY)
    if (isTouch) {
      if (moved > 8) cleanup()
    } else if (moved > 5) {
      activate()
    }
  }

  const finish = (drop: boolean) => {
    const held = ghost
    const to = target
    cleanup()
    if (held) void land(held, drop ? to : null, 'user')
  }

  const onUp = () => finish(true)
  const onCancel = () => finish(false)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish(false)
  }

  function cleanup() {
    window.clearTimeout(timer)
    cancelAnimationFrame(frame)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('touchmove', blockScroll)
    document.body.classList.remove('is-dragging')
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
}
