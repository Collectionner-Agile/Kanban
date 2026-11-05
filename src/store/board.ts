import { useSyncExternalStore } from 'react'
import { motionValue, type MotionValue } from 'motion/react'
import { LANE, SPRINTS, type Card, type LaneId, type SprintId } from '../data/board'
import { TEAM, type PersonId } from '../data/team'
import { greeting, serverNow } from '../engine/clock'
import { activeSprint, boardAt, clockAt } from '../engine/script'

export type Face = 'idle' | 'focus' | 'happy' | 'celebrate' | 'worried' | 'sad' | 'confused'
export type Beat = 'up' | 'down' | 'done' | 'huh' | null
export type Reaction = { face: Face; beat: Beat; nonce: number }

/**
 * El viaje entre pisos. `leave`: el piso se va y entra el ascensor. `shaft`: el ascensor con la
 * frase, tapando todo. `enter`: llega el piso nuevo. `live`: tablero en uso.
 */
export type Scene = 'leave' | 'shaft' | 'enter' | 'live'

export type Ghost = {
  id: string
  by: PersonId | 'user'
  x: MotionValue<number>
  y: MotionValue<number>
  w: number
  from: LaneId
  target: LaneId | null
  landing: boolean
  airFace?: Face
}

export type AgentView = { label: string; pressed: boolean; ready: boolean }
/** El mouse de una nota propia: va aparte del guion para no alterar lo que ven los demás. */
export type LocalCursor = { id: string; owner: PersonId; label: string; pressed: boolean; x: MotionValue<number>; y: MotionValue<number> }
export type ActivityKind = 'move' | 'back' | 'done' | 'full' | 'new' | 'tip'
/** Un hecho del tablero: quién hizo qué, con qué nota y entre qué carriles. */
export type Activity = {
  id: number
  at: number
  sprint: SprintId
  who: PersonId | 'user'
  owner: PersonId
  kind: ActivityKind
  card: string | null
  title: string
  from: LaneId | null
  to: LaneId | null
  /** Al terminar: negativo si le sobró tiempo, positivo si se pasó. */
  deltaMs?: number
}

export type BoardState = {
  /** El sprint que esta pantalla está mirando. */
  sprint: SprintId
  /** El sprint que va en vivo para todos. */
  liveSprint: SprintId
  scene: Scene
  /** Sentido del viaje: 1 baja de piso, -1 sube. */
  direction: 1 | -1
  phrase: string
  holdMs: number
  cards: Card[]
  ghosts: Ghost[]
  cardBeats: Record<string, Reaction>
  working: Partial<Record<PersonId, string>>
  agents: Record<PersonId, AgentView>
  localCursors: LocalCursor[]
  laneFlash: Partial<Record<LaneId, number>>
  /** Historial, de lo más nuevo a lo más viejo. */
  activity: Activity[]
  activityEpoch: number
  /** Lo que la isla está contando ahora, y cuántos avisos esperan su turno. */
  alert: { id: number; items: Activity[] } | null
  waiting: number
  panelOpen: boolean
  /** Equipo sin fuerza: el tablero se aligera solo. */
  lite: boolean
  archived: number
  agentsOn: boolean
  cameraOn: boolean
  /** Carriles en foco durante un plano cerrado; el resto se atenúa. */
  focus: LaneId[] | null
}

const perPerson = <T,>(make: (id: PersonId) => T) =>
  Object.fromEntries(TEAM.map((p) => [p.id, make(p.id)])) as Record<PersonId, T>

const initial = (agentsOn: boolean, reduced: boolean): BoardState => {
  const now = serverNow()
  const sprint = activeSprint(clockAt(now).T)
  const board = boardAt(sprint, now)
  return {
    sprint,
    liveSprint: sprint,
    scene: reduced ? 'live' : 'shaft',
    direction: 1,
    phrase: greeting(),
    holdMs: 2400,
    cards: board.cards,
    ghosts: [],
    cardBeats: {},
    working: {},
    agents: perPerson(() => ({ label: 'disponible', pressed: false, ready: false })),
    localCursors: [],
    laneFlash: {},
    activity: [],
    activityEpoch: 0,
    alert: null,
    waiting: 0,
    panelOpen: false,
    lite: false,
    archived: board.archived,
    agentsOn,
    cameraOn: agentsOn,
    focus: null,
  }
}

let state = initial(true, false)
const listeners = new Set<() => void>()

export const getState = () => state

export function setState(patch: Partial<BoardState> | ((s: BoardState) => Partial<BoardState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** El selector debe devolver una referencia estable: un trozo del estado, no un arreglo nuevo. */
export function useBoard<T>(selector: (s: BoardState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

/* ---------- Valores que cambian a cada cuadro: viven fuera de React ---------- */

const progress = new Map<string, MotionValue<number>>()

export function progressOf(id: string) {
  let value = progress.get(id)
  if (!value) {
    const card = state.cards.find((c) => c.id === id)
    value = motionValue(card?.seedProgress ?? 0)
    progress.set(id, value)
  }
  return value
}

export const cursors = perPerson(() => ({ x: motionValue(-80), y: motionValue(-80) }))

/* ---------- Consultas ---------- */

export const lanesNow = () => SPRINTS[state.sprint].lanes

export const countIn = (lane: LaneId, cards = state.cards) => cards.filter((c) => c.lane === lane).length

export function isFull(lane: LaneId) {
  const limit = LANE[lane].wip
  return limit !== null && countIn(lane) >= limit
}

export const isActive = (lane: LaneId) => LANE[lane].kind === 'work' || LANE[lane].kind === 'check'
export const isHeld = (id: string) => state.ghosts.some((g) => g.id === id)
export const findCard = (id: string) => state.cards.find((c) => c.id === id)

/* ---------- Reacciones: lo que siente el personaje de esa nota ---------- */

const BEATS: Record<Exclude<Beat, null>, { face: Face; ms: number }> = {
  up: { face: 'happy', ms: 2600 },
  done: { face: 'celebrate', ms: 3600 },
  down: { face: 'sad', ms: 5000 },
  huh: { face: 'confused', ms: 2800 },
}

let nonce = 1

export function react(cardId: string, beat: Exclude<Beat, null>) {
  const { face, ms } = BEATS[beat]
  const n = nonce++
  setState((s) => ({ cardBeats: { ...s.cardBeats, [cardId]: { face, beat, nonce: n } } }))
  window.setTimeout(() => {
    setState((s) => {
      if (s.cardBeats[cardId]?.nonce !== n) return {}
      const cardBeats = { ...s.cardBeats }
      delete cardBeats[cardId]
      return { cardBeats }
    })
  }, ms)
}

/* ---------- Isla e historial ---------- */

let islandHeld = false
const dismissed = new Set<number>()

/** Mientras el puntero está encima, el aviso no se va. */
export const holdIsland = (held: boolean) => {
  islandHeld = held
}
export const isIslandHeld = () => islandHeld
export const isDismissed = (id: number) => dismissed.has(id)

export function setPanelOpen(open: boolean) {
  setState({ panelOpen: open, alert: null, waiting: 0 })
}

/** Quitar del historial es solo de esta pantalla. Sin nada que mostrar, el panel se cierra y la isla se va. */
export function dismissActivity(id: number) {
  dismissed.add(id)
  const activity = state.activity.filter((a) => a.id !== id)
  setState((s) => ({ activity, panelOpen: s.panelOpen && activity.length > 0, activityEpoch: s.activityEpoch + 1 }))
}

export function clearActivity(who: PersonId | 'all') {
  const leaves = (a: Activity) => who === 'all' || a.who === who || (a.who === 'user' && a.owner === who)
  state.activity.filter(leaves).forEach((a) => dismissed.add(a.id))
  const activity = state.activity.filter((a) => !leaves(a))
  setState((s) => ({ activity, panelOpen: s.panelOpen && activity.length > 0, activityEpoch: s.activityEpoch + 1 }))
}

export const flashLane = (lane: LaneId) =>
  setState((s) => ({ laneFlash: { ...s.laneFlash, [lane]: (s.laneFlash[lane] ?? 0) + 1 } }))

export function setAgent(person: PersonId, patch: Partial<AgentView>) {
  setState((s) => ({ agents: { ...s.agents, [person]: { ...s.agents[person], ...patch } } }))
}

export const setCameraOn = (cameraOn: boolean) => setState({ cameraOn, focus: null })
export function setFocus(focus: LaneId[] | null) {
  if (state.focus?.join() !== focus?.join()) setState({ focus })
}

export function setGhost(id: string, patch: Partial<Ghost>) {
  setState((s) => ({ ghosts: s.ghosts.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
}

export const removeGhost = (id: string) => setState((s) => ({ ghosts: s.ghosts.filter((g) => g.id !== id) }))

/* ---------- Viaje entre pisos ---------- */

let destination: SprintId = state.sprint
export const getDestination = () => destination

/** Pide el viaje. Devuelve false si ya estamos viajando o ya estamos en ese piso. */
export function travelTo(sprint: SprintId, phrase: string, holdMs: number) {
  if (state.scene !== 'live' || state.sprint === sprint) return false
  destination = sprint
  setState({
    alert: null,
    waiting: 0,
    scene: 'leave',
    direction: sprint > state.sprint ? 1 : -1,
    phrase,
    holdMs,
    ghosts: [],
    working: {},
    focus: null,
  })
  return true
}

export const setScene = (scene: Scene) => setState({ scene })

export function resetBoard(agentsOn: boolean, reduced: boolean) {
  progress.clear()
  dismissed.clear()
  TEAM.forEach((p) => {
    cursors[p.id].x.set(-80)
    cursors[p.id].y.set(-80)
  })
  const next = initial(agentsOn, reduced)
  destination = next.sprint
  setState({ ...next, lite: state.lite })
}
