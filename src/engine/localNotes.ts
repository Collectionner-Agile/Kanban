import { animate, motionValue } from 'motion/react'
import { LANE, LANE_INDEX, NEXT, PREVIOUS, SPRINTS, reworkLane, type Card, type LaneId, type ServiceClass, type SprintId } from '../data/board'
import type { PersonId } from '../data/team'
import { cardRect, ghostFace, laneDropPoint, pickUp, portraitPoint, settle } from './carry'
import { markInput, goToCard } from './camera'
import { dayText, planFor, serverNow } from './clock'
import { boardAt } from './script'
import { findCard, flashLane, getState, progressOf, react, removeGhost, setGhost, setState, type Activity, type LocalCursor } from '../store/board'

/**
 * Notas propias: sin servidor no pueden llegar a otras pantallas, así que viven en este navegador.
 * Corren encima del guion sin alterarlo: si una nota del guion necesita el sitio, la propia cede.
 */
const STORAGE_KEY = 'collectionner.notas.v1'
export const MAX_NOTES = 12
export const TITLE_MAX = 60
export const NOTE_MAX = 120
const PERSON_IDS: PersonId[] = ['diego', 'luis', 'josediego', 'brenda', 'beth']
const CLASSES: ServiceClass[] = ['urgent', 'date', 'standard', 'improve']

type Phase = 'rest' | 'work' | 'carry'
type Run = {
  phase: Phase
  until: number
  startedPhase: number
  from: number
  to?: LaneId
  cursor?: LocalCursor
  stop?: () => void
  waitedFor?: LaneId
  checked?: boolean
}

let notes: Card[] = []
const runs = new Map<string, Run>()
let seq = 1
let storageOk = true
const localEvents: Activity[] = []
let eventSeq = 1
let localAlert: { until: number; item: Activity } | null = null

export const storageAvailable = () => storageOk
export const localFor = (sprint: SprintId) => notes.filter((n) => n.sprint === sprint)
export const localCount = () => notes.length
export const localActivity = () => localEvents
export const currentLocalAlert = (now: number) => (localAlert && now < localAlert.until ? localAlert.item : null)

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    storageOk = true
  } catch {
    storageOk = false
  }
}

/** Lo guardado puede estar dañado o ser de otra versión: lo que no se entiende se descarta. */
function isValid(raw: unknown): raw is Card {
  if (!raw || typeof raw !== 'object') return false
  const c = raw as Partial<Card>
  return (
    typeof c.id === 'string' &&
    c.id.startsWith('TU-') &&
    typeof c.title === 'string' &&
    c.title.length > 0 &&
    c.title.length <= TITLE_MAX &&
    PERSON_IDS.includes(c.owner as PersonId) &&
    CLASSES.includes(c.cls as ServiceClass) &&
    typeof c.lane === 'string' &&
    c.lane in LANE &&
    (c.sprint === 1 || c.sprint === 2) &&
    SPRINTS[c.sprint].lanes.some((l) => l.id === c.lane) &&
    typeof c.points === 'number'
  )
}

export function loadNotes() {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    notes = Array.isArray(parsed) ? parsed.filter(isValid).slice(0, MAX_NOTES).map((c) => ({ ...c, local: true })) : []
    const highest = notes.reduce((n, c) => Math.max(n, Number(c.id.slice(3)) || 0), 0)
    seq = highest + 1
  } catch {
    notes = []
    storageOk = false
  }
}

const refresh = (sprint: SprintId) => {
  if (getState().sprint !== sprint) return
  const board = boardAt(sprint, serverNow())
  setState({ cards: [...board.cards, ...localFor(sprint)] })
}

function update(id: string, patch: Partial<Card>) {
  notes = notes.map((n) => (n.id === id ? { ...n, ...patch } : n))
  save()
  const note = notes.find((n) => n.id === id)
  if (note?.sprint) refresh(note.sprint)
}

function tell(note: Card, kind: Activity['kind'], who: Activity['who'], from: LaneId | null, to: LaneId | null, deltaMs?: number, alert = true) {
  const item: Activity = { id: 9_000_000 + eventSeq++, at: serverNow(), sprint: note.sprint as SprintId, who, owner: note.owner, kind, card: note.id, title: note.title, from, to, deltaMs }
  localEvents.unshift(item)
  localEvents.splice(60)
  if (alert) localAlert = { until: item.at + 4500, item }
}

/* ---------- Comprobaciones del formulario: se usan antes de crear ---------- */

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase()

export type Draft = { title: string; owner: PersonId | null; cls: ServiceClass; points: number; note: string; due: string }
export type DraftErrors = Partial<Record<'title' | 'owner' | 'due' | 'form', string>>

const today = () => {
  const d = new Date(serverNow())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const todayISO = today

export function checkDraft(draft: Draft, sprint: SprintId): DraftErrors {
  const errors: DraftErrors = {}
  const title = draft.title.trim().replace(/\s+/g, ' ')
  if (!title) errors.title = 'Escribe de qué trata la nota.'
  else if (title.length < 3) errors.title = 'Usa al menos 3 caracteres.'
  else if (title.length > TITLE_MAX) errors.title = `Máximo ${TITLE_MAX} caracteres.`
  else if (!/[\p{L}\p{N}]/u.test(title)) errors.title = 'Incluye al menos una letra o un número.'
  else {
    const seen = [...boardAt(sprint, serverNow()).cards, ...localFor(sprint)]
    if (seen.some((c) => plain(c.title) === plain(title))) errors.title = 'Ya hay una nota con ese título en este sprint.'
  }
  if (!draft.owner) errors.owner = 'Elige quién se hace cargo.'
  if (draft.cls === 'date') {
    if (!draft.due) errors.due = 'Elige la fecha de entrega.'
    else if (draft.due < today()) errors.due = 'La fecha no puede ser anterior a hoy.'
  }
  if (notes.length >= MAX_NOTES) errors.form = `Ya tienes ${MAX_NOTES} notas. Quita una para crear otra.`
  return errors
}

/* ---------- Crear y quitar ---------- */

export function createNote(draft: Draft, sprint: SprintId) {
  const owner = draft.owner as PersonId
  const now = serverNow()
  const lane = SPRINTS[sprint].lanes[0].id
  const id = `TU-${seq++}`
  const note: Card = {
    id,
    key: 'Tu nota',
    title: draft.title.trim().replace(/\s+/g, ' '),
    owner,
    cls: draft.cls,
    lane,
    points: draft.points,
    returns: 0,
    planMs: planFor(draft.points),
    createdAt: now,
    local: true,
    sprint,
    note: draft.note.trim() || undefined,
    due: draft.cls === 'date' && draft.due ? dayText(new Date(`${draft.due}T12:00`).getTime()) : undefined,
  }
  notes = [...notes, note]
  save()
  refresh(sprint)
  tell(note, 'new', 'user', null, lane)
  runs.set(id, { phase: 'rest', startedPhase: now, from: 0, until: now + 1500 })
  // La cámara la muestra un momento, y luego sigue con su trabajo.
  requestAnimationFrame(() => requestAnimationFrame(() => goToCard(id)))
  return id
}

function endCarry(id: string) {
  const run = runs.get(id)
  if (!run) return
  run.stop?.()
  if (run.cursor) {
    const cursorId = run.cursor.id
    setState((s) => ({ localCursors: s.localCursors.filter((c) => c.id !== cursorId) }))
  }
  run.cursor = undefined
  run.stop = undefined
}

export function removeNote(id: string) {
  const note = notes.find((n) => n.id === id)
  if (!note) return
  endCarry(id)
  runs.delete(id)
  removeGhost(id)
  notes = notes.filter((n) => n.id !== id)
  save()
  if (note.sprint) refresh(note.sprint)
  markInput()
}

/** Un cambio de sprint interrumpe cualquier traslado: la nota se queda donde estaba y sigue al volver. */
export function haltNotes(now: number) {
  for (const [id, run] of runs) {
    endCarry(id)
    if (run.phase === 'carry') {
      run.phase = 'rest'
      run.until = now + 800
    }
  }
}

function setLabel(id: string, label: string, pressed: boolean) {
  setState((s) => ({ localCursors: s.localCursors.map((c) => (c.id === id ? { ...c, label, pressed } : c)) }))
}

/* ---------- Avance de cada nota ---------- */

const spaceIn = (lane: LaneId, sprint: SprintId, now: number, moving: string) => {
  const limit = LANE[lane].wip
  if (limit === null) return true
  // Mira unos segundos adelante en el guion: así no entra para tener que salir enseguida.
  const inLane = (at: number) => boardAt(sprint, at).cards.filter((c) => c.lane === lane).length
  const scripted = Math.max(inLane(now), inLane(now + 12_000))
  const own = localFor(sprint).filter((c) => c.lane === lane).length
  const coming = [...runs.entries()].filter(([id, r]) => id !== moving && r.phase === 'carry' && r.to === lane).length
  return scripted + own + coming < limit
}

function startCarry(note: Card, to: LaneId, now: number) {
  const point = portraitPoint(note.id)
  const rect = cardRect(note.id)
  const drop = laneDropPoint(to)
  const run = runs.get(note.id) as Run
  const showing = getState().agentsOn
  const ms = 2200
  if (!showing || !point || !rect || !drop) {
    // Sin movimiento (o sin dónde dibujar): llega igual, sin vuelo.
    run.phase = 'carry'
    run.to = to
    run.until = now
    return
  }
  const ghost = pickUp(note.id, note.owner)
  if (!ghost) {
    run.until = now + 600
    return
  }
  setGhost(note.id, { target: to })
  const back = LANE_INDEX[to] < LANE_INDEX[note.lane]
  const cursor: LocalCursor = { id: `cursor-${note.id}`, owner: note.owner, label: `(tu nota) ${back ? 'regresa a' : 'lleva a'} ${LANE[to].name}`, pressed: true, x: motionValue(point.x), y: motionValue(point.y) }
  setState((s) => ({ localCursors: [...s.localCursors, cursor] }))
  const offX = point.x - ghost.x.get()
  const offY = point.y - ghost.y.get()
  const subs = [cursor.x.on('change', (v) => ghost.x.set(v - offX)), cursor.y.on('change', (v) => ghost.y.set(v - offY))]
  const ease = [0.42, 0, 0.18, 1] as const
  const flights = [
    animate(cursor.x, drop.x + offX - ghost.w / 2, { duration: ms / 1000, ease }),
    animate(cursor.y, drop.y + offY - rect.h / 2, { duration: ms / 1000, ease }),
  ]
  run.phase = 'carry'
  run.to = to
  run.until = now + ms
  run.cursor = cursor
  run.stop = () => {
    subs.forEach((off) => off())
    flights.forEach((f) => f.stop())
  }
}

async function land(note: Card, to: LaneId, now: number) {
  const ghost = getState().ghosts.find((g) => g.id === note.id)
  if (ghost) setGhost(note.id, { target: null, landing: true, airFace: ghostFace(ghost) })
  endCarry(note.id)
  const ended = LANE[to].kind === 'end'
  const back = LANE_INDEX[to] < LANE_INDEX[note.lane]
  const planMs = note.planMs ?? planFor(note.points)
  const startedAt = note.startedAt ?? now
  const dueAt = note.dueAt ?? startedAt + planMs
  update(note.id, { lane: to, returned: back, returns: note.returns + (back ? 1 : 0), startedAt, dueAt, doneAt: ended ? now : undefined })
  progressOf(note.id).set(ended ? 1 : 0)
  tell(note, ended ? 'done' : back ? 'back' : 'move', note.owner, note.lane, to, ended ? now - dueAt : undefined, ended || back)
  const run = runs.get(note.id)
  if (run) {
    run.phase = 'rest'
    run.to = undefined
    run.until = now + 1200
    run.checked = false
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const live = getState().ghosts.find((g) => g.id === note.id)
  if (live) await settle(live, cardRect(note.id), 0.6)
  if (findCard(note.id)) react(note.id, ended ? 'done' : back ? 'down' : 'up')
}

/** Si llega una nota del guion y ya no cabe la propia, la propia vuelve un carril atrás. */
function makeWay(sprint: SprintId, now: number) {
  for (const lane of SPRINTS[sprint].lanes) {
    if (lane.wip === null) continue
    const scripted = boardAt(sprint, now).cards.filter((c) => c.lane === lane.id).length
    const own = localFor(sprint).filter((c) => c.lane === lane.id && !c.doneAt)
    let over = scripted + own.length - lane.wip
    for (let i = own.length - 1; i >= 0 && over > 0; i--, over--) {
      const note = own[i]
      const run = runs.get(note.id)
      if (run?.phase === 'carry') continue
      const back = PREVIOUS[lane.id]
      if (!back) continue
      update(note.id, { lane: back, returned: true, returns: note.returns + 1 })
      progressOf(note.id).set(0)
      flashLane(lane.id)
      tell(note, 'full', note.owner, back, lane.id)
      if (run) {
        run.phase = 'rest'
        run.until = now + 2500
      }
    }
  }
}

/** Se llama con el tablero en vivo y mirando el sprint en curso. */
export function tickNotes(sprint: SprintId, now: number) {
  // El tiempo de una nota solo corre mientras su sprint está en vivo.
  for (const note of notes) {
    if (note.sprint !== sprint && !note.pausedAt && !note.doneAt) update(note.id, { pausedAt: now })
    if (note.sprint === sprint && note.pausedAt) {
      const gap = now - note.pausedAt
      update(note.id, { pausedAt: undefined, startedAt: note.startedAt && note.startedAt + gap, dueAt: note.dueAt && note.dueAt + gap })
    }
  }
  makeWay(sprint, now)

  for (const note of localFor(sprint)) {
    if (LANE[note.lane].kind === 'end') continue
    let run = runs.get(note.id)
    if (!run) {
      run = { phase: 'rest', startedPhase: now, from: progressOf(note.id).get(), until: now + 1200 }
      runs.set(note.id, run)
    }
    if (run.phase === 'work') {
      const span = Math.max(1, run.until - run.startedPhase)
      progressOf(note.id).set(Math.min(1, run.from + ((now - run.startedPhase) / span) * (1 - run.from)))
    }
    if (now < run.until) continue

    if (run.phase === 'carry') {
      void land(note, run.to as LaneId, now)
      continue
    }

    const kind = LANE[note.lane].kind
    if ((kind === 'work' || kind === 'check') && progressOf(note.id).get() < 1 && run.phase !== 'work') {
      const base = kind === 'check' ? 5200 : 7500
      run.phase = 'work'
      run.startedPhase = now
      run.from = progressOf(note.id).get()
      run.until = now + base * (1 - run.from) * (0.7 + note.points * 0.12)
      continue
    }
    run.phase = 'rest'
    progressOf(note.id).set(kind === 'queue' ? 0 : 1)

    // Una comprobación puede fallar: la nota vuelve a trabajo, como cualquier otra (como mucho una vez).
    if (kind === 'check' && !run.checked) {
      run.checked = true
      const rework = reworkLane(note.lane)
      const roll = (note.id.charCodeAt(note.id.length - 1) * 31 + LANE_INDEX[note.lane] * 17) % 100
      if (rework && note.returns < 1 && roll < 18 && spaceIn(rework, sprint, now, note.id)) {
        startCarry(note, rework, now)
        continue
      }
    }

    const next = NEXT[note.lane]
    if (!next) continue
    if (!spaceIn(next, sprint, now, note.id)) {
      if (run.waitedFor !== next) {
        run.waitedFor = next
        flashLane(next)
        tell(note, 'full', note.owner, note.lane, next)
      }
      run.until = now + 1500
      continue
    }
    run.waitedFor = undefined
    startCarry(note, next, now)
    if (run.cursor) setLabel(run.cursor.id, run.cursor.label, true)
  }
}
