import { memo, useEffect } from 'react'
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { useBoard } from '../store/board'

/*
 * Clawd, la mascota de Claude Code. Dibujo, ojos, accesorios y poses tomados de clawd-md
 * (MIT, © 2026 Jamey Prüfert, https://github.com/jaameypr/clawd-md). Aquí es un componente vivo:
 * cambia de estado en tiempo real, pasando siempre por la pose de reposo para no cortar el gesto.
 */
const ORANGE = '#D97757'
const DARK = '#141413'

export type ClawdEyes = 'dots' | 'tall' | 'happy' | 'closed' | 'sparkly' | 'wide'
export type ClawdGear = 'glasses' | 'party' | 'crown' | 'tophat' | 'laptop' | 'coffee' | 'book'
export type ClawdAction = 'idle' | 'hop' | 'bounce' | 'walk' | 'dance' | 'wave' | 'sleep' | 'shiver' | 'type' | 'flip' | 'nod' | 'still'

type Props = {
  size: number
  eyes?: ClawdEyes
  sit?: boolean
  gear?: ClawdGear[]
  action?: ClawdAction
  /** Mira hacia el otro lado al caminar en reversa. */
  mirror?: boolean
}

const R = ({ x, y, w, h, fill }: { x: number; y: number; w: number; h: number; fill?: string }) => <rect x={x} y={y} width={w} height={h} fill={fill} />

const EYE_L = 2.5
const EYE_R = 8.5
const EYE_Y = 2.5

function EyePair({ draw }: { draw: (c: number) => React.ReactNode }) {
  return (
    <>
      {draw(EYE_L)}
      {draw(EYE_R)}
    </>
  )
}

const EYE_ART: Record<ClawdEyes, React.ReactNode> = {
  dots: <EyePair draw={(c) => <R key={c} x={c - 0.5} y={EYE_Y - 0.5} w={1} h={1} fill={DARK} />} />,
  tall: <EyePair draw={(c) => <R key={c} x={c - 0.5} y={EYE_Y - 1} w={1} h={2} fill={DARK} />} />,
  wide: <EyePair draw={(c) => <R key={c} x={c - 1} y={EYE_Y - 0.5} w={2} h={1} fill={DARK} />} />,
  closed: <EyePair draw={(c) => <R key={c} x={c - 0.75} y={EYE_Y} w={1.5} h={0.45} fill={DARK} />} />,
  happy: (
    <EyePair
      draw={(c) => (
        <g key={c} fill={DARK}>
          <R x={c - 0.9} y={EYE_Y} w={0.6} h={0.6} />
          <R x={c - 0.3} y={EYE_Y - 0.6} w={0.6} h={0.6} />
          <R x={c + 0.3} y={EYE_Y} w={0.6} h={0.6} />
        </g>
      )}
    />
  ),
  sparkly: (
    <EyePair
      draw={(c) => (
        <g key={c}>
          <R x={c - 0.75} y={EYE_Y - 0.75} w={1.5} h={1.5} fill={DARK} />
          <R x={c - 0.5} y={EYE_Y - 0.5} w={0.5} h={0.5} fill="#ffffff" />
        </g>
      )}
    />
  ),
}
const EYE_NAMES = Object.keys(EYE_ART) as ClawdEyes[]

const Sparkle = () => {
  const d = 0.9 * Math.SQRT1_2
  return (
    <g transform="translate(5.5 4.9)" stroke={ORANGE} strokeWidth=".3" strokeLinecap="round">
      <line x1="0" y1="-.9" x2="0" y2=".9" />
      <line x1="-.9" y1="0" x2=".9" y2="0" />
      <line x1={-d} y1={-d} x2={d} y2={d} />
      <line x1={-d} y1={d} x2={d} y2={-d} />
    </g>
  )
}

const GEAR_ART: Record<ClawdGear, React.ReactNode> = {
  glasses: (
    <g>
      <rect x="1.35" y="1.35" width="2.3" height="2.3" fill="none" stroke="#5c1a33" strokeWidth=".45" />
      <rect x="7.35" y="1.35" width="2.3" height="2.3" fill="none" stroke="#5c1a33" strokeWidth=".45" />
      <R x={3.6} y={2.1} w={3.8} h={0.45} fill="#5c1a33" />
    </g>
  ),
  party: (
    <g>
      <g fill="#e05d8a">
        <R x={4} y={-1} w={3} h={1} />
        <R x={4.5} y={-2} w={2} h={1} />
        <R x={5} y={-3} w={1} h={1} />
      </g>
      <R x={4.75} y={-1.8} w={0.5} h={0.5} fill="#f2b24b" />
      <R x={5.75} y={-0.8} w={0.5} h={0.5} fill="#f2b24b" />
      <R x={4.9} y={-3.8} w={1.2} h={0.8} fill="#f2b24b" />
    </g>
  ),
  crown: (
    <g>
      <g fill="#f2b24b">
        <R x={3} y={-1} w={5} h={1} />
        <R x={3} y={-2} w={1} h={1} />
        <R x={5} y={-2} w={1} h={1} />
        <R x={7} y={-2} w={1} h={1} />
      </g>
      <R x={5.25} y={-0.75} w={0.5} h={0.5} fill="#e05d8a" />
    </g>
  ),
  tophat: (
    <g>
      <g fill="#2b2320">
        <R x={2.5} y={-0.6} w={6} h={0.6} />
        <R x={3.5} y={-3.6} w={4} h={3} />
      </g>
      <R x={3.5} y={-1.4} w={4} h={0.5} fill="#b35f43" />
    </g>
  ),
  book: (
    <g>
      <R x={8.2} y={3} w={2.6} h={3.2} fill="#3f3a80" />
      <R x={8.2} y={3} w={0.5} h={3.2} fill="#e8e1d4" />
    </g>
  ),
  laptop: (
    <g>
      <R x={2.5} y={3.4} w={6} h={3} fill="#3a3a3a" />
      <R x={1.5} y={6.2} w={8} h={0.6} fill="#8b8b8b" />
      <Sparkle />
    </g>
  ),
  coffee: (
    <g>
      <R x={11} y={2.6} w={2} h={2.2} fill="#f5f0e8" />
      <R x={13} y={3} w={0.6} h={1.2} fill="#f5f0e8" />
      <R x={11} y={2.6} w={2} h={0.45} fill="#6f4e37" />
      <g className="cl-steam">
        <R x={11.3} y={1.4} w={0.45} h={0.8} fill="#c8c1b6" />
      </g>
      <g className="cl-steam cl-steam-b">
        <R x={12.2} y={1.4} w={0.45} h={0.8} fill="#c8c1b6" />
      </g>
    </g>
  ),
}

type Loop = Parameters<ReturnType<typeof useAnimationControls>['start']>[0]

/* Todos empiezan y terminan en el reposo: entrar a un gesto nunca da un salto. */
const LOOPS: Partial<Record<ClawdAction, Loop>> = {
  idle: { y: [0, -0.12, 0], scaleY: [1, 0.985, 1], transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } },
  nod: { y: [0, 0.32, 0, 0], transition: { duration: 1.5, times: [0, 0.2, 0.42, 1], repeat: Infinity, ease: 'easeInOut' } },
  wave: { y: [0, -0.12, 0], transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } },
  type: { y: [0, -0.08, 0], transition: { duration: 1.3, repeat: Infinity, ease: 'easeInOut' } },
  walk: { y: [0, -0.28, 0], transition: { duration: 0.56, repeat: Infinity, ease: 'easeInOut' } },
  hop: { y: [0, 0, -1.4, 0, 0], scaleX: [1, 1.05, 0.98, 1.05, 1], scaleY: [1, 0.93, 1.03, 0.93, 1], transition: { duration: 1.1, times: [0, 0.2, 0.5, 0.8, 1], repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' } },
  bounce: { y: [0, 0, -1.2, 0, -1.2, 0, 0], transition: { duration: 2.4, times: [0, 0.6, 0.68, 0.76, 0.84, 0.92, 1], repeat: Infinity, ease: 'easeInOut' } },
  dance: { rotate: [0, -5, 0, 5, 0], y: [0, -0.5, 0, -0.5, 0], transition: { duration: 1.25, repeat: Infinity, ease: 'easeInOut' } },
  sleep: { scaleX: [1, 1.025, 1], scaleY: [1, 0.96, 1], transition: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' } },
  shiver: { rotate: [0, -2, 0, 2, 0], transition: { duration: 0.95, repeat: Infinity, ease: 'easeInOut' } },
}
const REST = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }

export const Clawd = memo(function Clawd({ size, eyes = 'dots', sit = false, gear = [], action = 'idle', mirror = false }: Props) {
  const reduced = useReducedMotion()
  const lite = useBoard((s) => s.lite)
  // En calidad ligera solo se mueve cuando hay algo que contar; el reposo queda quieto.
  const calm = reduced || (lite && (action === 'idle' || action === 'type' || action === 'sleep'))
  const controls = useAnimationControls()
  const asleep = action === 'sleep' || eyes === 'closed'

  // Cada gesto parte del reposo: el cambio de una animación a otra nunca es un corte.
  useEffect(() => {
    let alive = true
    const run = async () => {
      await controls.start({ ...REST, transition: { type: 'spring', visualDuration: 0.28, bounce: 0 } })
      if (!alive || calm) return
      if (action === 'flip') {
        await controls.start({ rotate: 360, y: [0, -2.4, 0], transition: { duration: 0.72, ease: [0.3, 0, 0.2, 1] } })
        if (alive) controls.set({ rotate: 0 })
        return
      }
      const loop = LOOPS[action]
      if (loop) void controls.start(loop)
    }
    void run()
    return () => {
      alive = false
    }
  }, [action, calm, controls])

  const walking = action === 'walk'
  const units = 17
  return (
    <svg
      viewBox="-3 -4 17 13"
      width={units * size}
      height={13 * size}
      aria-hidden="true"
      data-clawd={action}
      shapeRendering="geometricPrecision"
      className="block overflow-visible"
      style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
    >
      {/* La sombra se encoge cuando salta. */}
      <motion.rect x="1" y="8" width="9" height=".6" rx=".3" fill="currentColor" opacity=".16" initial={false} animate={{ scaleX: action === 'hop' || action === 'flip' ? 0.8 : 1 }} style={{ transformBox: 'fill-box', originX: 0.5 }} />

      <motion.g initial={false} animate={{ y: sit ? 1 : 0 }} transition={{ type: 'spring', visualDuration: 0.3, bounce: 0.1 }}>
        <motion.g animate={controls} initial={false} style={{ transformBox: 'fill-box', originX: 0.5, originY: 1 }}>
          {/* Patas: dos pares que se turnan al caminar; al sentarse se recogen. */}
          <motion.g fill={ORANGE} initial={false} animate={{ scaleY: sit ? 0.5 : 1 }} transition={{ type: 'spring', visualDuration: 0.3, bounce: 0 }} style={{ transformBox: 'fill-box', originY: 0 }}>
            <motion.g animate={walking ? { y: [0, -0.6, 0] } : { y: 0 }} transition={walking ? { duration: 0.56, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}>
              <R x={1} y={5.9} w={1} h={2.1} />
              <R x={7} y={5.9} w={1} h={2.1} />
            </motion.g>
            <motion.g animate={walking ? { y: [-0.6, 0, -0.6] } : { y: 0 }} transition={walking ? { duration: 0.56, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}>
              <R x={3} y={5.9} w={1} h={2.1} />
              <R x={9} y={5.9} w={1} h={2.1} />
            </motion.g>
          </motion.g>

          <g fill={ORANGE}>
            <R x={1} y={0} w={9} h={6} />
            <R x={0} y={2} w={1.1} h={2} />
          </g>
          <motion.g
            fill={ORANGE}
            animate={action === 'wave' ? { y: [0, -2, -1, -2, -1, -2, 0, 0] } : { y: 0 }}
            transition={action === 'wave' ? { duration: 2, times: [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 1], repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
          >
            <R x={9.9} y={2} w={1.1} h={2} />
          </motion.g>

          {/* Todas las miradas están dibujadas; cambiar de ánimo es un fundido corto entre ellas. */}
          <g className={asleep || eyes === 'happy' ? undefined : 'cl-look'}>
            <g className={asleep || eyes === 'happy' ? undefined : 'cl-blink'}>
              {EYE_NAMES.map((name) => (
                <motion.g key={name} initial={false} animate={{ opacity: name === eyes ? 1 : 0 }} transition={{ duration: 0.14, ease: 'easeOut' }}>
                  {EYE_ART[name]}
                </motion.g>
              ))}
            </g>
          </g>

          <AnimatePresence initial={false}>
            {gear.map((item) => (
              <motion.g
                key={item}
                style={{ transformBox: 'fill-box', originX: 0.5, originY: 1 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', visualDuration: 0.36, bounce: 0.12 }}
              >
                {GEAR_ART[item]}
              </motion.g>
            ))}
          </AnimatePresence>
        </motion.g>
      </motion.g>

      {action === 'sleep' && (
        <g fill="currentColor">
          <g className="cl-z">
            <R x={11} y={-1} w={1.1} h={0.3} />
            <R x={11} y={-0.1} w={1.1} h={0.3} />
            <R x={11.5} y={-0.7} w={0.3} h={0.8} />
          </g>
          <g className="cl-z cl-z-b">
            <R x={12} y={-2.2} w={0.9} h={0.25} />
            <R x={12} y={-1.5} w={0.9} h={0.25} />
            <R x={12.4} y={-2} w={0.25} h={0.6} />
          </g>
        </g>
      )}
    </svg>
  )
})
