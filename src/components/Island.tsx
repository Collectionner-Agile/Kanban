import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LANE, SPRINTS, type SprintId } from '../data/board'
import { PERSON, TEAM, type PersonId } from '../data/team'
import { goToCard, overview, refit, setCameraInset } from '../engine/camera'
import { clockText, spanText, useClock } from '../engine/clock'
import { clearActivity, dismissActivity, holdIsland, setPanelOpen, startIsland, useBoard, type Activity, type ActivityKind, type Face } from '../store/board'
import { Clawd, type ClawdAction, type ClawdEyes, type ClawdGear } from './Clawd'
import { Portrait } from './Portrait'
import { Check, ChevronRight, Close, Lock, Plus, Returned } from './icons'

const ROWS_SHOWN = 40
/** Las primeras filas salen de inmediato; el resto entra cuando la forma ya terminó de crecer. */
const ROWS_FIRST = 10
/** A partir de este ancho la isla vive arriba, entre los controles, y el historial va a la derecha. */
const WIDE_FROM = 1240
const PANEL_WIDTH = 360
const EDGE = 16

/* El alto del historial se calcula, no se mide: así crece y se encoge sin un solo salto. */
const HEAD_H = 128
const ROW_H = 68
const LABEL_H = 30
const FOOT_H = 28
const EMPTY_H = 72
const END_PAD = 10

const FACE: Record<ActivityKind, Face> = { move: 'happy', back: 'worried', done: 'celebrate', full: 'confused', new: 'happy', tip: 'idle' }

/** A quién se ve en la notificación: quien actuó, o la dueña de la nota si fuiste tú. */
const faceOf = (a: Activity): PersonId => (a.who === 'user' ? a.owner : a.who)
const nameOf = (a: Activity) => (a.who === 'user' ? 'Tú' : PERSON[a.who].name)

const joinNames = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`)

/** La frase del grupo: uno, varios o todo el equipo, con el verbo que corresponde. */
function groupParts(items: Activity[], compact = false) {
  const lead = items[0]
  const names = [...new Set(items.map(nameOf))]
  const everyone = names.length === TEAM.length
  const many = names.length > 1
  const you = !many && lead.who === 'user'
  const who = everyone ? 'Todo el equipo' : compact && names.length >= 3 ? `${names.length} personas` : joinNames(names)
  const single = everyone || !many
  const lanes = new Set(items.map((a) => a.to))
  const lane = lanes.size === 1 && lead.to ? LANE[lead.to].name : null
  const notes = items.length === 1 ? 'una nota' : compact ? '' : `${items.length} notas`
  let verb = ''
  let place: string | null = null
  if (lead.kind === 'move') {
    verb = you ? 'pasaste' : single ? 'pasó' : 'pasaron'
    if (lane) {
      verb += ' a'
      place = lane
    } else verb = `${verb} ${notes}`.trim()
  } else if (lead.kind === 'back') {
    verb = you ? 'regresaste' : single ? 'regresó' : 'regresaron'
    if (lane) {
      verb += ' a'
      place = lane
    } else verb = `${verb} ${notes}`.trim()
  } else if (lead.kind === 'done') {
    verb = `${you ? 'terminaste' : single ? 'terminó' : 'terminaron'} ${notes}`.trim()
  } else if (lead.kind === 'full') {
    verb = `${you ? 'no pudiste' : single ? 'no pudo' : 'no pudieron'} pasar a`
    place = lane ?? 'un carril lleno'
  } else {
    verb = 'agregaste a'
    place = lane
  }
  return { who, verb, place }
}

function Sentence({ items, compact = false }: { items: Activity[]; compact?: boolean }) {
  const { who, verb, place } = groupParts(items, compact)
  return (
    <>
      <b className="font-semibold text-white">{who}</b> {verb}
      {place && (
        <>
          {' '}
          <b className="font-semibold text-white">{place}</b>
        </>
      )}
    </>
  )
}

function plainSentence(items: Activity[]) {
  if (items[0].kind === 'tip') return items[0].title
  const { who, verb, place } = groupParts(items)
  return `${who} ${verb}${place ? ` ${place}` : ''}: ${items.map((a) => a.title).join(', ')}`
}

function KindMark({ kind, size = 15 }: { kind: ActivityKind; size?: number }) {
  if (kind === 'done') return <Check size={size} className="text-[#4FD19A]" />
  if (kind === 'back') return <Returned size={size} className="text-[#FF8A57]" />
  if (kind === 'full') return <Lock size={size} className="text-[#FF8A57]" />
  if (kind === 'new') return <Plus size={size} className="text-white/70" />
  return <ChevronRight size={size} className="text-white/70" />
}

const ago = (at: number, now: number) => {
  const s = Math.round((now - at) / 1000)
  if (s < 8) return 'ahora'
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  return new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function Meta({ a }: { a: Activity }) {
  const now = useClock((at) => Math.floor(at / 5000) * 5000)
  const parts = [`${clockText(a.at)}, ${ago(a.at, now)}`]
  if (a.kind === 'done' && a.deltaMs !== undefined) parts.push(a.deltaMs > 0 ? `${spanText(a.deltaMs)} tarde` : `sobraron ${spanText(a.deltaMs)}`)
  else if (a.from && a.to && a.kind !== 'full') parts.push(`desde ${LANE[a.from].name}`)
  if (a.kind === 'full' && a.to) parts.push(`WIP ${LANE[a.to].wip ?? ''} lleno`)
  if (a.who === 'user' || a.who !== a.owner) parts.push(`nota de ${PERSON[a.owner].name}`)
  return <span className="block truncate text-[11.5px] leading-[1.3] text-white/55">{parts.join(', ')}</span>
}

const CLAWD_FOR: Record<ActivityKind, { eyes: ClawdEyes; action: ClawdAction; gear: ClawdGear[] }> = {
  move: { eyes: 'happy', action: 'nod', gear: [] },
  back: { eyes: 'wide', action: 'shiver', gear: [] },
  done: { eyes: 'sparkly', action: 'dance', gear: ['party'] },
  full: { eyes: 'tall', action: 'idle', gear: ['glasses'] },
  new: { eyes: 'happy', action: 'nod', gear: [] },
  tip: { eyes: 'happy', action: 'wave', gear: [] },
}
const REST_LOOK = { eyes: 'dots' as const, action: 'idle' as const, gear: [] as ClawdGear[] }
const CLAWD_W = 42.5
const CLAWD_H = 32.5

/* ---------- La forma: un solo elemento que cambia de tamaño ---------- */

type Mode = 'hidden' | 'idle' | 'alert' | 'open'
type Size = { W: number; H: number; dockTop: number }

function readSize(): Size {
  const stage = document.querySelector<HTMLElement>('[data-stage]')
  const dock = document.querySelector<HTMLElement>('[data-dock]')
  const W = stage?.clientWidth ?? window.innerWidth
  const H = stage?.clientHeight ?? window.innerHeight
  const padding = W >= 640 ? 16 : 12
  return { W, H, dockTop: H - (dock?.offsetHeight ?? 66) - padding }
}

const faceStep = (wide: boolean) => (wide ? 24 : 15)
const FACE_SIZE = 40

/** El ancho del aviso crece con las caras que lleva, sin chocar con los controles. */
function alertWidth(people: number, { W }: Size) {
  const wide = W >= WIDE_FROM
  const text = people === 1 ? 296 : people === 2 ? 316 : 344
  const ideal = 10 + FACE_SIZE + (people - 1) * faceStep(wide) + 12 + text + 12 + 42 + 12 + 6
  return wide ? Math.min(ideal, W - 814) : Math.min(ideal, W - 24)
}

function panelFrame(body: number, { W, H, dockTop }: Size) {
  const wide = W >= WIDE_FROM
  const wanted = HEAD_H + body
  if (wide) {
    const height = Math.min(wanted, dockTop - 72)
    return { x: W - PANEL_WIDTH - EDGE, y: 64, width: PANEL_WIDTH, height, capped: wanted > dockTop - 72 }
  }
  // En pantallas chicas crece hacia arriba desde el mapa, sin tapar los controles.
  const width = Math.min(W - 24, 480)
  const most = Math.min(dockTop - 68, Math.max(420, H * 0.72))
  const height = Math.min(wanted, most)
  return { x: (W - width) / 2, y: dockTop - 8 - height, width, height, capped: wanted > most }
}

function shapeOf(mode: Mode, size: Size, people: number, body: number) {
  const wide = size.W >= WIDE_FROM
  if (mode === 'open') {
    const { x, y, width, height } = panelFrame(body, size)
    return { x, y, width, height, borderRadius: 24 }
  }
  const width = mode === 'hidden' ? 44 : mode === 'idle' ? 240 : alertWidth(people, size)
  const height = mode === 'hidden' ? 10 : mode === 'idle' ? 38 : 60
  // Arriba crece hacia abajo; junto al mapa crece hacia arriba. Oculta queda en el centro de su sitio.
  const rest = wide ? EDGE + (mode === 'hidden' ? 14 : 0) : size.dockTop - 8 - (mode === 'hidden' ? 24 : height)
  return { x: (size.W - width) / 2, y: rest, width, height, borderRadius: height / 2 }
}

/* ---------- Contenidos de la isla ---------- */

/** Caras de quienes actuaron: entran de una en una y el grupo se acomoda solo. */
function Faces({ items, wide }: { items: Activity[]; wide: boolean }) {
  const lead = items[0]
  const people = [...new Map(items.map((a) => [faceOf(a), a])).values()]
  const step = faceStep(wide)
  return (
    <motion.span
      className="relative block shrink-0"
      style={{ height: FACE_SIZE }}
      initial={false}
      animate={{ width: FACE_SIZE + (people.length - 1) * step }}
      transition={{ type: 'spring', visualDuration: 0.36, bounce: 0.1 }}
    >
      <AnimatePresence initial={false}>
        {people.map((a, i) => (
          <motion.span
            key={faceOf(a)}
            className="absolute top-0 block rounded-full"
            style={{ zIndex: people.length - i, boxShadow: people.length > 1 ? '0 0 0 2px var(--island)' : undefined }}
            initial={{ scale: 0.4, opacity: 0, left: i * step }}
            animate={{ scale: 1, opacity: 1, left: i * step }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', visualDuration: 0.36, bounce: 0.14 }}
          >
            <Portrait person={PERSON[faceOf(a)]} face={FACE[lead.kind]} size={FACE_SIZE} index={i} still />
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.span>
  )
}

function IdleContent({ onOpen, count, recent }: { onOpen: () => void; count: number; recent: PersonId[] }) {
  return (
    <button
      type="button"
      data-island-trigger
      aria-expanded={false}
      aria-controls="activity-panel"
      aria-label={`Abrir actividad, ${count} ${count === 1 ? 'movimiento' : 'movimientos'}`}
      onClick={onOpen}
      className="flex size-full items-center gap-2 pr-[52px] pl-2 text-[13px] font-medium text-white"
    >
      <span className="flex shrink-0 -space-x-1.5">
        {recent.map((id, i) => (
          <span key={id} className="block rounded-full shadow-[0_0_0_2px_var(--island)]">
            <Portrait person={PERSON[id]} face="idle" size={24} index={i} still />
          </span>
        ))}
      </span>
      <span className="flex-1 text-left">Actividad</span>
      <span className="text-white/60 tabular-nums">{count}</span>
    </button>
  )
}

function AlertContent({ items, waiting, wide, compact, onOpen }: { items: Activity[]; waiting: number; wide: boolean; compact: boolean; onOpen: () => void }) {
  const lead = items[0]
  const isTip = lead.kind === 'tip'
  return (
    <button
      type="button"
      data-island-trigger
      aria-expanded={false}
      aria-controls="activity-panel"
      aria-label={`Abrir actividad. ${plainSentence(items)}`}
      onClick={onOpen}
      className="flex size-full items-center gap-3 pr-[60px] pl-2.5 text-left"
    >
      {isTip ? (
        <span className="flex shrink-0 -space-x-3">
          {TEAM.slice(0, 2).map((person, i) => (
            <span key={person.id} className="block rounded-full shadow-[0_0_0_2px_var(--island)]">
              <Portrait person={person} face="happy" size={FACE_SIZE} index={i} still />
            </span>
          ))}
        </span>
      ) : (
        <Faces items={items} wide={wide} />
      )}
      <span className="min-w-0 flex-1">
        <span data-island-line className="block truncate text-[14px] leading-[1.3] text-white/75">
          {isTip ? <b className="font-semibold text-white">{lead.title}</b> : <Sentence items={items} compact={compact} />}
        </span>
        <span className="block truncate text-[13px] leading-[1.35] text-white/60">{isTip ? 'O mira cómo avanza el equipo' : joinNames(items.map((a) => a.title))}</span>
      </span>
      {waiting > 0 && <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[11.5px] leading-none font-medium text-white/80 tabular-nums">+{waiting}</span>}
    </button>
  )
}

const rowMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: ROW_H, opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { type: 'spring', visualDuration: 0.42, bounce: 0 },
} as const

const Row = memo(function Row({ a, sprint }: { a: Activity; sprint: SprintId }) {
  const exists = useBoard((s) => (a.card ? s.cards.some((c) => c.id === a.card) : false))
  const items = useMemo(() => [a], [a])
  const body = (
    <>
      <span className="shrink-0">
        <Portrait person={PERSON[faceOf(a)]} face={FACE[a.kind]} size={34} still />
      </span>
      <span className="min-w-0 flex-1 pr-7">
        <span className="block truncate text-[13.5px] leading-[1.3] text-white/75">
          <Sentence items={items} />
        </span>
        <span className="block truncate text-[13px] leading-[1.35] text-white/85" title={a.title}>
          {a.title}
        </span>
        <Meta a={a} />
      </span>
    </>
  )
  const reachable = exists && a.sprint === sprint && a.card
  return (
    <motion.li data-activity-row className="group relative overflow-hidden" {...rowMotion}>
      {reachable ? (
        <button
          type="button"
          onClick={() => goToCard(a.card as string)}
          className="flex w-full items-center gap-2.5 rounded-[14px] px-2 text-left transition-colors duration-150 hover:bg-white/8"
          style={{ height: ROW_H }}
        >
          {body}
        </button>
      ) : (
        <div className="flex w-full items-center gap-2.5 px-2" style={{ height: ROW_H }}>
          {body}
        </div>
      )}
      <span className="pointer-events-none absolute top-[11px] right-2 grid size-6 place-items-center transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0 pointer-coarse:opacity-0">
        <KindMark kind={a.kind} size={14} />
      </span>
      <button
        type="button"
        aria-label={`Quitar: ${plainSentence(items)}`}
        onClick={() => dismissActivity(a.id)}
        className="absolute top-[11px] right-2 grid size-6 place-items-center rounded-full bg-white/12 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-white/24 focus-visible:opacity-100 pointer-coarse:opacity-100"
      >
        <Close size={10} />
      </button>
    </motion.li>
  )
})

const SprintLabel = memo(function SprintLabel({ sprint }: { sprint: SprintId }) {
  const s = SPRINTS[sprint]
  return (
    <motion.li
      className="flex items-end overflow-hidden px-2 pb-1 text-[11.5px] font-medium text-white/55"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: LABEL_H, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={rowMotion.transition}
    >
      {s.name}, {s.id === 1 ? 'el MVP' : 'el incremento'}
    </motion.li>
  )
})

type Line = { type: 'label'; key: string; sprint: SprintId } | { type: 'row'; key: string; a: Activity }

/** Filas con sus títulos de sprint. Las claves cuentan desde lo más viejo, así no cambian al llegar algo nuevo. */
function linesOf(rows: Activity[]) {
  const lines: Line[] = []
  let run = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const a = rows[i]
    lines.unshift({ type: 'row', key: `row-${a.id}`, a })
    const above = rows[i - 1]
    if (!above || above.sprint !== a.sprint) {
      lines.unshift({ type: 'label', key: `label-${run}-${a.sprint}`, sprint: a.sprint })
      run += 1
    }
  }
  return lines
}

function PanelContent({
  width,
  capped,
  rows,
  total,
  counts,
  who,
  setWho,
  onClose,
}: {
  width: number
  capped: boolean
  rows: Activity[]
  total: number
  counts: Record<PersonId, number>
  who: PersonId | 'all'
  setWho: (v: PersonId | 'all') => void
  onClose: () => void
}) {
  const sprint = useBoard((s) => s.sprint)
  const close = useRef<HTMLButtonElement>(null)
  const [limit, setLimit] = useState(ROWS_FIRST)

  useEffect(() => {
    close.current?.focus({ preventScroll: true })
    const timer = window.setTimeout(() => setLimit(ROWS_SHOWN), 560)
    return () => window.clearTimeout(timer)
  }, [])

  const lines = useMemo(() => linesOf(rows.slice(0, limit)), [rows, limit])

  return (
    <div id="activity-panel" role="region" aria-label="Actividad" className="absolute inset-y-0 left-0 flex flex-col text-white" style={{ width }}>
      <div className="shrink-0" style={{ height: HEAD_H }}>
        <div className="flex items-center gap-1.5 pt-3 pr-3 pl-[58px]">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">
            {who === 'all' ? 'Actividad' : `Actividad de ${PERSON[who].name}`}
            <span className="ml-1.5 font-normal text-white/55 tabular-nums">{rows.length}</span>
          </h2>
          <span className="flex shrink-0 items-center gap-1">
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => clearActivity(who)}
                className="rounded-full px-2.5 py-1 text-[12.5px] font-medium text-white/75 transition-colors duration-150 hover:bg-white/10 hover:text-white"
              >
                Limpiar
              </button>
            )}
            <button ref={close} type="button" aria-label="Cerrar actividad" onClick={onClose} className="grid size-7 place-items-center rounded-full bg-white/10 transition-colors duration-150 hover:bg-white/20">
              <Close size={12} />
            </button>
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-6 gap-0.5 px-2" role="group" aria-label="Filtrar por persona">
          <button
            type="button"
            aria-pressed={who === 'all'}
            onClick={() => setWho('all')}
            className={`flex flex-col items-center gap-1 rounded-[12px] py-1.5 transition-colors duration-150 ${who === 'all' ? 'bg-white/14' : 'hover:bg-white/8'}`}
          >
            <span className="grid h-[30px] place-items-center text-[12.5px] font-medium">Todos</span>
            <span className="text-[11.5px] leading-none text-white/70 tabular-nums">{total}</span>
          </button>
          {TEAM.map((person, i) => (
            <button
              key={person.id}
              type="button"
              aria-pressed={who === person.id}
              aria-label={`Ver solo a ${person.name}`}
              title={person.name}
              onClick={() => setWho(person.id)}
              className={`flex flex-col items-center gap-1 rounded-[12px] py-1.5 transition-colors duration-150 ${who === person.id ? 'bg-white/14' : 'hover:bg-white/8'}`}
            >
              <Portrait person={person} face="idle" size={30} index={i} still />
              <span className="text-[11.5px] leading-none text-white/70 tabular-nums">{counts[person.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`island-scroll min-h-0 flex-1 overscroll-contain px-2 ${capped ? 'overflow-y-auto' : 'overflow-y-hidden'}`}>
        {rows.length === 0 ? (
          <p className="flex items-center px-2 text-[13.5px] leading-[1.4] text-white/65" style={{ height: EMPTY_H }}>
            {who === 'all' ? 'Aún no hay movimientos.' : `${PERSON[who].name} aún no ha movido notas.`}
          </p>
        ) : (
          <ol>
            <AnimatePresence initial={false}>
              {lines.map((line) => (line.type === 'label' ? <SprintLabel key={line.key} sprint={line.sprint} /> : <Row key={line.key} a={line.a} sprint={sprint} />))}
            </AnimatePresence>
          </ol>
        )}
        {rows.length > ROWS_SHOWN && (
          <p className="flex items-center px-2 text-[11.5px] text-white/55" style={{ height: FOOT_H }}>
            Se muestran los {ROWS_SHOWN} más recientes
          </p>
        )}
      </div>
    </div>
  )
}

const belongsTo = (a: Activity, id: PersonId) => a.who === id || (a.who === 'user' && a.owner === id)

/**
 * La isla: una sola forma negra. No está cuando no hay nada que contar, se abre para decir quién
 * hizo qué, junta a quienes actúan a la vez y crece hasta volverse un historial del alto justo.
 */
export function Island() {
  const alert = useBoard((s) => s.alert)
  const waiting = useBoard((s) => s.pending.length)
  const open = useBoard((s) => s.panelOpen)
  const scene = useBoard((s) => s.scene)
  const activity = useBoard((s) => s.activity)
  const calm = useReducedMotion()
  const [size, setSize] = useState<Size>(readSize)
  const [who, setWho] = useState<PersonId | 'all'>('all')
  const wasOpen = useRef(false)

  useLayoutEffect(() => {
    const update = () => setSize(readSize())
    update()
    window.addEventListener('resize', update)
    const dock = document.querySelector('[data-dock]')
    const watcher = new ResizeObserver(update)
    if (dock) watcher.observe(dock)
    return () => {
      window.removeEventListener('resize', update)
      watcher.disconnect()
    }
  }, [])

  useEffect(() => {
    if (scene === 'live') startIsland()
  }, [scene])

  const rows = useMemo(() => (who === 'all' ? activity : activity.filter((a) => belongsTo(a, who))), [activity, who])
  const counts = useMemo(() => {
    const result = Object.fromEntries(TEAM.map((p) => [p.id, 0])) as Record<PersonId, number>
    for (const a of activity) {
      if (a.who === 'user') result[a.owner] += 1
      else result[a.who] += 1
    }
    return result
  }, [activity])

  const shown = rows.slice(0, ROWS_SHOWN)
  const labels = shown.filter((a, i) => i === 0 || shown[i - 1].sprint !== a.sprint).length
  const body = rows.length === 0 ? EMPTY_H : shown.length * ROW_H + labels * LABEL_H + (rows.length > ROWS_SHOWN ? FOOT_H : 0) + END_PAD

  const items = alert?.items ?? null
  const people = items ? new Set(items.map(faceOf)).size : 1
  const mode: Mode = open ? 'open' : items ? 'alert' : activity.length > 0 ? 'idle' : 'hidden'
  const shape = shapeOf(mode, size, people, body)
  const frame = panelFrame(body, size)
  const wide = size.W >= WIDE_FROM

  // La cámara encuadra en lo que queda libre: a la derecha en web, arriba de la hoja en el teléfono.
  const insetRight = open && wide ? PANEL_WIDTH + EDGE * 2 : 0
  const insetBottom = open && !wide ? size.H - frame.y : 0
  useEffect(() => {
    setCameraInset(insetRight, insetBottom)
  }, [insetRight, insetBottom])

  useEffect(() => {
    if (wasOpen.current === open) return
    if (wide) overview(0.5)
    else refit(0.45)
    if (!open) {
      // Al cerrar, el foco vuelve a la isla, si es que sigue en pantalla.
      const timer = window.setTimeout(() => document.querySelector<HTMLElement>('[data-island-trigger]')?.focus({ preventScroll: true }), 260)
      wasOpen.current = open
      return () => window.clearTimeout(timer)
    }
    wasOpen.current = open
  }, [open, wide])

  useEffect(() => () => setCameraInset(0, 0), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const recent = useMemo(() => {
    const seen = new Set<PersonId>()
    for (const a of activity) {
      seen.add(faceOf(a))
      if (seen.size === 3) break
    }
    return [...seen]
  }, [activity])

  const onOpen = useCallback(() => setPanelOpen(true), [])
  const onClose = useCallback(() => setPanelOpen(false), [])
  const key = mode === 'alert' && alert ? `alert-${alert.id}` : mode

  const spring = { type: 'spring', visualDuration: 0.46, bounce: 0.13 } as const
  const hidden = mode === 'hidden'
  const clawdKind = mode === 'open' ? (rows[0]?.kind ?? null) : (items?.[0].kind ?? null)
  const clawdLook = clawdKind ? CLAWD_FOR[clawdKind] : REST_LOOK

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {items ? plainSentence(items) : ''}
      </p>
      <motion.div
        data-island={mode}
        className={`island absolute top-0 left-0 z-[25] ${hidden ? 'pointer-events-none' : ''}`}
        initial={false}
        animate={{ ...shape, opacity: hidden ? 0 : 1 }}
        transition={
          calm
            ? { duration: 0 }
            : { ...spring, opacity: hidden ? { duration: 0.22, delay: 0.16, ease: 'easeOut' } : { duration: 0.12, ease: 'easeOut' } }
        }
        onPointerEnter={() => holdIsland(true)}
        onPointerLeave={() => holdIsland(false)}
      >
        {/* Las capas se cruzan, nunca queda un instante vacío. Cada una tiene su propio ancho: el texto no se reacomoda. */}
        <AnimatePresence initial={false}>
          {!hidden && (
            <motion.div
              key={key}
              className={`absolute ${mode === 'open' ? 'inset-y-0 left-0' : 'top-1/2 left-1/2'}`}
              style={mode === 'open' ? { width: frame.width } : { width: shape.width, height: shape.height, marginLeft: -shape.width / 2, marginTop: -shape.height / 2 }}
              initial={{ opacity: 0, y: mode === 'open' ? 8 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.14, ease: 'easeOut' } }}
              transition={{ duration: 0.22, ease: 'easeOut', delay: mode === 'open' ? 0.09 : 0.03 }}
            >
              {mode === 'open' && <PanelContent width={frame.width} capped={frame.capped} rows={rows} total={activity.length} counts={counts} who={who} setWho={setWho} onClose={onClose} />}
              {mode === 'alert' && items && <AlertContent items={items} waiting={waiting} wide={wide} compact={size.W < 1400} onOpen={onOpen} />}
              {mode === 'idle' && <IdleContent onOpen={onOpen} count={activity.length} recent={recent} />}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Es siempre el mismo Clawd: el aviso cambia a su lado y él cambia de gesto, sin cortarse. */}
        <motion.span
          data-island-clawd={clawdKind ?? 'rest'}
          className="pointer-events-none absolute top-0 left-0 z-10 block text-white"
          initial={false}
          animate={
            mode === 'open'
              ? { x: 8, y: 7, opacity: 1, scale: 1 }
              : hidden
                ? { x: (shape.width - CLAWD_W) / 2, y: (shape.height - CLAWD_H) / 2, opacity: 0, scale: 0.4 }
                : { x: shape.width - CLAWD_W - 10, y: (shape.height - CLAWD_H) / 2, opacity: 1, scale: 1 }
          }
          transition={calm ? { duration: 0 } : spring}
        >
          <Clawd size={2.5} eyes={clawdLook.eyes} action={clawdLook.action} gear={clawdLook.gear} />
        </motion.span>
      </motion.div>
    </>
  )
}
