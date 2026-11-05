import { motion, useSpring, useTransform, useVelocity } from 'motion/react'
import { TEAM, type Person } from '../data/team'
import { ghostFace } from '../engine/carry'
import { cursors, findCard, useBoard, type Ghost } from '../store/board'
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
  const vx = useVelocity(x)
  const vy = useVelocity(y)

  // Inclinación por velocidad: idea del componente Cursor de unlumen en 21st.dev.
  const lean = useTransform([vx, vy], ([a, b]: number[]) => Math.max(-14, Math.min(14, (a / 1000) * 16 + (b / 1000) * 5)))
  const rotate = useSpring(lean, { stiffness: 70, damping: 16 })
  const visible = agent.ready && on && scene === 'live'

  return (
    <motion.div className="pointer-events-none absolute top-0 left-0 z-50" style={{ x, y }} aria-hidden="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: visible ? 1 : 0, scale: visible ? (agent.pressed ? 0.88 : 1) : 0.8 }}
        transition={{ type: 'spring', visualDuration: 0.3, bounce: 0.15 }}
        style={{ originX: 0, originY: 0 }}
      >
        <motion.svg
          width="24"
          height="24"
          viewBox="0 0 40 40"
          className="block drop-shadow-[0_2px_3px_rgb(0_0_0/0.35)]"
          style={{ rotate, originX: '5%', originY: '10%' }}
        >
          <path
            d="M1.8 4.4 7 36.2c.3 1.8 2.6 2.3 3.6.8l3.9-5.7c1.7-2.5 4.5-4.1 7.5-4.3l6.9-.5c1.8-.1 2.5-2.4 1.1-3.5L5 2.5c-1.4-1.1-3.5 0-3.3 1.9Z"
            fill={person.color}
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
        </motion.svg>
        <span
          className="absolute top-[21px] left-[13px] rounded-[6px] px-1.5 py-[4px] text-[12px] leading-none font-medium whitespace-nowrap text-white"
          style={{ backgroundColor: person.color }}
        >
          {person.name}
          {agent.label ? ` ${agent.label}` : ''}
        </span>
      </motion.div>
    </motion.div>
  )
}

/** Notas en el aire y cursores: viven dentro del mundo, así la cámara los lleva con todo lo demás. */
export function Overlay() {
  const ghosts = useBoard((s) => s.ghosts)
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {ghosts.map((ghost) => (
        <GhostNote key={ghost.id} ghost={ghost} />
      ))}
      {TEAM.map((person) => (
        <AgentCursor key={person.id} person={person} />
      ))}
    </div>
  )
}
