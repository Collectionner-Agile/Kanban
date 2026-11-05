import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { SPRINTS } from '../data/board'
import { clockText, dayText, sprintPulse, useClock } from '../engine/clock'
import { useBoard } from '../store/board'
import { Clawd, type ClawdAction, type ClawdEyes, type ClawdGear } from './Clawd'

/* ---------- Reloj: cada dígito rueda por su cuenta ---------- */

const Digit = memo(function Digit({ value }: { value: string }) {
  return (
    <span className="relative inline-block h-[1.25em] w-[0.62em] overflow-hidden text-center align-top">
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          className="absolute inset-0"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ type: 'spring', visualDuration: 0.3, bounce: 0 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
})

/** Hora real de quien mira el tablero. */
export function Clock({ showDay = false }: { showDay?: boolean }) {
  const time = useClock(clockText)
  const day = useClock(dayText)
  return (
    <span role="timer" aria-label={`Son las ${time.slice(0, 5)}, ${day}`} className="inline-flex items-center gap-2 text-[13px] leading-[1.25] font-medium whitespace-nowrap text-ink">
      {showDay && <span className="font-normal text-soft">{day}</span>}
      <span aria-hidden="true" data-clock={time} className="inline-flex">
        {time.split('').map((char, i) =>
          char === ':' ? (
            <span key={i} className={`w-[0.34em] text-center ${i === 2 ? 'clock-colon' : 'text-soft'}`}>
              :
            </span>
          ) : (
            <Digit key={i} value={char} />
          ),
        )}
      </span>
    </span>
  )
}

/* ---------- Clawd: su ánimo sale del estado real del proyecto ---------- */

type Mood = { eyes: ClawdEyes; sit: boolean; gear: ClawdGear[]; action: ClawdAction }

const FLASH_MS = 4200

function useMood(hovering: boolean, poked: boolean): Mood {
  const sprintId = useBoard((s) => s.sprint)
  const cards = useBoard((s) => s.cards)
  const agentsOn = useBoard((s) => s.agentsOn)
  const activity = useBoard((s) => s.activity)
  const lastLane = SPRINTS[sprintId].lanes[SPRINTS[sprintId].lanes.length - 1].id
  const moment = useClock((now) => Math.floor(now / 1000)) * 1000
  const pulse = useMemo(() => sprintPulse(cards, lastLane, moment), [cards, lastLane, moment])

  if (poked) return { eyes: 'sparkly', sit: false, gear: [], action: 'flip' }
  if (hovering) return { eyes: 'happy', sit: false, gear: [], action: 'wave' }

  // Lo último que importó, mientras siga reciente: un movimiento cualquiera no borra una entrega.
  const flash = activity.slice(0, 6).find((a) => a.kind !== 'move' && a.kind !== 'new' && moment - a.at < FLASH_MS)
  if (flash?.kind === 'done') {
    return (flash.deltaMs ?? 0) > 0 ? { eyes: 'dots', sit: false, gear: [], action: 'hop' } : { eyes: 'sparkly', sit: false, gear: ['party'], action: 'dance' }
  }
  if (flash?.kind === 'back') return { eyes: 'wide', sit: false, gear: [], action: 'shiver' }
  if (flash?.kind === 'full') return { eyes: 'tall', sit: false, gear: ['glasses'], action: 'idle' }

  if (pulse.total > 0 && pulse.done === pulse.total) return { eyes: 'sparkly', sit: false, gear: ['crown'], action: 'bounce' }
  if (!agentsOn) return { eyes: 'closed', sit: true, gear: [], action: 'sleep' }
  if (pulse.late > 0) return { eyes: 'tall', sit: true, gear: ['glasses', 'book'], action: 'type' }
  const hour = new Date(moment).getHours()
  return { eyes: 'dots', sit: true, gear: hour >= 5 && hour < 11 ? ['laptop', 'coffee'] : ['laptop'], action: 'type' }
}

const CLAWD_UNIT = 3
const CLAWD_W = 17 * CLAWD_UNIT
const ROW_H = 40
/** Desde este ancho hay sitio para caminar por todo el mapa. */
const ROAM_FROM = 1120
const WALK_PX_PER_S = 130

/**
 * Clawd vive de pie sobre el mapa de carriles y no da avisos: de eso se encarga la isla.
 * Reacciona con el cuerpo al estado real del sprint, y camina sin prisa hasta el carril
 * donde pasó algo importante.
 */
export function Station() {
  const [hovering, setHovering] = useState(false)
  const [poked, setPoked] = useState(false)
  const mood = useMood(hovering, poked)
  const latest = useBoard((s) => s.activity[0])
  const scene = useBoard((s) => s.scene)
  const calm = useReducedMotion()
  const row = useRef<HTMLDivElement>(null)
  const where = useRef(0)
  const busy = useRef(false)
  const [walk, setWalk] = useState({ x: 0, seconds: 0, mirror: false, walking: false })
  const [roam] = useState(() => window.innerWidth >= ROAM_FROM)

  useEffect(() => {
    if (!latest?.to || latest.kind === 'move' || latest.kind === 'new' || !roam || scene !== 'live' || !row.current || busy.current) return
    const chip = document.querySelector(`[data-dock-lane="${latest.to}"]`)
    if (!chip) return
    const chipBox = chip.getBoundingClientRect()
    const rowBox = row.current.getBoundingClientRect()
    const next = Math.max(0, Math.min(rowBox.width - CLAWD_W, chipBox.left - rowBox.left + chipBox.width / 2 - CLAWD_W / 2))
    const distance = Math.abs(next - where.current)
    if (distance < 24) return
    const frame = requestAnimationFrame(() => {
      busy.current = true
      setWalk({ x: next, seconds: Math.min(6, Math.max(0.9, distance / WALK_PX_PER_S)), mirror: next < where.current, walking: true })
      where.current = next
    })
    return () => cancelAnimationFrame(frame)
  }, [latest, roam, scene])

  useEffect(() => {
    if (!poked) return
    const timer = window.setTimeout(() => setPoked(false), 1100)
    return () => window.clearTimeout(timer)
  }, [poked])

  const finishWalk = () => {
    busy.current = false
    setWalk((w) => (w.walking ? { ...w, walking: false } : w))
  }

  const gearKey = walk.walking ? '' : mood.gear.join(',')
  const gear = useMemo(() => (gearKey ? (gearKey.split(',') as ClawdGear[]) : []), [gearKey])

  return (
    <div ref={row} data-station className="pointer-events-none relative" style={{ height: ROW_H }}>
      <motion.div
        className="absolute bottom-0 left-0"
        initial={false}
        animate={{ x: walk.x }}
        transition={calm ? { duration: 0 } : { duration: walk.seconds, ease: [0.35, 0, 0.45, 1] }}
        onAnimationComplete={finishWalk}
      >
        <button
          type="button"
          aria-label="Saludar a Clawd"
          className="pointer-events-auto block cursor-pointer text-ink"
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
          onClick={() => setPoked(true)}
        >
          <Clawd size={CLAWD_UNIT} eyes={walk.walking ? 'dots' : mood.eyes} sit={walk.walking ? false : mood.sit} gear={gear} action={walk.walking ? 'walk' : mood.action} mirror={walk.mirror} />
        </button>
      </motion.div>
      {!roam && (
        <span className="float pointer-events-auto absolute right-0 bottom-1 inline-flex h-8 items-center rounded-full px-3">
          <Clock />
        </span>
      )}
    </div>
  )
}
