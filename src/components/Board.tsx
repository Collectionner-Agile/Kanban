import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useTransform } from 'motion/react'
import { CLASSES, LANE_INDEX, SPRINTS, type LaneId, type SprintId } from '../data/board'
import { PERSON, TEAM, type PersonId } from '../data/team'
import { cam, frame, goToLane, markInput, overview, overviewScale, panBy, setCameraNow, startDirector, worldRectOf, zoomAt } from '../engine/camera'
import { peekSprint } from '../engine/player'
import { setCameraOn, useBoard } from '../store/board'
import { NewNote } from './NewNote'
import { FlowChart } from './FlowChart'
import { Lane } from './Lane'
import { Overlay } from './Overlay'
import { Portrait } from './Portrait'
import { Camera, Close, Plus, Question } from './icons'
import { Island } from './Island'
import { Clock, Station } from './Station'

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
      className="flex items-center gap-1 rounded-full py-1 pr-1 pl-1 text-[12.5px] font-medium text-soft transition-colors duration-150 hover:text-ink sm:gap-1.5 sm:pl-2"
    >
      <span className="sm:hidden">{icon}</span>
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
        className="grid size-7 place-items-center rounded-full text-soft transition-colors duration-150 hover:bg-lane hover:text-ink"
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
            className="absolute top-full right-0 z-50 mt-2.5 w-[min(320px,calc(100vw-32px))] origin-top-right rounded-[18px] bg-card p-4 shadow-[var(--shadow-lift)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Cómo usar el tablero</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="-m-1 grid size-6 place-items-center rounded-full hover:bg-lane">
                <Close size={12} />
              </button>
            </div>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-[1.4] text-soft">
              <li>
                <b className="font-medium text-ink">WIP</b> es el máximo de notas por carril. Si está lleno, primero se termina una.
              </li>
              <li>La cámara sigue el trabajo sola. Arrastra el fondo o usa la rueda para moverte; ctrl y rueda para acercar.</li>
              <li>Cada mouse es de una persona y solo mueve las notas de esa persona.</li>
              <li>La isla negra cuenta quién hizo qué. Tócala para ver todo el historial y filtrar por persona.</li>
              <li>Todas las pantallas ven el mismo tablero en el mismo momento. El punto marca el sprint en vivo.</li>
              <li>Con el botón + creas una nota propia: solo aparece en tu pantalla.</li>
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

/** Dónde está trabajando cada persona, para ubicarla en el mapa aunque esté fuera de cuadro. */
function usePeopleByLane(sprint: SprintId) {
  const cards = useBoard((s) => s.cards)
  const working = useBoard((s) => s.working)
  const ghosts = useBoard((s) => s.ghosts)
  return useMemo(() => {
    const lanes = SPRINTS[sprint].lanes
    const result = new Map<LaneId, PersonId[]>()
    for (const person of TEAM) {
      const ghost = ghosts.find((g) => g.by === person.id)
      const workedId = working[person.id]
      const worked = workedId ? cards.find((c) => c.id === workedId) : undefined
      const own = cards.filter((c) => c.owner === person.id && lanes[LANE_INDEX[c.lane]]?.kind !== 'end')
      const furthest = own.sort((a, b) => LANE_INDEX[b.lane] - LANE_INDEX[a.lane])[0]
      const lane = ghost ? (ghost.target ?? ghost.from) : (worked?.lane ?? furthest?.lane)
      if (lane) result.set(lane, [...(result.get(lane) ?? []), person.id])
    }
    return result
  }, [cards, working, ghosts, sprint])
}

/** Mapa flotante: los 10 carriles, con su WIP, quién está en cada uno y qué se ve ahora. */
function Dock() {
  const sprintId = useBoard((s) => s.sprint)
  const cards = useBoard((s) => s.cards)
  const sprint = SPRINTS[sprintId]
  const people = usePeopleByLane(sprintId)
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

  return (
    <nav aria-label="Mapa de carriles" className="float pointer-events-auto rounded-[18px] p-1.5">
      <div ref={row} className="relative">
        <LayoutGroup>
          <div className="flex gap-[3px]">
            {sprint.lanes.map((lane) => {
              const count = cards.filter((c) => c.lane === lane.id).length
              const full = lane.wip !== null && count >= lane.wip
              const here = people.get(lane.id) ?? []
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
                  <span className="absolute right-1 bottom-1 flex -space-x-2">
                    {here.map((id) => (
                      <motion.span key={id} layoutId={`map-${id}`} transition={{ type: 'spring', visualDuration: 0.8, bounce: 0.1 }} className="block rounded-full ring-[1.5px] ring-[var(--card)]">
                        <Portrait person={PERSON[id]} face="idle" size={20} still />
                      </motion.span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </LayoutGroup>
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
function Goal({ text, dates, delivered, ready }: { text: string; dates: string; delivered: number; ready: boolean }) {
  const lite = useBoard((s) => s.lite)
  const words = text.replace(/\.$/, '').split(' ')
  return (
    <div className="pb-8">
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
        {dates}, {delivered} {delivered === 1 ? 'nota entregada' : 'notas entregadas'}
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
  const inCloseUp = useBoard((s) => s.focus !== null)
  const [creating, setCreating] = useState(false)
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
          <div className="flex items-end gap-16 pl-2 transition-opacity duration-300" style={{ opacity: inCloseUp ? 0 : 1 }}>
            <Goal text={sprint.goal} dates={sprint.dates} delivered={delivered} ready={scene !== 'shaft'} />
            <div className="hidden sm:block">
              <FlowChart />
            </div>
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
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="float pointer-events-auto flex items-center gap-1 rounded-full p-1">
          <button type="button" onClick={onReplay} aria-label="Collectionner. Repetir la entrada" className="rounded-full px-2.5 py-1 text-[14px] font-semibold tracking-[-0.02em]" translate="no">
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
            aria-label="Nueva nota"
            title="Nueva nota"
            onClick={() => setCreating(true)}
            className="ml-0.5 grid size-7 place-items-center rounded-full bg-ink text-card transition-transform duration-150 active:scale-[0.96]"
          >
            <Plus size={14} />
          </button>
          <Help />
        </div>
      </div>

      <Island />
      <NewNote open={creating} onClose={() => setCreating(false)} />

      <div data-dock className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto max-w-[1180px] px-3 pb-3 sm:px-4 sm:pb-4">
        <Station />
        <Dock />
      </div>
    </div>
  )
}
