import { useSyncExternalStore } from 'react'
import { motionValue, type MotionValue } from 'motion/react'
import { LANE, LANE_INDEX, SPRINTS, detailsOf, type Card, type LaneId, type SprintId } from '../data/board'
import { greeting, planFor } from '../engine/clock'
import { TEAM, type PersonId } from '../data/team'

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

/** `going`: la nota que decidió llevar y a dónde. Se conoce antes de levantarla, para que la cámara se adelante. */
export type AgentView = { label: string; pressed: boolean; ready: boolean; going?: { card: string; to: LaneId } | null }
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
  sprint: SprintId
  scene: Scene
  /** Sentido del viaje: 1 baja de piso, -1 sube. */
  direction: 1 | -1
  phrase: string
  cards: Card[]
  ghosts: Ghost[]
  cardBeats: Record<string, Reaction>
  working: Partial<Record<PersonId, string>>
  agents: Record<PersonId, AgentView>
  laneFlash: Partial<Record<LaneId, number>>
  /** Historial completo, de lo más nuevo a lo más viejo. */
  activity: Activity[]
  /** Lo que la isla está contando ahora, y lo que espera su turno. */
  alert: { id: number; items: Activity[] } | null
  pending: Activity[]
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

const firstMessage = 'Arrastra una nota al carril siguiente.'

function sprintFromUrl(): SprintId {
  if (typeof window === 'undefined') return 1
  return new URLSearchParams(window.location.search).get('sprint') === '2' ? 2 : 1
}

type Floor = { cards: Card[]; archived: number; pool: number; leftAt: number }

/**
 * Al abrir el tablero, cada nota ya en curso empezó hace un rato proporcional a su avance.
 * Lo planificado es real a partir de ahí: se compara contra el reloj, no contra un número de adorno.
 */
function stamp(card: Card, index: number): Card {
  const planMs = planFor(card.points)
  const step = LANE_INDEX[card.lane]
  if (step === 0) return { ...card, planMs }
  const now = Date.now()
  const spread = 0.62 + ((index * 37) % 40) / 100
  if (LANE[card.lane].kind === 'end') {
    const doneAt = now - 20_000 - ((index * 13) % 40) * 1000
    const startedAt = doneAt - planMs * spread
    return { ...card, planMs, startedAt, dueAt: startedAt + planMs, doneAt }
  }
  const startedAt = now - planMs * (step / 9) * spread
  return { ...card, planMs, startedAt, dueAt: startedAt + planMs }
}

const makeFloors = (): Record<SprintId, Floor> => ({
  1: { cards: SPRINTS[1].seed.map(stamp), archived: 0, pool: 0, leftAt: Date.now() },
  2: { cards: SPRINTS[2].seed.map(stamp), archived: 0, pool: 0, leftAt: Date.now() },
})

/** El tiempo de un sprint solo corre mientras se está en él. */
const shiftTimes = (cards: Card[], ms: number) =>
  cards.map((c) => ({
    ...c,
    startedAt: c.startedAt && c.startedAt + ms,
    dueAt: c.dueAt && c.dueAt + ms,
    doneAt: c.doneAt && c.doneAt + ms,
  }))

let floors = makeFloors()

const initial = (sprint: SprintId, agentsOn: boolean, reduced: boolean): BoardState => ({
  sprint,
  scene: reduced ? 'live' : 'shaft',
  direction: 1,
  phrase: greeting(),
  cards: floors[sprint].cards,
  ghosts: [],
  cardBeats: {},
  working: {},
  agents: perPerson(() => ({ label: 'disponible', pressed: false, ready: false })),
  laneFlash: {},
  activity: [],
  alert: null,
  pending: [],
  panelOpen: false,
  lite: false,
  archived: 0,
  agentsOn,
  cameraOn: agentsOn,
  focus: null,
})

let state = initial(sprintFromUrl(), true, false)
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

/* ---------- Acciones ---------- */

/**
 * La isla cuenta una cosa a la vez y la deja el tiempo de leerla. Regresos, entregas y carriles
 * llenos pasan primero; si los movimientos corren más rápido que la lectura, solo esperan los dos
 * últimos. Nada se pierde: todo queda en el historial.
 */
const DWELL_MS = 4500
const LINGER_MS = 1500
const MOVES_WAITING = 4
/** Lo que ocurre apenas abierto el aviso se suma a él: quienes actúan a la vez salen juntos. */
const JOIN_MS = 1400
const MIN_AFTER_JOIN_MS = 3200
const ACTIVITY_MAX = 200

let activityId = 1
let dwellTimer = 0
let lingered = false
let islandHeld = false
let tipShown = false
let alertSince = 0

function queueUp(pending: Activity[], entry: Activity) {
  const important = pending.filter((a) => a.kind !== 'move')
  const moves = pending.filter((a) => a.kind === 'move')
  return entry.kind === 'move' ? [...important, ...moves.slice(1 - MOVES_WAITING), entry] : [...important, entry, ...moves]
}

function armDwell(ms: number) {
  window.clearTimeout(dwellTimer)
  dwellTimer = window.setTimeout(() => {
    if (islandHeld) return armDwell(400)
    if (state.pending.length === 0 && !lingered) {
      lingered = true
      return armDwell(LINGER_MS)
    }
    showNext()
  }, ms)
}

function showNext() {
  window.clearTimeout(dwellTimer)
  const next = state.pending[0]
  if (!next) return setState({ alert: null })
  // Todo lo del mismo tipo que espera sale en el mismo aviso, con cada persona a la vista.
  const together = next.kind === 'tip' ? [next] : state.pending.filter((a) => a.kind === next.kind)
  const rest = state.pending.filter((a) => !together.includes(a))
  lingered = false
  alertSince = performance.now()
  setState({ alert: { id: next.id, items: together }, pending: rest })
  armDwell(DWELL_MS)
}

function quietIsland(patch: Partial<BoardState> = {}) {
  window.clearTimeout(dwellTimer)
  setState({ alert: null, pending: [], ...patch })
}

export function notify(event: Pick<Activity, 'who' | 'owner' | 'kind' | 'card' | 'title' | 'from' | 'to' | 'deltaMs'>) {
  const entry: Activity = { ...event, id: activityId++, at: Date.now(), sprint: state.sprint }
  const current = state.alert
  const age = performance.now() - alertSince
  if (current && !state.panelOpen && state.scene === 'live' && current.items[0].kind === entry.kind && age < JOIN_MS) {
    setState((s) => ({
      activity: [entry, ...s.activity].slice(0, ACTIVITY_MAX),
      alert: { id: current.id, items: [...current.items, entry] },
    }))
    if (DWELL_MS - age < MIN_AFTER_JOIN_MS) armDwell(MIN_AFTER_JOIN_MS)
    return
  }
  setState((s) => ({
    activity: [entry, ...s.activity].slice(0, ACTIVITY_MAX),
    pending: s.panelOpen || s.scene !== 'live' ? s.pending : queueUp(s.pending, entry),
  }))
  if (!state.alert && state.pending.length > 0) showNext()
  else if (state.alert && lingered && state.pending.length > 0) showNext()
}

/** Mientras el puntero está encima, el aviso no se va. */
export const holdIsland = (held: boolean) => {
  islandHeld = held
}

export function setPanelOpen(open: boolean) {
  quietIsland({ panelOpen: open })
}

/** Quitar del historial. Sin nada que mostrar, el panel se cierra y la isla se va. */
export function dismissActivity(id: number) {
  const activity = state.activity.filter((a) => a.id !== id)
  setState({ activity, panelOpen: state.panelOpen && activity.length > 0 })
}

export function clearActivity(who: PersonId | 'all') {
  const activity = who === 'all' ? [] : state.activity.filter((a) => a.who !== who && !(a.who === 'user' && a.owner === who))
  setState({ activity, panelOpen: state.panelOpen && activity.length > 0 })
}

/** Con el tablero en uso: la primera vez, la isla enseña qué se puede hacer. */
export function startIsland() {
  if (tipShown || state.panelOpen) return
  tipShown = true
  const tip: Activity = { id: activityId++, at: Date.now(), sprint: state.sprint, who: 'user', owner: TEAM[0].id, kind: 'tip', card: null, title: firstMessage, from: null, to: null }
  setState((s) => ({ pending: [tip, ...s.pending] }))
  if (!state.alert) showNext()
}

export const flashLane = (lane: LaneId) =>
  setState((s) => ({ laneFlash: { ...s.laneFlash, [lane]: (s.laneFlash[lane] ?? 0) + 1 } }))

export function setWorking(person: PersonId, cardId: string | null) {
  setState((s) => {
    const working = { ...s.working }
    if (cardId) working[person] = cardId
    else delete working[person]
    return { working }
  })
}

export function setAgent(person: PersonId, patch: Partial<AgentView>) {
  setState((s) => ({ agents: { ...s.agents, [person]: { ...s.agents[person], ...patch } } }))
}

export const setAgentsOn = (agentsOn: boolean) => setState({ agentsOn })
export const setCameraOn = (cameraOn: boolean) => setState({ cameraOn, focus: null })
export function setFocus(focus: LaneId[] | null) {
  if (state.focus?.join() !== focus?.join()) setState({ focus })
}

export function setGhost(id: string, patch: Partial<Ghost>) {
  setState((s) => ({ ghosts: s.ghosts.map((g) => (g.id === id ? { ...g, ...patch } : g)) }))
}

export const removeGhost = (id: string) => setState((s) => ({ ghosts: s.ghosts.filter((g) => g.id !== id) }))

let idSeq = 40

function lightestOwner(cards: Card[]): PersonId {
  const end = (c: Card) => LANE[c.lane].kind === 'end'
  const load = (p: PersonId) => cards.filter((c) => c.owner === p && !end(c)).length
  return [...TEAM].sort((a, b) => load(a.id) - load(b.id))[0].id
}

export function addCard(title: string) {
  const sprint = SPRINTS[state.sprint]
  const n = idSeq++
  const card: Card = {
    id: `${sprint.prefix}-${n}`,
    key: `${sprint.prefix}-${n}`,
    title,
    owner: lightestOwner(state.cards),
    cls: 'standard',
    lane: sprint.lanes[0].id,
    points: 2,
    returns: 0,
    planMs: planFor(2),
  }
  setState((s) => ({ cards: [...s.cards, card] }))
  notify({ who: 'user', owner: card.owner, kind: 'new', card: card.id, title, from: null, to: card.lane })
}

const DONE_VISIBLE = 6

/** Mantiene viva la demo: archiva lo más viejo de lo entregado y repone el primer carril. */
export function tidy() {
  setState((s) => {
    const sprint = SPRINTS[s.sprint]
    const first = sprint.lanes[0].id
    const last = sprint.lanes[sprint.lanes.length - 1].id
    const floor = floors[s.sprint]
    let cards = s.cards
    let archived = s.archived
    const done = cards.filter((c) => c.lane === last)
    if (done.length > DONE_VISIBLE) {
      const drop = new Set(done.slice(0, done.length - DONE_VISIBLE).map((c) => c.id))
      cards = cards.filter((c) => !drop.has(c.id))
      archived += drop.size
    }
    if (countIn(first, cards) < 2) {
      const [title, cls, points] = sprint.pool[floor.pool++ % sprint.pool.length]
      const n = idSeq++
      const extra: Card = { id: `${sprint.prefix}-${n}`, key: `${sprint.prefix}-${n}`, title, cls, points, owner: lightestOwner(cards), lane: first, returns: 0, ...detailsOf(title) }
      if (cls === 'date') extra.due = '30 nov'
      cards = [...cards, extra]
    }
    return { cards, archived }
  })
}

/* ---------- Viaje entre pisos ---------- */

const usedPhrases: Record<SprintId, string[]> = { 1: [], 2: [] }

/** Baraja sin repetir: ninguna frase vuelve hasta que salieron todas las de ese piso. */
function nextPhrase(sprint: SprintId) {
  const all = SPRINTS[sprint].phrases
  if (usedPhrases[sprint].length >= all.length) usedPhrases[sprint] = []
  const left = all.filter((p) => !usedPhrases[sprint].includes(p))
  const phrase = left[Math.floor(Math.random() * left.length)]
  usedPhrases[sprint].push(phrase)
  return phrase
}

let destination: SprintId = state.sprint

/** Pide el viaje. Devuelve false si ya estamos viajando o ya estamos en ese piso. */
export function travelTo(sprint: SprintId) {
  if (state.scene !== 'live' || state.sprint === sprint) return false
  destination = sprint
  window.clearTimeout(dwellTimer)
  setState({
    alert: null,
    pending: [],
    scene: 'leave',
    direction: sprint > state.sprint ? 1 : -1,
    phrase: nextPhrase(sprint),
    ghosts: [],
    working: {},
    focus: null,
  })
  return true
}

/** Con la pantalla tapada: guarda este piso y trae el otro. */
export function swapFloor() {
  const from = state.sprint
  if (from === destination) return
  const moment = Date.now()
  floors[from] = { ...floors[from], cards: state.cards, archived: state.archived, leftAt: moment }
  const next = { ...floors[destination], cards: shiftTimes(floors[destination].cards, moment - floors[destination].leftAt) }
  setState({
    sprint: destination,
    cards: next.cards,
    archived: next.archived,
    cardBeats: {},
    laneFlash: {},
  })
  const url = new URL(window.location.href)
  url.searchParams.set('sprint', String(destination))
  window.history.replaceState(null, '', url)
}

export const setScene = (scene: Scene) => setState({ scene })

export function resetBoard(agentsOn: boolean, reduced: boolean) {
  progress.clear()
  floors = makeFloors()
  window.clearTimeout(dwellTimer)
  tipShown = false
  lingered = false
  TEAM.forEach((p) => {
    cursors[p.id].x.set(-80)
    cursors[p.id].y.set(-80)
  })
  const sprint = state.sprint
  destination = sprint
  setState({ ...initial(sprint, agentsOn, reduced), lite: state.lite })
}
