import { LANE, LANE_INDEX, NEXT, SPRINTS, reworkLane, type Card, type Lane, type LaneId, type SprintId } from '../data/board'
import { TEAM, type PersonId } from '../data/team'
import { planFor } from './clock'

/**
 * El guion: una película de 12 minutos que todas las pantallas calculan igual a partir de la hora.
 * Aquí no hay pantalla ni tiempo real: con las mismas semillas sale siempre el mismo resultado.
 */
export const SPRINT_MS = 360_000
export const LOOP_MS = SPRINT_MS * 2
/** Los últimos segundos de cada sprint son la frase de cambio. */
export const TRANSITION_MS = 6_000
export const LIVE_MS = SPRINT_MS - TRANSITION_MS
/** Todo queda entregado un poco antes del cambio, para que el cierre se alcance a ver. */
const CLOSE_TARGET_MS = 332_000
const CLOSE_LATEST_MS = 344_000
const EPOCH = Date.UTC(2026, 0, 1)
const SEED: Record<SprintId, number> = { 1: 20260824, 2: 20261012 }
const DONE_VISIBLE = 6

export function clockAt(now: number) {
  const loop = Math.floor((now - EPOCH) / LOOP_MS)
  const loopStart = EPOCH + loop * LOOP_MS
  return { loop, loopStart, T: now - loopStart }
}

/** El sprint que está en vivo. Cambia al empezar la frase, no al terminar. */
export const activeSprint = (T: number): SprintId => (T < LIVE_MS || T >= SPRINT_MS + LIVE_MS ? 1 : 2)

/** Cuándo empieza (o empezó) el sprint que corresponde mirar en este momento. */
export function sprintStart(sprint: SprintId, now: number) {
  const { loopStart, T } = clockAt(now)
  if (sprint === 2) return loopStart + SPRINT_MS
  return T >= SPRINT_MS + LIVE_MS ? loopStart + LOOP_MS : loopStart
}

export const localTime = (sprint: SprintId, now: number) => now - sprintStart(sprint, now)

export const phraseFor = (sprint: SprintId, loop: number) => {
  const all = SPRINTS[sprint].phrases
  return all[((loop % all.length) + all.length) % all.length]
}

/* ---------- Lo que hace cada persona ---------- */

export type SegType = 'seek' | 'work' | 'grip' | 'lift' | 'haul' | 'drop' | 'rest' | 'wait' | 'idle'
export type Seg = { t0: number; t1: number; type: SegType; card?: string; lane?: LaneId; to?: LaneId; label?: string; carry?: boolean; stay?: boolean; slot?: number }
export type Land = { at: number; who: PersonId; card: string; from: LaneId; to: LaneId; deltaMs?: number; kind: 'move' | 'back' | 'done' }
export type ScriptEvent = {
  at: number
  who: PersonId
  owner: PersonId
  kind: 'move' | 'back' | 'done' | 'full'
  card: string
  title: string
  from: LaneId
  to: LaneId
  deltaMs?: number
}
export type AlertItem = { event: number; joinAt: number }
export type AlertSlot = { at: number; until: number; items: AlertItem[] }
export type Shot = { at: number; kind: 'trip'; card: string; to: LaneId; from: LaneId } | { at: number; kind: 'overview' } | { at: number; kind: 'close'; card: string; lane: LaneId }
type Slice = { t0: number; t1: number; p0: number; p1: number }

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

function randomFrom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cada nota ya en curso empezó hace un rato proporcional a su avance. Tiempos relativos al inicio del sprint. */
function seedCards(sprint: SprintId): Card[] {
  return SPRINTS[sprint].seed.map((card, index) => {
    const planMs = planFor(card.points)
    const step = LANE_INDEX[card.lane]
    if (step === 0) return { ...card, planMs }
    const spread = 0.62 + ((index * 37) % 40) / 100
    if (LANE[card.lane].kind === 'end') {
      const doneAt = -20_000 - ((index * 13) % 40) * 1000
      const startedAt = doneAt - planMs * spread
      return { ...card, planMs, startedAt, dueAt: startedAt + planMs, doneAt }
    }
    const startedAt = -planMs * (step / 9) * spread
    return { ...card, planMs, startedAt, dueAt: startedAt + planMs }
  })
}

const isWork = (lane: Lane) => lane.kind === 'work' || lane.kind === 'check'

/** Las mismas reglas del tablero: cada quien mueve lo suyo, primero lo de la derecha, y el WIP manda. */
function simulate(sprint: SprintId, scale: number) {
  const rng = randomFrom(SEED[sprint])
  const between = (min: number, max: number) => min + rng() * (max - min)
  const lanes = SPRINTS[sprint].lanes
  const rightToLeft = [...lanes].reverse()
  const seeds = SPRINTS[sprint].seed
  const order = seeds.map((c) => c.id)
  const laneOf = new Map(seeds.map((c) => [c.id, c.lane]))
  const owner = new Map(seeds.map((c) => [c.id, c.owner]))
  const returns = new Map(seeds.map((c) => [c.id, 0]))
  const progress = new Map(seeds.map((c) => [c.id, c.seedProgress ?? 0]))
  const slices = new Map<string, Slice[]>()
  const reserved = new Map<LaneId, number>()
  const segs = Object.fromEntries(TEAM.map((p) => [p.id, [] as Seg[]])) as Record<PersonId, Seg[]>
  const lands: Land[] = []
  const queued: Land[] = []
  const fulls: Array<{ at: number; who: PersonId; card: string; from: LaneId; to: LaneId }> = []
  const lastFull = new Map<LaneId, number>()

  const people = TEAM.map((p, i) => ({ id: p.id, t: 300 + i * 520, after: null as string | null, at: LANE_INDEX[seeds.find((c) => c.owner === p.id)?.lane ?? lanes[0].id] }))
  /** A paso de persona: un mouse no cruza el tablero en un segundo. */
  const travel = (from: number, to: number) => Math.min(4400, 1000 + Math.abs(to - from) * 520) + between(-100, 300)
  const count = (lane: LaneId) => order.filter((id) => laneOf.get(id) === lane).length
  const hasRoom = (lane: LaneId) => {
    const limit = LANE[lane].wip
    return limit === null || count(lane) + (reserved.get(lane) ?? 0) < limit
  }
  const push = (who: PersonId, seg: Seg) => segs[who].push(seg)
  const slice = (id: string, s: Slice) => slices.set(id, [...(slices.get(id) ?? []), s])

  const applyUpTo = (t: number) => {
    queued.sort((a, b) => a.at - b.at)
    while (queued.length && queued[0].at <= t) {
      const land = queued.shift() as Land
      laneOf.set(land.card, land.to)
      order.splice(order.indexOf(land.card), 1)
      order.push(land.card)
      reserved.set(land.to, Math.max(0, (reserved.get(land.to) ?? 1) - 1))
      const ended = LANE[land.to].kind === 'end'
      const back = land.kind === 'back'
      const value = ended ? 1 : isWork(LANE[land.to]) || back ? 0 : (progress.get(land.card) ?? 0)
      progress.set(land.card, value)
      slice(land.card, { t0: land.at, t1: land.at, p0: value, p1: value })
      lands.push(land)
    }
  }

  const carry = (p: (typeof people)[number], id: string, to: LaneId, verb: string) => {
    const from = laneOf.get(id) as LaneId
    const back = LANE_INDEX[to] < LANE_INDEX[from]
    const label = `${verb} ${LANE[to].name}`
    reserved.set(to, (reserved.get(to) ?? 0) + 1)
    let t = p.t
    const step = (type: SegType, ms: number, withLabel: boolean) => {
      push(p.id, { t0: t, t1: t + ms, type, card: id, lane: from, to, carry: true, label: withLabel ? label : '' })
      t += ms
    }
    step('seek', travel(p.at, LANE_INDEX[from]), false)
    step('grip', 300, true)
    step('lift', 320, true)
    step('haul', Math.min(4000, 1500 + Math.abs(LANE_INDEX[to] - LANE_INDEX[from]) * 800) + between(0, 500), true)
    p.at = LANE_INDEX[to]
    step('drop', 200, true)
    queued.push({ at: t, who: p.id, card: id, from, to, kind: LANE[to].kind === 'end' ? 'done' : back ? 'back' : 'move' })
    if (back) returns.set(id, (returns.get(id) ?? 0) + 1)
    const gap = between(1300, 2300)
    push(p.id, { t0: t, t1: t + gap, type: 'rest', label: 'disponible' })
    p.t = t + gap
    p.after = null
  }

  while (true) {
    const p = people.reduce((a, b) => (b.t < a.t ? b : a))
    if (p.t >= LIVE_MS) break
    applyUpTo(p.t)

    // Acaba de terminar de trabajar una nota: decide a dónde va.
    if (p.after) {
      const id = p.after
      const lane = laneOf.get(id) as LaneId
      const rework = LANE[lane].kind === 'check' ? reworkLane(lane) : null
      if (rework && rng() < 0.18 && (returns.get(id) ?? 0) < 2 && hasRoom(rework)) {
        carry(p, id, rework, 'regresa a')
        continue
      }
      const next = NEXT[lane]
      if (!next) {
        p.after = null
        continue
      }
      if (hasRoom(next)) {
        carry(p, id, next, 'lleva a')
        continue
      }
      if (p.t - (lastFull.get(next) ?? -Infinity) > 25_000) {
        fulls.push({ at: p.t, who: p.id, card: id, from: lane, to: next })
        lastFull.set(next, p.t)
      }
      const gap = between(900, 2000)
      push(p.id, { t0: p.t, t1: p.t + 3200, type: 'wait', card: id, to: next, label: `espera ${LANE[next].name}` })
      push(p.id, { t0: p.t + 3200, t1: p.t + 3200 + gap, type: 'rest', card: id, label: 'disponible', stay: true })
      p.t += 3200 + gap
      continue
    }

    const mine = order.filter((id) => owner.get(id) === p.id)
    let acted = false
    for (const lane of rightToLeft.filter(isWork)) {
      const id = mine.find((c) => laneOf.get(c) === lane.id)
      if (!id) continue
      const done = progress.get(id) ?? 0
      if (done >= 1) {
        p.after = id
        acted = true
        break
      }
      const base = lane.kind === 'check' ? between(4200, 6500) : between(6000, 9500)
      const ms = base * (1 - done) * scale
      const fly = travel(p.at, LANE_INDEX[lane.id])
      p.at = LANE_INDEX[lane.id]
      push(p.id, { t0: p.t, t1: p.t + fly, type: 'seek', card: id, lane: lane.id, label: '' })
      push(p.id, { t0: p.t + fly, t1: p.t + fly + ms, type: 'work', card: id, lane: lane.id, label: VERB[lane.id] ?? 'trabaja' })
      slice(id, { t0: p.t + fly, t1: p.t + fly + ms, p0: done, p1: 1 })
      progress.set(id, 1)
      p.t += fly + ms
      p.after = id
      acted = true
      break
    }
    if (acted) continue

    for (const lane of rightToLeft.filter((l) => l.kind === 'queue')) {
      const next = NEXT[lane.id]
      const id = mine.find((c) => laneOf.get(c) === lane.id)
      if (!id || !next || !hasRoom(next)) continue
      carry(p, id, next, 'lleva a')
      acted = true
      break
    }
    if (acted) continue

    const rest = between(2400, 4200) + between(900, 2000)
    const lastOwn = mine[mine.length - 1]
    if (lastOwn) p.at = LANE_INDEX[laneOf.get(lastOwn) as LaneId]
    push(p.id, { t0: p.t, t1: p.t + rest, type: 'idle', label: 'disponible' })
    p.t += rest
  }
  applyUpTo(LIVE_MS)

  const end = lanes[lanes.length - 1].id
  const finished = order.every((id) => laneOf.get(id) === end)
  return { segs, lands, fulls, slices, finished, closeAt: lands.length ? lands[lands.length - 1].at : 0 }
}

/** Busca el ritmo con el que el sprint cierra justo a tiempo, sin apurar los mouses. */
function bestRun(sprint: SprintId) {
  let best: ReturnType<typeof simulate> | null = null
  let bestGap = Infinity
  for (let scale = 0.4; scale <= 2.4; scale += 0.04) {
    const run = simulate(sprint, scale)
    if (!run.finished || run.closeAt > CLOSE_LATEST_MS) continue
    const gap = Math.abs(run.closeAt - CLOSE_TARGET_MS)
    if (gap < bestGap) {
      best = run
      bestGap = gap
    }
  }
  return best ?? simulate(sprint, 0.4)
}

/* ---------- Estados ya calculados: cada aterrizaje comparte las notas que no cambiaron ---------- */

function buildStates(sprint: SprintId, lands: Land[]) {
  const lanes = SPRINTS[sprint].lanes
  const end = lanes[lanes.length - 1].id
  const states: Array<{ cards: Card[]; archived: number }> = [{ cards: seedCards(sprint), archived: 0 }]
  for (const land of lands) {
    const previous = states[states.length - 1]
    const card = previous.cards.find((c) => c.id === land.card) as Card
    const ended = land.to === end
    const planMs = card.planMs ?? planFor(card.points)
    const startedAt = card.startedAt ?? land.at
    const dueAt = card.dueAt ?? startedAt + planMs
    const moved: Card = {
      ...card,
      lane: land.to,
      returned: land.kind === 'back',
      returns: card.returns + (land.kind === 'back' ? 1 : 0),
      planMs,
      startedAt,
      dueAt,
      doneAt: ended ? land.at : undefined,
    }
    if (ended) land.deltaMs = land.at - dueAt
    let cards = [...previous.cards.filter((c) => c.id !== card.id), moved]
    let archived = previous.archived
    const done = cards.filter((c) => c.lane === end)
    if (done.length > DONE_VISIBLE) {
      const drop = new Set(done.slice(0, done.length - DONE_VISIBLE).map((c) => c.id))
      cards = cards.filter((c) => !drop.has(c.id))
      archived += drop.size
    }
    states.push({ cards, archived })
  }
  return states
}

/** La isla: una cosa a la vez, el tiempo de leerla. Lo que ocurre a la vez sale junto. */
function buildAlerts(events: ScriptEvent[]) {
  const DWELL = 4500
  const LINGER = 1500
  const JOIN = 1400
  const MIN_AFTER_JOIN = 3200
  const MOVES_WAITING = 4
  const slots: AlertSlot[] = []
  const shownAt = new Array<number>(events.length).fill(Infinity)
  let pending: number[] = []
  let current: (AlertSlot & { lingered: boolean }) | null = null

  const show = (t: number) => {
    if (!pending.length) return
    const kind = events[pending[0]].kind
    const together = pending.filter((i) => events[i].kind === kind)
    pending = pending.filter((i) => events[i].kind !== kind)
    together.forEach((i) => {
      shownAt[i] = t
    })
    current = { at: t, until: t + DWELL, items: together.map((event) => ({ event, joinAt: t })), lingered: false }
    slots.push(current)
  }
  const expire = (t: number) => {
    while (current && current.until <= t) {
      const open: AlertSlot & { lingered: boolean } = current
      if (!pending.length && !open.lingered) {
        open.lingered = true
        open.until += LINGER
      } else {
        const when = open.until
        current = null
        show(when)
      }
    }
  }

  events.forEach((event, i) => {
    expire(event.at)
    const open = current as (AlertSlot & { lingered: boolean }) | null
    if (open && events[open.items[0].event].kind === event.kind && event.at - open.at < JOIN) {
      open.items.push({ event: i, joinAt: event.at })
      shownAt[i] = event.at
      if (open.until - event.at < MIN_AFTER_JOIN) open.until = event.at + MIN_AFTER_JOIN
      return
    }
    if (event.kind === 'move') {
      const moves = pending.filter((p) => events[p].kind === 'move')
      if (moves.length >= MOVES_WAITING) pending = pending.filter((p) => p !== moves[0])
      pending.push(i)
    } else {
      const firstMove = pending.findIndex((p) => events[p].kind === 'move')
      if (firstMove < 0) pending.push(i)
      else pending.splice(firstMove, 0, i)
    }
    if (!open) show(event.at)
    else if (open.lingered) {
      open.until = event.at
      current = null
      show(event.at)
    }
  })
  expire(Infinity)
  return { slots, shownAt }
}

/** El mismo criterio del director de cámara, decidido de antemano. */
function buildShots(segs: Record<PersonId, Seg[]>) {
  const shots: Shot[] = []
  const pointers = new Map(TEAM.map((p) => [p.id, 0]))
  const segAt = (id: PersonId, t: number) => {
    const list = segs[id]
    let i = pointers.get(id) ?? 0
    while (i < list.length && list[i].t1 <= t) i += 1
    pointers.set(id, i)
    const seg = list[i]
    return seg && seg.t0 <= t ? seg : null
  }
  let holdUntil = 0
  let following: string | null = null
  let count = 0
  let lastWorked: PersonId | null = null
  for (let t = 0; t < LIVE_MS; t += 100) {
    const active = TEAM.map((p) => ({ id: p.id, seg: segAt(p.id, t) }))
    const trips = active.flatMap(({ seg }) => (seg?.carry && seg.card && seg.to && seg.lane ? [{ card: seg.card, to: seg.to, from: seg.lane }] : []))
    const trip = trips.find((x) => x.card === following) ?? trips[0]
    if (trip && trip.card !== following) {
      shots.push({ at: t, kind: 'trip', ...trip })
      following = trip.card
      holdUntil = t + 1400
      continue
    }
    if (trip || t < holdUntil) continue
    following = null
    count += 1
    const busy = active.filter(({ seg }) => seg?.type === 'work' && seg.card)
    if (busy.length === 0 || count % 6 === 0) {
      shots.push({ at: t, kind: 'overview' })
      holdUntil = t + 2400
      continue
    }
    const next = busy.find((b) => b.id !== lastWorked) ?? busy[0]
    lastWorked = next.id
    shots.push({ at: t, kind: 'close', card: next.seg?.card as string, lane: next.seg?.lane as LaneId })
    holdUntil = t + 3000
  }
  return shots
}

/* ---------- El guion de cada sprint ---------- */

/** Si dos notas van a la vez al mismo carril, cada una sabe su lugar: nunca se encimen al llegar. */
function assignSlots(segs: Record<PersonId, Seg[]>) {
  const hauls = Object.values(segs).flat().filter((s) => s.type === 'haul' && s.to)
  const DROP_MS = 200
  for (const haul of hauls) {
    const landsAt = haul.t1 + DROP_MS
    haul.slot = hauls.filter((other) => other !== haul && other.to === haul.to && other.t1 + DROP_MS < landsAt && other.t1 + DROP_MS > haul.t0).length
  }
}

function build(sprint: SprintId) {
  const run = bestRun(sprint)
  assignSlots(run.segs)
  const states = buildStates(sprint, run.lands)
  const titleOf = (id: string) => SPRINTS[sprint].seed.find((c) => c.id === id)
  const events: ScriptEvent[] = [
    ...run.lands.map((l) => ({ at: l.at, who: l.who, owner: titleOf(l.card)?.owner ?? l.who, kind: l.kind, card: l.card, title: titleOf(l.card)?.title ?? '', from: l.from, to: l.to, deltaMs: l.deltaMs })),
    ...run.fulls.map((f) => ({ at: f.at, who: f.who, owner: f.who, kind: 'full' as const, card: f.card, title: titleOf(f.card)?.title ?? '', from: f.from, to: f.to })),
  ].sort((a, b) => a.at - b.at)
  const { slots, shownAt } = buildAlerts(events)
  return { sprint, segs: run.segs, lands: run.lands, slices: run.slices, closeAt: run.closeAt, states, events, alerts: slots, shownAt, shots: buildShots(run.segs), flow: buildFlow(sprint, states, run.lands) }
}

/** Diagrama de flujo acumulado, ya calculado cada 4 segundos del sprint. */
function buildFlow(sprint: SprintId, states: Array<{ cards: Card[]; archived: number }>, lands: Land[]) {
  const lanes = SPRINTS[sprint].lanes
  const groups: LaneId[][] = []
  for (const lane of lanes) {
    if (lane.kind === 'end') continue
    if (lane.stage) groups.push([lane.id])
    else groups[groups.length - 1].push(lane.id)
  }
  const end = lanes[lanes.length - 1].id
  const samples: Array<[number, number, number, number]> = []
  let index = 0
  for (let t = 0; t < LIVE_MS; t += 4000) {
    while (index < lands.length && lands[index].at <= t) index += 1
    const { cards, archived } = states[index]
    const inGroup = (i: number) => cards.filter((c) => groups[i].includes(c.lane)).length
    samples.push([cards.filter((c) => c.lane === end).length + archived, inGroup(2), inGroup(1), inGroup(0)])
  }
  return samples
}

const cache = new Map<SprintId, ReturnType<typeof build>>()
export function scriptFor(sprint: SprintId) {
  let script = cache.get(sprint)
  if (!script) {
    script = build(sprint)
    cache.set(sprint, script)
  }
  return script
}

/* ---------- Lecturas para un instante ---------- */

/** Cuántos aterrizajes ya ocurrieron. */
export function landsBefore(sprint: SprintId, local: number) {
  const { lands } = scriptFor(sprint)
  let low = 0
  let high = lands.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (lands[mid].at <= local) low = mid + 1
    else high = mid
  }
  return low
}

/* Pasa los tiempos relativos a la hora real, sin crear notas nuevas si nada cambió. */
const wallCards = new WeakMap<Card, { start: number; card: Card }>()
const wallLists = new WeakMap<Card[], { start: number; cards: Card[] }>()
function toWall(card: Card, start: number) {
  const known = wallCards.get(card)
  if (known?.start === start) return known.card
  const add = (v?: number) => (v === undefined ? undefined : v + start)
  const real = { ...card, startedAt: add(card.startedAt), dueAt: add(card.dueAt), doneAt: add(card.doneAt) }
  wallCards.set(card, { start, card: real })
  return real
}

export function boardAt(sprint: SprintId, now: number) {
  const start = sprintStart(sprint, now)
  const index = landsBefore(sprint, now - start)
  const state = scriptFor(sprint).states[index]
  const known = wallLists.get(state.cards)
  const cards = known?.start === start ? known.cards : state.cards.map((c) => toWall(c, start))
  if (known?.start !== start) wallLists.set(state.cards, { start, cards })
  return { index, cards, archived: state.archived, start }
}

export function progressAt(sprint: SprintId, id: string, local: number, seed = 0) {
  const list = scriptFor(sprint).slices.get(id)
  let value = seed
  if (!list) return value
  for (const s of list) {
    if (local < s.t0) break
    if (local >= s.t1) value = s.p1
    else return s.p0 + ((local - s.t0) / (s.t1 - s.t0)) * (s.p1 - s.p0)
  }
  return value
}

export const flowAt = (sprint: SprintId, local: number) => scriptFor(sprint).flow.slice(0, Math.max(1, Math.floor(local / 4000) + 1))
