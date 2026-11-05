import { AnimatePresence, motion, useSpring, useTransform, useVelocity, type MotionValue } from 'motion/react'
import { PERSON, TEAM, type Person } from '../data/team'
import { ghostFace } from '../engine/carry'
import { cursors, findCard, useBoard, type Ghost } from '../store/board'
import { Hand, type HandPose } from './Hand'
import { NoteBody } from './NoteBody'

function GhostNote({ ghost }: { ghost: Ghost }) {
  const card = findCard(ghost.id)
  const velocity = useVelocity(ghost.x)
  const lean = useTransform(velocity, [-1200, 0, 1200], [-3.5, 0, 3.5])
  const rotate = useSpring(lean, { stiffness: 90, damping: 20 })
  if (!card) return null
  return (
    <motion.div
      data-carried-by={ghost.by}
      data-target={ghost.target ?? undefined}
      data-owner={card.owner}
      className="absolute top-0 left-0"
      style={{ x: ghost.x, y: ghost.y, width: ghost.w, rotate, zIndex: ghost.by === 'user' ? 45 : 40 }}
      initial={{ scale: 1 }}
      animate={{ scale: ghost.landing ? 1 : 1.03 }}
      transition={{ type: 'spring', visualDuration: 0.35, bounce: 0.1 }}
    >
      <NoteBody card={card} face={ghost.landing ? (ghost.airFace ?? 'idle') : ghostFace(ghost)} lifted={!ghost.landing} />
    </motion.div>
  )
}

function AgentCursor({ person }: { person: Person }) {
  const agent = useBoard((s) => s.agents[person.id])
  const on = useBoard((s) => s.agentsOn)
  const scene = useBoard((s) => s.scene)
  const { x, y } = cursors[person.id]
  const working = useBoard((s) => Boolean(s.working[person.id]))
  const pose: HandPose = agent.pressed ? 'fist' : working ? 'point' : 'open'
  return <CursorView person={person} label={agent.label} pose={pose} visible={agent.ready && on && scene === 'live'} x={x} y={y} />
}

function CursorView({ person, label, pose, visible, x, y }: { person: Person; label: string; pose: HandPose; visible: boolean; x: MotionValue<number>; y: MotionValue<number> }) {
  const vx = useVelocity(x)
  const vy = useVelocity(y)

  // Inclinación por velocidad: idea del componente Cursor de unlumen en 21st.dev.
  const lean = useTransform([vx, vy], ([a, b]: number[]) => Math.max(-6, Math.min(6, (a / 1000) * 7 + (b / 1000) * 2)))
  const rotate = useSpring(lean, { stiffness: 70, damping: 16 })

  return (
    <motion.div className="pointer-events-none absolute top-0 left-0 z-50" style={{ x, y }} aria-hidden="true" data-agent-cursor={person.id} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: visible ? 1 : 0, scale: visible ? (pose === 'fist' ? 0.94 : 1) : 0.8 }}
        transition={{ type: 'spring', visualDuration: 0.26, bounce: 0.12 }}
        style={{ originX: 0, originY: 0 }}
      >
        {/* El punto de la mano que toca la nota queda justo donde apunta el guion. */}
        <motion.div className="absolute -top-[6px] -left-[13px] drop-shadow-[0_2px_2px_rgb(0_0_0/0.3)]" style={{ rotate, originX: '50%', originY: '70%' }}>
          <Hand person={person} pose={pose} />
        </motion.div>
        <span
          className="absolute top-[37px] left-[16px] rounded-[6px] px-1.5 py-[4px] text-[12px] leading-none font-medium whitespace-nowrap text-white"
          style={{ backgroundColor: person.color }}
        >
          {person.name}
          {label ? ` ${label}` : ''}
        </span>
      </motion.div>
    </motion.div>
  )
}

/** Notas en el aire y cursores: viven dentro del mundo, así la cámara los lleva con todo lo demás. */
export function Overlay() {
  const ghosts = useBoard((s) => s.ghosts)
  const own = useBoard((s) => s.localCursors)
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {ghosts.map((ghost) => (
        <GhostNote key={ghost.id} ghost={ghost} />
      ))}
      {TEAM.map((person) => (
        <AgentCursor key={person.id} person={person} />
      ))}
      <AnimatePresence>
        {own.map((c) => (
          <CursorView key={c.id} person={PERSON[c.owner]} label={c.label} pose={c.pressed ? 'fist' : 'open'} visible x={c.x} y={c.y} />
        ))}
      </AnimatePresence>
    </div>
  )
}
