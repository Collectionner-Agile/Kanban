import { animate, motionValue } from 'motion/react'
import type { LaneId } from '../data/board'
import { HARDWARE_ISLAND } from './device'
import { getState, setFocus } from '../store/board'
import { serverNow } from './clock'
import { localTime, scriptFor } from './script'

/**
 * La cámara del tablero. Todo lo que está dentro del mundo (notas, cursores, notas en el aire)
 * usa coordenadas del mundo, así la cámara puede moverse sin descuadrar a nadie.
 */
export const cam = { x: motionValue(0), y: motionValue(0), scale: motionValue(1) }

const stageEl = () => document.querySelector<HTMLElement>('[data-stage]')
const worldEl = () => document.querySelector<HTMLElement>('[data-world]')

export const stageBox = () => stageEl()?.getBoundingClientRect() ?? null

export function toWorld(clientX: number, clientY: number) {
  const s = stageBox()
  const scale = cam.scale.get()
  return {
    x: (clientX - (s?.left ?? 0) - cam.x.get()) / scale,
    y: (clientY - (s?.top ?? 0) - cam.y.get()) / scale,
  }
}

export function worldRectOf(el: Element) {
  const r = el.getBoundingClientRect()
  const scale = cam.scale.get()
  const a = toWorld(r.left, r.top)
  return { x: a.x, y: a.y, w: r.width / scale, h: r.height / scale }
}

/** Lo que tapa el historial a la derecha: la cámara encuadra en el espacio que queda libre. */
let insetRight = 0
let insetBottom = 0
export const setCameraInset = (right: number, bottom: number) => {
  insetRight = right
  insetBottom = bottom
}
const viewWidth = (stage: HTMLElement) => Math.max(320, stage.clientWidth - insetRight)
const viewHeight = (stage: HTMLElement) => Math.max(240, stage.clientHeight - insetBottom)

/** Alto que ocupan los controles de arriba, y relleno superior del mundo. */
const TOP_CLEAR = 76
const WORLD_TOP_PAD = 88

function clamped(x: number, y: number, scale: number) {
  const stage = stageEl()
  const world = worldEl()
  if (!stage || !world) return { x, y, scale }
  const W = world.offsetWidth * scale
  const H = world.offsetHeight * scale
  const SW = viewWidth(stage)
  const SH = viewHeight(stage)
  return {
    x: W <= SW ? (SW - W) / 2 : Math.min(0, Math.max(SW - W, x)),
    y: H <= SH ? Math.max(TOP_CLEAR - WORLD_TOP_PAD * scale, (SH - H) / 2 - 40) : Math.min(0, Math.max(SH - H, y)),
    scale,
  }
}

let flights: Array<{ stop: () => void }> = []

function stopFlights() {
  flights.forEach((f) => f.stop())
  flights = []
}

/** Viaje de cámara: responde al instante y frena suave, sin rebote. */
export function flyCamera(x: number, y: number, scale: number, seconds = 0.5) {
  stopFlights()
  const to = clamped(x, y, scale)
  const options = { duration: seconds, ease: [0.16, 1, 0.3, 1] as const }
  flights = [animate(cam.x, to.x, options), animate(cam.y, to.y, options), animate(cam.scale, to.scale, options)]
}

/** Vuelve a acomodar el encuadre actual dentro del espacio libre. */
export function refit(seconds = 0.45) {
  flyCamera(cam.x.get(), cam.y.get(), cam.scale.get(), seconds)
}

/** Encuadra un rectángulo del mundo en el centro de la pantalla. */
export function frame(rect: { x: number; y: number; w: number; h: number }, zoom: number, seconds?: number) {
  const stage = stageEl()
  if (!stage) return
  const x = viewWidth(stage) / 2 - (rect.x + rect.w / 2) * zoom
  const y = viewHeight(stage) * (HARDWARE_ISLAND && stage.clientWidth < stage.clientHeight ? 0.52 : 0.46) - (rect.y + rect.h / 2) * zoom
  flyCamera(x, y, zoom, seconds)
}

/** Escala del plano general. En el celular no caben los carriles: se queda en una escala legible. */
export function overviewScale() {
  const stage = stageEl()
  const world = worldEl()
  if (!stage || !world) return 1
  if (stage.clientWidth < 700) return 0.9
  return Math.min(1, viewWidth(stage) / world.offsetWidth)
}

/** Plano general: todos los carriles a la vista. */
export function overview(seconds = 0.55) {
  flyCamera(0, 0, overviewScale(), seconds)
}

export function setCameraNow(x: number, y: number, scale: number) {
  stopFlights()
  const to = clamped(x, y, scale)
  cam.x.set(to.x)
  cam.y.set(to.y)
  cam.scale.set(to.scale)
}

export function panBy(dx: number, dy: number) {
  stopFlights()
  const to = clamped(cam.x.get() + dx, cam.y.get() + dy, cam.scale.get())
  cam.x.set(to.x)
  cam.y.set(to.y)
}

export function zoomAt(clientX: number, clientY: number, factor: number) {
  const stage = stageBox()
  if (!stage) return
  stopFlights()
  const before = toWorld(clientX, clientY)
  const scale = Math.min(1.5, Math.max(0.4, cam.scale.get() * factor))
  const to = clamped(clientX - stage.left - before.x * scale, clientY - stage.top - before.y * scale, scale)
  cam.x.set(to.x)
  cam.y.set(to.y)
  cam.scale.set(to.scale)
}

/** Lleva la cámara a un carril: es lo que hace un clic en el mapa. */
export function goToLane(id: LaneId) {
  const lane = document.querySelector(`[data-lane="${id}"]`)
  if (lane) frame(worldRectOf(lane), 1, 0.4)
}

/** Desde el historial: lleva a la nota y deja su carril en foco. */
export function goToCard(id: string) {
  const el = document.querySelector(`[data-card="${id}"]`)
  const card = getState().cards.find((c) => c.id === id)
  markInput()
  if (!el || !card) return
  frame(worldRectOf(el), 1, 0.45)
  setFocus([card.lane])
}

/* ---------- El director: decide qué plano mostrar ---------- */

let lastInput = -Infinity

/** Tu gesto manda: mientras interactúas, la cámara no se mueve sola. */
export function markInput() {
  lastInput = performance.now()
  setFocus(null)
}

const HANDS_OFF_MS = 7000
const PHONE_WIDTH = 700
const PHONE_ZOOM = 0.9

/** Los planos están en el guion: todas las pantallas miran lo mismo en el mismo momento. */
export function startDirector() {
  let current = -1
  let wasPhone = false

  const tick = () => {
    const now = performance.now()
    const { cameraOn, sprint, liveSprint } = getState()
    if (!cameraOn || document.hidden || now - lastInput < HANDS_OFF_MS) {
      current = -1
      return
    }
    if (sprint !== liveSprint) {
      if (current !== -2) {
        overview()
        setFocus(null)
        current = -2
      }
      return
    }
    const local = localTime(sprint, serverNow())
    const stage = stageEl()
    const phone = !!stage && stage.clientWidth < PHONE_WIDTH
    const script = scriptFor(sprint)
    const shots = phone ? script.phoneShots : script.shots
    if (phone !== wasPhone) {
      wasPhone = phone
      current = -1
    }
    let index = -1
    for (let i = shots.length - 1; i >= 0; i--) {
      if (shots[i].at <= local) {
        index = i
        break
      }
    }
    if (index === current || index < 0) return
    current = index
    const shot = shots[index]
    if (shot.kind === 'overview') {
      overview()
      setFocus(null)
    } else if (shot.kind === 'close') {
      const el = document.querySelector(`[data-card="${shot.card}"]`)
      if (el) {
        // En el teléfono, siempre a la misma escala: la nota se queda donde cayó, sin saltos de zoom.
        frame(worldRectOf(el), phone ? PHONE_ZOOM : 1.22, phone ? 0.8 : undefined)
        setFocus([shot.lane])
      }
    } else if (shot.kind === 'follow') {
      const lane = document.querySelector(`[data-lane="${shot.to}"]`)
      const note = document.querySelector(`[data-card="${shot.card}"]`)
      if (lane && note) {
        const to = worldRectOf(lane)
        const from = worldRectOf(note)
        // Apunta a donde va a caer, no a donde estaba: así al soltarla la cámara ya no tiene que subir ni bajar.
        const inLane = [...lane.querySelectorAll('[data-card]')].filter((c) => (c as HTMLElement).dataset.card !== shot.card)
        const below = inLane.length ? worldRectOf(inLane[inLane.length - 1]) : null
        const landing = below ? below.y + below.h + 10 : to.y + 56
        frame({ x: to.x, y: landing, w: to.w, h: from.h }, PHONE_ZOOM, Math.max(0.8, shot.ms / 1000))
        setFocus([shot.from, shot.to])
      }
    } else if (stage) {
      const lane = document.querySelector(`[data-lane="${shot.to}"]`)
      const note = document.querySelector(`[data-card="${shot.card}"]`)
      if (lane && note) {
        const to = worldRectOf(lane)
        const from = worldRectOf(note)
        const left = Math.min(from.x, to.x)
        const right = Math.max(from.x + from.w, to.x + to.w)
        const top = Math.min(from.y, to.y)
        const zoom = Math.max(0.6, Math.min(1.1, (viewWidth(stage) * 0.82) / (right - left)))
        frame({ x: left, y: top, w: right - left, h: 320 }, zoom)
        setFocus([shot.from, shot.to])
      }
    }
  }

  const timer = window.setInterval(tick, 100)
  return () => {
    window.clearInterval(timer)
    setFocus(null)
  }
}
