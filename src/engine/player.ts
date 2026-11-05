import { animate } from 'motion/react'
import type { LaneId, SprintId } from '../data/board'
import { TEAM, type PersonId } from '../data/team'
import {
  cursors,
  flashLane,
  getDestination,
  getState,
  isIslandHeld,
  isDismissed,
  progressOf,
  react,
  removeGhost,
  setAgent,
  setGhost,
  setState,
  travelTo,
  type Activity,
  type Ghost,
} from '../store/board'
import { PLACE_EASE, cardRect, ghostFace, laneDropPoint, pickUp, portraitPoint, settle } from './carry'
import { serverNow } from './clock'
import { currentLocalAlert, haltNotes, localActivity, localFor, tickNotes } from './localNotes'
import { TRANSITION_MS, activeSprint, boardAt, clockAt, localTime, phraseFor, progressAt, scriptFor, type Land, type Seg } from './script'

/**
 * El reproductor: lleva a la pantalla lo que el guion dice para esta hora. Quien entra tarde cae
 * en el minuto exacto; lo único propio de cada pantalla es cómo se ve, nunca lo que pasa.
 */
const OPEN_MS = 650
const PLACE_SECONDS = 0.55
const ENTER_MS = 1000
const PEEK_MS = 25_000
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

let peek: { sprint: SprintId; until: number } | null = null

/** Tocar la otra pestaña deja mirarla un momento; después vuelve a lo que va en vivo. */
export function peekSprint(sprint: SprintId) {
  const now = serverNow()
  const { T, loop } = clockAt(now)
  peek = sprint === activeSprint(T) ? null : { sprint, until: now + PEEK_MS }
  const phrases = phraseFor(sprint, loop)
  return travelTo(sprint, phrases, 2400)
}

type Attached = { stop: () => void; offsetX: number; offsetY: number }
const flights = new Map<PersonId, () => void>()
const attached = new Map<PersonId, Attached>()
const applied = new Map<PersonId, number>()
const drifted = new Map<PersonId, number>()
/** Quienes están dejando una nota: siguen presionando hasta que toca su sitio. */
const settling = new Set<PersonId>()
let appliedLands = -1
let stopped = true
let lastTick = 0
let lastActivity = ''
let lastAlert = ''
let lastPointCheck = 0
let beat = 0

const nextFrames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

function fly(person: PersonId, x: number, y: number, seconds: number, seed: string) {
  flights.get(person)?.()
  const cursor = cursors[person]
  const x0 = cursor.x.get()
  const y0 = cursor.y.get()
  if (seconds <= 0.02) {
    cursor.x.set(x)
    cursor.y.set(y)
    return
  }
  const distance = Math.hypot(x - x0, y - y0)
  const bend = Math.min(60, distance * 0.12) * (hash(seed) % 2 ? -1 : 1)
  const cx = (x0 + x) / 2 - ((y - y0) / Math.max(distance, 1)) * bend
  const cy = (y0 + y) / 2 + ((x - x0) / Math.max(distance, 1)) * bend
  const flight = animate(0, 1, {
    duration: seconds,
    ease: [0.42, 0, 0.18, 1],
    onUpdate: (t) => {
      const u = 1 - t
      cursor.x.set(u * u * x0 + 2 * u * t * cx + t * t * x)
      cursor.y.set(u * u * y0 + 2 * u * t * cy + t * t * y)
    },
  })
  flights.set(person, () => flight.stop())
}

function detach(person: PersonId) {
  attached.get(person)?.stop()
  attached.delete(person)
}

function setBlocked(person: PersonId, card: string | null) {
  if ((getState().blockedCards[person] ?? null) === card) return
  setState((s) => {
    const blockedCards = { ...s.blockedCards }
    if (card) blockedCards[person] = card
    else delete blockedCards[person]
    return { blockedCards }
  })
}

function setWorkingOf(person: PersonId, card: string | null) {
  const current = getState().working[person] ?? null
  if (current === card) return
  setState((s) => {
    const working = { ...s.working }
    if (card) working[person] = card
    else delete working[person]
    return { working }
  })
}

/** Levanta la nota y la deja pegada al mouse, en el punto donde la tomó. */
function grab(person: PersonId, card: string, to: LaneId) {
  const ghost = pickUp(card, person)
  if (!ghost) return false
  setGhost(card, { target: to })
  const cursor = cursors[person]
  const offsetX = cursor.x.get() - ghost.x.get()
  const offsetY = cursor.y.get() - ghost.y.get()
  const subs = [cursor.x.on('change', (v) => ghost.x.set(v - offsetX)), cursor.y.on('change', (v) => ghost.y.set(v - offsetY))]
  detach(person)
  attached.set(person, { stop: () => subs.forEach((off) => off()), offsetX, offsetY })
  return true
}

function enter(person: PersonId, seg: Seg | null, local: number, jump: boolean) {
  const showing = getState().agentsOn
  if (!seg) {
    setAgent(person, { label: 'disponible', pressed: false })
    setWorkingOf(person, null)
    return
  }
  const remaining = Math.max(0, (seg.t1 - local) / 1000)
  const seconds = jump && seg.type !== 'haul' ? 0 : remaining
  setWorkingOf(person, seg.type === 'work' ? (seg.card as string) : null)
  // Sigue en ámbar mientras espera lugar, aunque entre intentos descanse un momento.
  setBlocked(person, seg.type === 'wait' || seg.stay ? (seg.card as string) : null)
  if (seg.type !== 'rest' || !settling.has(person)) {
    setAgent(person, { label: seg.label ?? '', pressed: seg.type === 'grip' || seg.type === 'lift' || seg.type === 'haul' || seg.type === 'drop' })
  }
  if (!showing) return
  if (seg.type === 'work') drifted.set(person, serverNow() + 1400)

  if (seg.type === 'seek' || seg.type === 'work' || seg.type === 'grip') {
    const point = seg.card ? portraitPoint(seg.card) : null
    if (point && (seg.type === 'seek' || jump)) fly(person, point.x, point.y, seconds, `${person}${seg.t0}`)
    return
  }

  // Presionó y ahora levanta: la nota sube un poco con el mouse antes de viajar.
  if (seg.type === 'lift' && seg.card && seg.to) {
    if (jump) {
      const point = portraitPoint(seg.card)
      if (point) fly(person, point.x, point.y, 0, '')
    }
    if (grab(person, seg.card, seg.to)) {
      const cursor = cursors[person]
      flights.get(person)?.()
      const rise = animate(cursor.y, cursor.y.get() - 7, { duration: Math.max(0.05, remaining), ease: PLACE_EASE })
      flights.set(person, () => rise.stop())
    }
    return
  }

  if ((seg.type === 'haul' || seg.type === 'drop') && seg.card && seg.to) {
    if (!attached.has(person)) {
      if (jump) {
        const point = portraitPoint(seg.card)
        if (point) fly(person, point.x, point.y, 0, '')
      }
      grab(person, seg.card, seg.to)
    }
    const hold = attached.get(person)
    const rect = cardRect(seg.card)
    const ghost = getState().ghosts.find((g) => g.id === seg.card)
    const drop = rect ? laneDropPoint(seg.to, rect.h, seg.slot ?? 0) : null
    if (seg.type === 'haul') setGhost(seg.card, { slot: seg.slot ?? 0 })
    if (seg.type === 'haul' && hold && rect && ghost && drop) {
      fly(person, drop.x + hold.offsetX - ghost.w / 2, drop.y + hold.offsetY - rect.h / 2, Math.max(0.05, remaining), `${person}${seg.t0}`)
    }
    return
  }

  if (seg.type === 'wait' && seg.to) {
    // Quien entra justo aquí también ve la mano sobre su nota, esperando.
    const point = jump && seg.card ? portraitPoint(seg.card) : null
    if (point) fly(person, point.x, point.y, 0, '')
    flashLane(seg.to)
    return
  }

  // Después de soltar una nota se queda donde está; no hay por qué irse a otra parte.
  if (seg.type === 'rest' && !jump) return

  // Sin trabajo a mano: se acerca sin prisa a su última nota, sin tocar las de otros.
  const own = getState().cards.filter((c) => c.owner === person)
  const last = own[own.length - 1]
  // Si ya no tiene notas a la vista (archivadas), espera junto a lo entregado.
  const lanes = [...document.querySelectorAll<HTMLElement>('[data-lane]')]
  const endLane = lanes[lanes.length - 1]?.dataset.lane as LaneId | undefined
  const point = (last ? portraitPoint(last.id) : null) ?? (endLane ? laneDropPoint(endLane, 120) : null)
  if (!point) return
  const wobble = hash(`${person}${seg.t0}`)
  const x = point.x + 6 + (wobble % 24)
  const y = point.y - 4 + (wobble % 12)
  const cursor = cursors[person]
  const distance = Math.hypot(x - cursor.x.get(), y - cursor.y.get())
  fly(person, x, y, jump ? 0 : Math.max(0.8, Math.min(3.2, distance / 320)), `${person}${seg.t0}`)
}

/** Suelta con cuidado: acompaña la nota hasta su sitio, deja de presionar y recién ahí se aparta. */
async function landed(land: Land) {
  const ghost: Ghost | undefined = getState().ghosts.find((g) => g.id === land.card)
  const hold = attached.get(land.who)
  if (!ghost || !hold) {
    detach(land.who)
    if (ghost) await settle(ghost, cardRect(land.card), PLACE_SECONDS)
    setAgent(land.who, { pressed: false, label: 'disponible' })
    if (!stopped) react(land.card, land.kind === 'done' ? 'done' : land.kind === 'back' ? 'down' : 'up')
    return
  }
  settling.add(land.who)
  flights.get(land.who)?.()
  detach(land.who)
  setGhost(land.card, { target: null, landing: true, airFace: ghostFace(ghost) })
  await nextFrames()
  if (stopped) {
    settling.delete(land.who)
    return
  }
  const rect = cardRect(land.card)
  const cursor = cursors[land.who]
  if (rect) {
    const moves = [
      animate(cursor.x, rect.x + hold.offsetX, { duration: PLACE_SECONDS, ease: PLACE_EASE }),
      animate(cursor.y, rect.y + hold.offsetY, { duration: PLACE_SECONDS, ease: PLACE_EASE }),
    ]
    flights.set(land.who, () => moves.forEach((m) => m.stop()))
  }
  await settle(ghost, rect, PLACE_SECONDS)
  settling.delete(land.who)
  if (stopped) return
  setAgent(land.who, { pressed: false, label: 'disponible' })
  react(land.card, land.kind === 'done' ? 'done' : land.kind === 'back' ? 'down' : 'up')
  await new Promise((resolve) => window.setTimeout(resolve, 120))
  if (stopped) return
  // Ya soltó: se aparta un poco, sin irse a ningún lado.
  fly(land.who, cursor.x.get() + 12, cursor.y.get() - 9, 0.35, `${land.who}${land.at}`)
}

/* ---------- Actividad e isla: las mismas para todos, salvo lo que cada quien quitó de su lista ---------- */

const activityCache = new Map<string, Activity[]>()
function activityOf(sprint: SprintId, loop: number, start: number) {
  const key = `${sprint}:${loop}`
  let list = activityCache.get(key)
  if (!list) {
    list = scriptFor(sprint).events.map((e, i) => ({
      id: loop * 1000 + (sprint - 1) * 500 + i,
      at: start + e.at,
      sprint,
      who: e.who,
      owner: e.owner,
      kind: e.kind,
      card: e.card,
      title: e.title,
      from: e.from,
      to: e.to,
      deltaMs: e.deltaMs,
    }))
    if (activityCache.size > 8) activityCache.clear()
    activityCache.set(key, list)
  }
  return list
}

export function syncActivity(now: number) {
  const { loop, loopStart, T } = clockAt(now)
  const first = activityOf(1, loop, loopStart).filter((a) => a.at <= now)
  const second = T >= 360_000 ? activityOf(2, loop, loopStart + 360_000).filter((a) => a.at <= now) : []
  const own = localActivity().filter((a) => a.at >= loopStart)
  const all = own.length ? [...first, ...second, ...own].sort((a, b) => a.at - b.at) : [...first, ...second]
  const key = `${loop}:${all.length}:${own[0]?.id ?? 0}:${getState().activityEpoch}`
  if (key === lastActivity) return
  lastActivity = key
  const visible = all.filter((a) => !isDismissed(a.id)).reverse()
  setState((s) => ({ activity: visible, panelOpen: s.panelOpen && visible.length > 0 }))
}

function syncAlert(now: number) {
  const state = getState()
  if (state.panelOpen || state.scene !== 'live') {
    if (state.alert) setState({ alert: null, waiting: 0 })
    lastAlert = ''
    return
  }
  if (isIslandHeld() && state.alert) return
  const mine = currentLocalAlert(now)
  if (mine) {
    const own = `local:${mine.id}`
    if (lastAlert !== own) {
      lastAlert = own
      setState({ alert: { id: mine.id, items: [mine] }, waiting: 0 })
    }
    return
  }
  const { sprint } = state
  const { T, loop } = clockAt(now)
  if (sprint !== activeSprint(T)) {
    if (state.alert) setState({ alert: null, waiting: 0 })
    lastAlert = ''
    return
  }
  const local = localTime(sprint, now)
  const script = scriptFor(sprint)
  const slot = script.alerts.find((a) => a.at <= local && local < a.until)
  const list = activityOf(sprint, sprint === 1 && T >= 714_000 ? loop + 1 : loop, now - local)
  const items = slot ? slot.items.filter((i) => i.joinAt <= local).map((i) => list[i.event]) : []
  const waiting = script.events.reduce((n, e, i) => (e.at <= local && script.shownAt[i] > local && script.shownAt[i] !== Infinity ? n + 1 : n), 0)
  const key = `${slot?.at ?? ''}:${items.length}:${waiting}`
  if (key === lastAlert) return
  lastAlert = key
  setState({ alert: slot && items.length ? { id: items[0].id, items } : null, waiting })
}

/* ---------- Ponerse al día ---------- */

async function resync(now: number) {
  const state = getState()
  const { sprint } = state
  const board = boardAt(sprint, now)
  const local = now - board.start
  TEAM.forEach((p) => {
    flights.get(p.id)?.()
    detach(p.id)
  })
  setState({ cards: [...board.cards, ...localFor(sprint)], archived: board.archived, ghosts: [], working: {}, blockedCards: {}, localCursors: [] })
  haltNotes(now)
  for (const card of board.cards) progressOf(card.id).set(progressAt(sprint, card.id, local, card.seedProgress ?? 0))
  appliedLands = board.index
  applied.clear()
  await nextFrames()
  if (stopped) return
  const live = sprint === activeSprint(clockAt(now).T)
  TEAM.forEach((p) => {
    if (!live) {
      setAgent(p.id, { ready: false, pressed: false, label: 'disponible' })
      return
    }
    const list = scriptFor(sprint).segs[p.id]
    const nowLocal = localTime(sprint, serverNow())
    const index = list.findIndex((s) => nowLocal < s.t1)
    const seg = index >= 0 && list[index].t0 <= nowLocal ? list[index] : null
    applied.set(p.id, index)
    // Antes de su primer paso, el mouse nace sobre una nota de su dueño, nunca fuera del tablero.
    const own = getState().cards.find((c) => c.owner === p.id)
    const start = own ? portraitPoint(own.id) : null
    if (!seg && start) fly(p.id, start.x, start.y, 0, '')
    enter(p.id, seg, nowLocal, true)
    setAgent(p.id, { ready: true })
  })
}

function tick() {
  if (stopped || document.hidden) return
  const now = serverNow()
  const state = getState()
  if (state.scene !== 'live') return
  const { T, loop } = clockAt(now)
  const live = activeSprint(T)
  if (state.liveSprint !== live) setState({ liveSprint: live })

  // ¿Toca estar en otro sprint?
  if (peek && now >= peek.until) peek = null
  const want = peek?.sprint ?? live
  if (state.sprint !== want) {
    const leftInTransition = TRANSITION_MS - OPEN_MS - ENTER_MS
    travelTo(want, phraseFor(want, loop), leftInTransition)
    return
  }

  beat = (beat + 1) % 3
  if (beat === 0) syncActivity(now)

  // Si la pantalla se atrasó (pestaña oculta, equipo ocupado), salta al punto exacto.
  if (now - lastTick > 2000) {
    lastTick = now
    void resync(now)
    return
  }
  lastTick = now

  const sprint = state.sprint
  const board = boardAt(sprint, now)
  const local = now - board.start
  const script = scriptFor(sprint)

  if (board.index !== appliedLands) {
    const fresh = script.lands.slice(Math.max(0, appliedLands), board.index)
    setState({ cards: [...board.cards, ...localFor(sprint)], archived: board.archived })
    fresh.forEach((land) => {
      progressOf(land.card).set(progressAt(sprint, land.card, local))
      void landed(land)
    })
    appliedLands = board.index
  }

  if (beat === 0) syncAlert(now)
  if (sprint !== live) return
  tickNotes(sprint, now)

  TEAM.forEach((p) => {
    const list = script.segs[p.id]
    let index = applied.get(p.id) ?? 0
    if (index < 0) index = list.length
    while (index < list.length && list[index].t1 <= local) index += 1
    const seg = index < list.length && list[index].t0 <= local ? list[index] : null
    if (applied.get(p.id) !== index) {
      applied.set(p.id, index)
      enter(p.id, seg, local, false)
    }
    if (seg?.type === 'work' && seg.card) {
      const progress = progressOf(seg.card)
      progress.set(Math.min(1, progressAt(sprint, seg.card, local)))
      if (now - lastPointCheck > 300 && getState().agentsOn) {
        const point = portraitPoint(seg.card)
        const cursor = cursors[p.id]
        const beat = hash(`${p.id}${Math.floor(now / 3000)}`)
        if (point && Math.hypot(point.x - cursor.x.get(), point.y - cursor.y.get()) > 44) {
          // La nota se acomodó en su carril: el cursor la acompaña.
          const away = Math.hypot(point.x - cursor.x.get(), point.y - cursor.y.get())
          fly(p.id, point.x, point.y, Math.max(0.5, Math.min(1.4, away / 500)), `${p.id}follow`)
          drifted.set(p.id, now + 900)
        } else if (point && now > (drifted.get(p.id) ?? 0)) {
          // Mientras trabaja se mueve poco y junto a su retrato: está vivo, no se va a ningún lado.
          fly(p.id, point.x - 4 + (beat % 24), point.y - 6 + (beat % 12), 1.8 + (beat % 10) / 10, `${p.id}${beat}`)
          drifted.set(p.id, now + 2600 + (beat % 1200))
        }
      }
    }
  })
  if (now - lastPointCheck > 300) lastPointCheck = now
}

/** Arranca cuando el tablero queda visible. Cualquier transición lo detiene y lo vuelve a arrancar. */
export function startPlayer() {
  stopped = false
  lastAlert = ''
  lastActivity = ''
  const now = serverNow()
  lastTick = now
  setState({ liveSprint: activeSprint(clockAt(now).T) })
  syncActivity(now)
  void resync(now)
  const timer = window.setInterval(tick, 100)
  const onVisible = () => {
    if (!document.hidden) lastTick = 0
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    stopped = true
    settling.clear()
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    TEAM.forEach((p) => {
      flights.get(p.id)?.()
      flights.delete(p.id)
      detach(p.id)
      setAgent(p.id, { ready: false, pressed: false, label: 'disponible' })
    })
    haltNotes(serverNow())
    setState({ working: {}, blockedCards: {}, alert: null, waiting: 0, localCursors: [] })
    getState().ghosts.forEach((g) => removeGhost(g.id))
    lastAlert = ''
  }
}

/** Con la pantalla tapada: trae el sprint de destino en el punto exacto del guion. */
export function arrive() {
  const now = serverNow()
  const sprint = getDestination()
  const board = boardAt(sprint, now)
  setState({ sprint, cards: [...board.cards, ...localFor(sprint)], archived: board.archived, cardBeats: {}, laneFlash: {} })
  const local = now - board.start
  for (const card of board.cards) progressOf(card.id).set(progressAt(sprint, card.id, local, card.seedProgress ?? 0))
}
