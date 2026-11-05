import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { CLASSES, SPRINTS, type SprintId } from '../data/board'
import { TEAM, type PersonId } from '../data/team'
import { cam, frame, goToLane, markInput, overview, overviewScale, panBy, setCameraNow, startDirector, worldRectOf, zoomAt } from '../engine/camera'
import { canFollowOutside, startFollowing, stopFollowing, useFollowingOutside } from '../engine/liveIsland'
import { peekSprint } from '../engine/player'
import { setCameraOn, useBoard } from '../store/board'
import { NewNote } from './NewNote'
import { FlowChart } from './FlowChart'
import { Lane } from './Lane'
import { Overlay } from './Overlay'
import { HEALTH, HEALTH_ORDER } from '../data/health'
import { useClock } from '../engine/clock'
import { localTime, presenceAt } from '../engine/script'
import { HealthLegend, LaneAlarm } from './HealthBadge'
import { StillFace } from './StillFace'
import { Camera, Chart, Close, Plus, Question } from './icons'
import { Island } from './Island'
import { Clock, Station } from './Station'

const Metrics = lazy(() => import('./Metrics'))

const SPRINT_IDS: SprintId[] = [1, 2]
const DOT_STEP = 26

/** Indicador líquido: el borde que va delante se estira y el de atrás lo alcanza después. */
function SprintTabs() {
  const current = useBoard((s) => s.sprint)
  const live = useBoard((s) => s.liveSprint)
  const scene = useBoard((s) => s.scene)
  const root = useRef<HTMLDivElement>(null)
  const left = useMotionValue(0)
  const right = useMotionValue(0)
  const width = useTransform([left, right], ([l, r]: number[]) => r - l)
  const first = useRef(true)

  useLayoutEffect(() => {
    const tab = root.current?.querySelector<HTMLElement>(`#tab-${current}`)
    if (!tab) return
    const l = tab.offsetLeft
    const r = l + tab.offsetWidth
    if (first.current) {
      first.current = false
      left.set(l)
      right.set(r)
      return
    }
    const forward = l > left.get()
    const fast = { type: 'spring', stiffness: 420, damping: 34 } as const
    const slow = { type: 'spring', stiffness: 170, damping: 24 } as const
    animate(left, l, forward ? slow : fast)
    animate(right, r, forward ? fast : slow)
  }, [current, left, right])

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const target: SprintId = current === 1 ? 2 : 1
    if (peekSprint(target)) document.getElementById(`tab-${target}`)?.focus({ preventScroll: true })
  }

  return (
    <div ref={root} role="tablist" aria-label="Sprints" onKeyDown={onKey} className="relative flex">
      <motion.span aria-hidden="true" className="absolute inset-y-0 rounded-full bg-ink" style={{ left, width }} />
      {SPRINT_IDS.map((id) => {
        const selected = current === id
        const sprint = SPRINTS[id]
        return (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="board-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => peekSprint(id)}
            disabled={scene !== 'live' && !selected}
            className={`relative rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-200 ${
              selected ? 'text-card' : 'text-soft hover:text-ink'
            }`}
          >
            {live === id && <i aria-label="en vivo" className="mr-1.5 inline-block size-1.5 translate-y-[-1px] rounded-full bg-[var(--accent)]" />}
            {sprint.name}
            <span className={`ml-1.5 hidden font-normal sm:inline ${selected ? 'opacity-65' : 'text-faint'}`}>{sprint.tag}</span>
          </button>
        )
      })}
    </div>
  )
}

function Switch({ label, icon, on, onChange }: { label: string; icon: ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="flex items-center gap-1 rounded-full py-1 pr-1 pl-1 text-[12.5px] font-medium text-soft transition-colors duration-150 hover:text-ink max-[349px]:hidden sm:gap-1.5 sm:pl-2"
    >
      <span className="sm:hidden max-[389px]:hidden">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      <span className={`relative h-[18px] w-[30px] rounded-full transition-colors duration-200 ${on ? 'bg-ink' : 'bg-[var(--line-strong)]'}`}>
        <motion.i
          className="absolute top-[2px] left-[2px] block size-[14px] rounded-full bg-card shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
          initial={false}
          animate={{ x: on ? 12 : 0 }}
          transition={{ type: 'spring', visualDuration: 0.25, bounce: 0.1 }}
        />
      </span>
    </button>
  )
}

/** Solo en iPhone con isla: deja el último movimiento en su reproductor al salir de la página. */
function FollowOutside() {
  const following = useFollowingOutside()
  return (
    <div className="mb-3 border-b border-line pb-3">
      <button
        type="button"
        role="switch"
        aria-checked={following}
        onClick={() => (following ? stopFollowing() : void startFollowing())}
        className="flex w-full items-center justify-between gap-3 text-left text-[13.5px] font-medium"
      >
        Seguir en la isla al salir
        <span className={`relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-200 ${following ? 'bg-ink' : 'bg-[var(--line-strong)]'}`}>
          <i className={`absolute top-[2px] left-[2px] block size-[14px] rounded-full bg-card transition-transform duration-200 ${following ? 'translate-x-3' : ''}`} />
        </span>
      </button>
      <p className="mt-1 text-[12.5px] leading-[1.35] text-soft">Usa el reproductor del iPhone con audio en silencio, así que pausa tu música. Tócalo y mantén sobre la isla para leer el último movimiento.</p>
    </div>
  )
}

function Help() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Cómo usar el tablero"
        onClick={() => setOpen((v) => !v)}
        className="grid size-7 place-items-center rounded-full text-soft transition-colors duration-150 hover:bg-lane hover:text-ink pointer-coarse:size-9"
      >
        <Question size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute top-full right-0 z-50 mt-2.5 max-h-[calc(100dvh-300px)] w-[min(320px,calc(100vw-32px))] origin-top-right overflow-y-auto rounded-[18px] bg-card p-4 shadow-[var(--shadow-lift)] sm:max-h-[calc(100dvh-90px)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Cómo usar el tablero</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="-m-1 grid size-6 place-items-center rounded-full hover:bg-lane">
                <Close size={12} />
              </button>
            </div>
            {canFollowOutside && (
              <div className="mt-3">
                <FollowOutside />
              </div>
            )}
            <ul className="mt-2 space-y-1.5 text-[13px] leading-[1.4] text-soft">
              <li>
                <b className="font-medium text-ink">WIP</b> es el máximo de notas por carril. Si está lleno, primero se termina una.
              </li>
              <li>La cámara sigue el trabajo sola. Arrastra el fondo o usa la rueda para moverte; ctrl y rueda para acercar.</li>
              <li>Cada mano es de una persona y solo mueve las notas de esa persona.</li>
              <li>La isla negra cuenta quién hizo qué. Tócala para ver todo el historial y filtrar por persona.</li>
              <li>Todas las pantallas ven el mismo tablero en el mismo momento. El punto marca el sprint en vivo.</li>
              <li>Con el botón + creas una nota propia: solo aparece en tu pantalla.</li>
            </ul>
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[12.5px]">
              {HEALTH_ORDER.map((state) => (
                <li key={state} className="flex items-baseline gap-2">
                  <i className="size-1.5 shrink-0 translate-y-[-1px] rounded-full" style={{ backgroundColor: HEALTH[state].color }} />
                  <span>
                    <b className="font-medium">{HEALTH[state].label}.</b> <span className="text-soft">{HEALTH[state].help}</span>
                  </span>
                </li>
              ))}
            </ul>
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[12.5px]">
              {Object.values(CLASSES).map((cls) => (
                <li key={cls.label} className="flex items-baseline gap-2">
                  <i className={`size-1.5 shrink-0 translate-y-[-1px] rounded-full ${cls.dot}`} />
                  <span>
                    <b className="font-medium">{cls.label}.</b> <span className="text-soft">{cls.help}</span>
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Mapa flotante: los 10 carriles, con su WIP, quién está en cada uno y qué se ve ahora. */
function Dock() {
  const sprintId = useBoard((s) => s.sprint)
  const cards = useBoard((s) => s.cards)
  const sprint = SPRINTS[sprintId]
  const where = useClock((now) => TEAM.map((p) => presenceAt(sprintId, p.id, localTime(sprintId, now))).join(','))
  const row = useRef<HTMLDivElement>(null)
  const frameLeft = useTransform(() => {
    const world = document.querySelector<HTMLElement>('[data-world]')
    return `${(-cam.x.get() / cam.scale.get() / Math.max(world?.offsetWidth ?? 1, 1)) * 100}%`
  })
  const frameWidth = useTransform(() => {
    const world = document.querySelector<HTMLElement>('[data-world]')
    const stage = document.querySelector<HTMLElement>('[data-stage]')
    const share = (stage?.clientWidth ?? 1) / cam.scale.get() / Math.max(world?.offsetWidth ?? 1, 1)
    return `${Math.min(1, share) * 100}%`
  })

  // Dónde queda cada cara: en su carril, y un poco al lado si comparte carril con otra.
  const [widths, setWidths] = useState<Map<string, { left: number; width: number }>>(new Map())
  useLayoutEffect(() => {
    const measure = () => {
      const found = new Map<string, { left: number; width: number }>()
      row.current?.querySelectorAll<HTMLElement>('[data-dock-lane]').forEach((chip) => found.set(chip.dataset.dockLane as string, { left: chip.offsetLeft, width: chip.offsetWidth }))
      setWidths(found)
    }
    measure()
    const watcher = new ResizeObserver(measure)
    if (row.current) watcher.observe(row.current)
    return () => watcher.disconnect()
  }, [sprintId])
  const spots = useMemo(() => {
    const result = new Map<PersonId, number>()
    where.split(',').forEach((lane, i) => {
      const box = widths.get(lane)
      if (!box) return
      // Lugar fijo por persona: si alguien llega al carril, los demás no se mueven.
      const step = Math.min(9, Math.max(3, (box.width - 24) / (TEAM.length - 1)))
      result.set(TEAM[i].id, box.left + box.width - 24 - (TEAM.length - 1 - i) * step)
    })
    return result
  }, [where, widths])

  return (
    <nav aria-label="Mapa de carriles" className="float pointer-events-auto rounded-[18px] p-1.5">
      <div ref={row} className="relative">
        <div className="flex gap-[3px]">
            {sprint.lanes.map((lane) => {
              const count = cards.filter((c) => c.lane === lane.id).length
              const full = lane.wip !== null && count >= lane.wip
              return (
                <button
                  key={lane.id}
                  type="button"
                  data-dock-lane={lane.id}
                  onClick={() => {
                    markInput()
                    goToLane(lane.id)
                  }}
                  aria-label={`Ir a ${lane.name}: ${count} notas${lane.wip !== null ? ` de ${lane.wip}` : ''}`}
                  className="relative flex h-[52px] min-w-0 flex-1 flex-col items-start justify-start rounded-[12px] px-1.5 pt-1.5 text-left transition-colors duration-200 hover:bg-lane lg:px-2"
                >
                  <span className="hidden text-[11.5px] leading-[1.15] font-medium whitespace-nowrap lg:block">{lane.name}</span>
                  <span className={`mt-0.5 rounded-full text-[11px] leading-[1.35] ${full ? 'bg-ink px-1.5 font-medium text-card' : 'text-soft'}`}>
                    {lane.wip !== null ? `${count}/${lane.wip}` : count}
                  </span>
                  <LaneAlarm lane={lane.id} />
                </button>
              )
            })}
        </div>
        {/* Cada cara se desliza sola por el mapa, sin hacer que el navegador vuelva a medir todo. */}
        {TEAM.map((person) => {
          const spot = spots.get(person.id)
          return (
            <motion.span
              key={person.id}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1 left-0 block rounded-full ring-[1.5px] ring-[var(--card)]"
              initial={false}
              animate={{ x: spot ?? 0, opacity: spot === undefined ? 0 : 1 }}
              transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
              data-dock-face={person.id}
              style={{ zIndex: TEAM.length - TEAM.indexOf(person) }}
            >
              <StillFace person={person} face="idle" size={20} />
            </motion.span>
          )
        })}
        {/* Lo que la cámara está viendo. */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[3px] h-[2.5px] rounded-full bg-[var(--accent)]"
          style={{ left: frameLeft, width: frameWidth }}
        />
      </div>
    </nav>
  )
}

/** El objetivo espera detrás de la frase y entra palabra por palabra cuando aparece el tablero. */
function Goal({ text, dates, delivered, ready, stats }: { text: string; dates: string; delivered: number; ready: boolean; stats: { count: number; points: number; donePoints: number; endName: string; wipPerPerson: number } }) {
  const lite = useBoard((s) => s.lite)
  const words = text.replace(/\.$/, '').split(' ')
  return (
    <div>
      <h2 key={text} className="max-w-[min(24ch,calc(100vw-48px))] text-[clamp(30px,3.6vw,56px)] leading-[1.04] font-semibold tracking-[-0.035em]" aria-label={text}>
        {words.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            aria-hidden="true"
            className="inline-block whitespace-pre"
            initial={false}
            animate={ready ? { y: 0, opacity: 1, filter: 'blur(0px)' } : { y: 16, opacity: 0, filter: lite ? 'blur(0px)' : 'blur(12px)' }}
            transition={ready ? { duration: 0.34, ease: [0.16, 1, 0.3, 1], delay: 0.34 + i * 0.05 } : { duration: 0 }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        ))}
      </h2>
      <p className="mt-2 text-[15px] text-soft">
        {dates}
      </p>
      <p data-sprint-stats className="mt-1 text-[14px] font-medium">
        {stats.count} cartillas, {stats.points} puntos, {stats.donePoints} en {stats.endName}, {delivered} {delivered === 1 ? 'entregada' : 'entregadas'}, WIP activo {stats.wipPerPerson} por persona
      </p>
    </div>
  )
}

export function Board({ onReplay }: { onReplay: () => void }) {
  const sprintId = useBoard((s) => s.sprint)
  const scene = useBoard((s) => s.scene)
  const cards = useBoard((s) => s.cards)
  const archived = useBoard((s) => s.archived)
  const cameraOn = useBoard((s) => s.cameraOn)
  const sprint = SPRINTS[sprintId]
  const last = sprint.lanes[sprint.lanes.length - 1].id
  const delivered = cards.filter((c) => c.lane === last).length + archived
  const stats = useMemo(() => {
    const open = new Set(cards.filter((c) => c.lane !== last).map((c) => c.id))
    const active = sprint.lanes.filter((l) => l.kind === 'work' || l.kind === 'check').reduce((n, l) => n + (l.wip ?? 0), 0)
    return {
      count: sprint.seed.length,
      points: sprint.seed.reduce((n, c) => n + c.points, 0),
      donePoints: sprint.seed.filter((c) => !open.has(c.id)).reduce((n, c) => n + c.points, 0),
      endName: sprint.lanes[sprint.lanes.length - 1].name,
      wipPerPerson: active / TEAM.length,
    }
  }, [cards, last, sprint])
  const inCloseUp = useBoard((s) => s.focus !== null)
  const [creating, setCreating] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const [measuredOnce, setMeasuredOnce] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const dotX = useTransform(cam.x, (v) => ((v % DOT_STEP) + DOT_STEP) % DOT_STEP - DOT_STEP)
  const dotY = useTransform(cam.y, (v) => ((v % DOT_STEP) + DOT_STEP) % DOT_STEP - DOT_STEP)
  const lite = useBoard((s) => s.lite)

  // Cada sprint abre en plano general.
  useLayoutEffect(() => {
    setCameraNow(0, 0, overviewScale())
  }, [sprintId])

  // Con el tablero en uso, el director toma la cámara después del plano general de entrada.
  useEffect(() => {
    if (scene !== 'live') return
    overview(0.4)
    return startDirector()
  }, [scene])

  // La rueda se mueve por el lienzo; con ctrl (o el pellizco del trackpad) acerca y aleja.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      markInput()
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.004))
      else if (e.shiftKey) panBy(-e.deltaY, 0)
      else panBy(-e.deltaX, -e.deltaY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Arrastrar el fondo mueve el lienzo. Con dedo vale en cualquier parte: la nota pide pulsación larga.
  const onPointerDown = (e: ReactPointerEvent) => {
    markInput()
    const target = e.target as HTMLElement
    if (e.pointerType !== 'touch' && e.button !== 0) return
    if (target.closest('button, input, a')) return
    let lastX = e.clientX
    let lastY = e.clientY
    let moved = false
    const onMove = (ev: PointerEvent) => {
      if (document.body.classList.contains('is-dragging')) return
      const dx = ev.clientX - lastX
      const dy = ev.clientY - lastY
      lastX = ev.clientX
      lastY = ev.clientY
      if (!moved && Math.hypot(dx, dy) > 0) {
        moved = true
        document.body.classList.add('is-panning')
      }
      markInput()
      panBy(dx, dy)
    }
    const onUp = () => {
      document.body.classList.remove('is-panning')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className="relative h-dvh overflow-hidden">
      <div
        ref={stage}
        data-stage
        onPointerDown={onPointerDown}
        onFocusCapture={(e) => {
          // Con teclado, la cámara lleva a la nota que recibe el foco.
          const note = (e.target as HTMLElement).closest('[data-note]')
          if (!note) return
          const box = note.getBoundingClientRect()
          if (box.left < 0 || box.right > window.innerWidth || box.bottom > window.innerHeight - 110) {
            markInput()
            frame(worldRectOf(note), cam.scale.get(), 0.35)
          }
        }}
        className="stage absolute inset-0 overflow-hidden"
      >
        {!lite && <motion.div aria-hidden="true" className="dots absolute top-0 left-0 h-[calc(100%+26px)] w-[calc(100%+26px)] bg-[length:26px_26px] will-change-transform" style={{ x: dotX, y: dotY }} />}
        <motion.div
          data-world
          className="absolute top-0 left-0 w-max origin-top-left px-6 pt-[88px] pb-[200px]"
          style={{ x: cam.x, y: cam.y, scale: cam.scale }}
        >
          <div className="flex flex-col gap-3 pb-6 pl-2 transition-opacity duration-300 sm:flex-row sm:items-end sm:gap-12" style={{ opacity: inCloseUp ? 0 : 1 }}>
            <Goal text={sprint.goal} dates={sprint.dates} delivered={delivered} ready={scene !== 'shaft'} stats={stats} />
            <div className="hidden sm:block">
              <FlowChart />
            </div>
            <HealthLegend sprint={sprintId} />
          </div>
          <div className="flex items-start gap-2.5">
            {sprint.lanes.map((lane) => (
              <Lane key={lane.id} lane={lane} />
            ))}
          </div>
          <Overlay />
        </motion.div>
      </div>

      {/* Controles flotantes: no se mueven con la cámara. */}
      <div className="controls-top pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 sm:px-4">
        <div className="float pointer-events-auto flex items-center gap-1 rounded-full p-1">
          <button type="button" onClick={onReplay} aria-label="Collectionner. Repetir la entrada" className="rounded-full px-2.5 py-1 text-[14px] font-semibold tracking-[-0.02em] max-[389px]:hidden" translate="no">
            <span className="hidden sm:inline">Collectionner</span>
            <span className="sm:hidden">C</span>
          </button>
          <SprintTabs />
        </div>
        <div className="float pointer-events-auto flex items-center gap-0.5 rounded-full p-1">
          <span className="hidden pr-2 pl-2.5 min-[1120px]:inline-flex">
            <Clock showDay />
          </span>
          <Switch label="Cámara" icon={<Camera size={14} />} on={cameraOn} onChange={setCameraOn} />
          <button
            type="button"
            aria-label="Medición del sprint"
            title="Medición del sprint"
            onClick={() => {
              setMeasuredOnce(true)
              setMeasuring(true)
            }}
            className="flex h-7 items-center gap-1.5 rounded-full px-1.5 text-[12.5px] font-medium text-soft transition-colors duration-150 hover:bg-lane hover:text-ink sm:px-2 pointer-coarse:h-9"
          >
            <Chart size={14} />
            <span className="hidden sm:inline">Medición</span>
          </button>
          <button
            type="button"
            aria-label="Nueva nota"
            title="Nueva nota"
            onClick={() => setCreating(true)}
            className="ml-0.5 grid size-7 place-items-center rounded-full bg-ink text-card transition-transform duration-150 active:scale-[0.96] pointer-coarse:size-9"
          >
            <Plus size={14} />
          </button>
          <Help />
        </div>
      </div>

      <Island />
      <NewNote open={creating} onClose={() => setCreating(false)} />
      {measuredOnce && (
        <Suspense fallback={null}>
          <Metrics open={measuring} onClose={() => setMeasuring(false)} />
        </Suspense>
      )}

      <div data-dock className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto dock-bottom max-w-[1180px] px-3 sm:px-4">
        <Station />
        <Dock />
      </div>
    </div>
  )
}
