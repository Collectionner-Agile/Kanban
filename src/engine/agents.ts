import { animate } from 'motion/react'
import { LANE, NEXT, reworkLane, type Card, type LaneId } from '../data/board'
import { TEAM, type PersonId } from '../data/team'
import {
  countIn,
  cursors,
  findCard,
  flashLane,
  getState,
  isHeld,
  lanesNow,
  progressOf,
  setAgent,
  setGhost,
  setWorking,
} from '../store/board'
import { cardRect, land, laneDropPoint, pickUp, portraitPoint } from './carry'

type Control = { stopped: boolean }

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
const between = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const paused = () => !getState().agentsOn || document.hidden

async function untilAllowed(ctl: Control) {
  while (paused() && !ctl.stopped) await sleep(250)
}

const flights = new Map<PersonId, () => void>()

/**
 * Vuela por una curva, a paso de persona: despacio y sin frenar en seco. Un vuelo nuevo cancela
 * el anterior del mismo cursor, nunca se pelean por la misma posición.
 */
function fly(person: PersonId, x: number, y: number, options: { pace?: number; seconds?: number } = {}) {
  flights.get(person)?.()
  const cursor = cursors[person]
  const x0 = cursor.x.get()
  const y0 = cursor.y.get()
  const distance = Math.hypot(x - x0, y - y0)
  const duration = options.seconds ?? clamp(distance / 360, 0.9, 2.8) * (options.pace ?? 1)
  const bend = clamp(distance * 0.12, 0, 60) * (Math.random() < 0.5 ? -1 : 1)
  const cx = (x0 + x) / 2 - ((y - y0) / Math.max(distance, 1)) * bend
  const cy = (y0 + y) / 2 + ((x - x0) / Math.max(distance, 1)) * bend

  return new Promise<void>((resolve) => {
    const flight = animate(0, 1, {
      duration,
      ease: [0.42, 0, 0.18, 1],
      onUpdate: (t) => {
        const u = 1 - t
        cursor.x.set(u * u * x0 + 2 * u * t * cx + t * t * x)
        cursor.y.set(u * u * y0 + 2 * u * t * cy + t * t * y)
      },
      onComplete: () => resolve(),
    })
    flights.set(person, () => {
      flight.stop()
      resolve()
    })
  })
}

/** Espacios ya prometidos: dos agentes nunca van a la vez por el último lugar de un carril. */
const reserved = new Map<LaneId, number>()
const hasRoom = (lane: LaneId) => {
  const limit = LANE[lane].wip
  return limit === null || countIn(lane) + (reserved.get(lane) ?? 0) < limit
}

const VERB: Partial<Record<LaneId, string>> = {
  analysis: 'analiza',
  ux: 'diseña',
  prototype: 'prototipa',
  dev: 'desarrolla',
  review: 'pasa revisión',
  qa: 'prueba',
  demo: 'presenta',
  refined: 'refina',
  build: 'mejora',
  integrate: 'integra',
  regress: 'comprueba',
  accept: 'valida',
  deploy: 'despliega',
}

/** Trabajar es quedarse sobre su nota mientras la barra avanza. Se suelta si alguien la mueve. */
async function work(person: PersonId, card: Card, ms: number, ctl: Control) {
  setAgent(person, { label: '' })
  const point = portraitPoint(card.id)
  if (point) await fly(person, point.x, point.y)
  if (ctl.stopped) return false
  setAgent(person, { label: VERB[card.lane] ?? 'trabaja' })
  setWorking(person, card.id)

  const progress = progressOf(card.id)
  let last = performance.now()
  let drift = last + 900

  while (progress.get() < 1 && !ctl.stopped) {
    await sleep(110)
    const now = performance.now()
    const current = findCard(card.id)
    if (!current || current.lane !== card.lane || isHeld(card.id)) break
    if (!paused()) {
      progress.set(Math.min(1, progress.get() + (now - last) / ms))
      const p = portraitPoint(card.id)
      const cursor = cursors[person]
      if (p && Math.hypot(p.x - cursor.x.get(), p.y - cursor.y.get()) > 44) {
        void fly(person, p.x, p.y, { seconds: 0.4 })
        drift = now + 900
      } else if (p && now > drift) {
        // Se mueve poco y siempre junto a su retrato, sin irse a otra nota.
        void fly(person, p.x + between(-4, 20), p.y + between(-6, 6), { seconds: between(1.8, 2.8) })
        drift = now + between(2600, 3800)
      }
    }
    last = now
  }

  setWorking(person, null)
  return progress.get() >= 1
}

async function carry(person: PersonId, card: Card, to: LaneId, verb: string, ctl: Control) {
  reserved.set(to, (reserved.get(to) ?? 0) + 1)
  setAgent(person, { going: { card: card.id, to } })
  try {
    return await carryNow(person, card, to, verb, ctl)
  } finally {
    reserved.set(to, Math.max(0, (reserved.get(to) ?? 1) - 1))
    setAgent(person, { going: null })
  }
}

async function carryNow(person: PersonId, card: Card, to: LaneId, verb: string, ctl: Control) {
  setAgent(person, { label: '' })
  const rect = cardRect(card.id)
  const point = portraitPoint(card.id)
  if (!rect || !point) return false
  await fly(person, point.x, point.y)
  if (ctl.stopped || isHeld(card.id)) return false
  setAgent(person, { label: `${verb} ${LANE[to].name}` })

  setAgent(person, { pressed: true })
  await sleep(320)
  if (ctl.stopped) {
    setAgent(person, { pressed: false })
    return false
  }
  const ghost = pickUp(card.id, person)
  if (!ghost) {
    setAgent(person, { pressed: false })
    return false
  }
  setGhost(card.id, { target: to })
  await sleep(240)

  const cursor = cursors[person]
  const offsetX = cursor.x.get() - ghost.x.get()
  const offsetY = cursor.y.get() - ghost.y.get()
  const stop = [
    cursor.x.on('change', (v) => ghost.x.set(v - offsetX)),
    cursor.y.on('change', (v) => ghost.y.set(v - offsetY)),
  ]

  const drop = laneDropPoint(to)
  if (drop) await fly(person, drop.x + offsetX - ghost.w / 2, drop.y + offsetY - rect.h / 2, { pace: 1.35 })
  stop.forEach((off) => off())
  if (ctl.stopped) {
    setAgent(person, { pressed: false })
    return false
  }
  await sleep(200)

  setAgent(person, { pressed: false })
  const moved = await land(ghost, to, person)
  setAgent(person, { label: 'disponible' })
  return moved
}

async function waitForRoom(person: PersonId, next: LaneId, ctl: Control) {
  setAgent(person, { label: `espera ${LANE[next].name}` })
  flashLane(next)
  for (let i = 0; i < 16 && !hasRoom(next) && !ctl.stopped; i++) await sleep(200)
  setAgent(person, { label: 'disponible' })
}

/**
 * Cada cursor toca únicamente las notas de su propia persona: el de Brenda solo mueve las de Brenda.
 * Regla de pull: primero termina lo que está más a la derecha, y solo después jala trabajo nuevo.
 */
async function act(person: PersonId, ctl: Control) {
  const mine = getState().cards.filter((c) => c.owner === person && !isHeld(c.id))
  const rightToLeft = [...lanesNow()].reverse()

  for (const lane of rightToLeft.filter((l) => l.kind === 'work' || l.kind === 'check')) {
    const card = mine.find((c) => c.lane === lane.id)
    if (!card) continue
    const ms = lane.kind === 'check' ? between(4200, 6500) : between(6000, 9500)
    if (progressOf(card.id).get() < 1 && !(await work(person, card, ms, ctl))) return
    if (ctl.stopped || isHeld(card.id)) return

    if (lane.kind === 'check') {
      const rework = reworkLane(lane.id)
      if (rework && Math.random() < 0.18 && card.returns < 2 && hasRoom(rework)) {
        await carry(person, card, rework, 'regresa a', ctl)
        return
      }
    }
    const next = NEXT[lane.id]
    if (!next) return
    if (!hasRoom(next)) await waitForRoom(person, next, ctl)
    else await carry(person, card, next, 'lleva a', ctl)
    return
  }

  for (const lane of rightToLeft.filter((l) => l.kind === 'queue')) {
    const next = NEXT[lane.id]
    const card = mine.find((c) => c.lane === lane.id)
    if (!card || !next || !hasRoom(next)) continue
    await carry(person, card, next, 'lleva a', ctl)
    return
  }

  // Sin trabajo posible: se queda cerca de su última nota, sin tocar las de otros.
  setAgent(person, { label: 'disponible' })
  const own = mine[mine.length - 1]
  const rect = own ? cardRect(own.id) : null
  const point = own ? portraitPoint(own.id) : null
  if (rect && point) await fly(person, point.x + between(6, 30), point.y + between(-4, 8), { pace: 1.4 })
  await sleep(between(2400, 4200))
}

async function run(person: PersonId, index: number, ctl: Control) {
  await sleep(300 + index * 520)
  if (ctl.stopped) return

  // Cada cursor nace sobre una nota de su dueño.
  const own = getState().cards.find((c) => c.owner === person)
  const start = own ? portraitPoint(own.id) : null
  cursors[person].x.set(start ? start.x : window.innerWidth / 2)
  cursors[person].y.set(start ? start.y : window.innerHeight / 2)
  setAgent(person, { ready: true })
  await sleep(500)

  while (!ctl.stopped) {
    await untilAllowed(ctl)
    if (ctl.stopped) return
    await act(person, ctl)
    await sleep(between(900, 2000))
  }
}

export function startAgents() {
  const ctl: Control = { stopped: false }
  TEAM.forEach((person, index) => void run(person.id, index, ctl))

  return () => {
    ctl.stopped = true
    reserved.clear()
    TEAM.forEach((person) => {
      flights.get(person.id)?.()
      flights.delete(person.id)
      setAgent(person.id, { ready: false, pressed: false, label: 'disponible' })
    })
  }
}
