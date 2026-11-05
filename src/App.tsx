import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Board } from './components/Board'
import { PortraitDefs } from './components/PortraitDefs'
import { Shaft } from './components/Shaft'
import { SPRINTS } from './data/board'
import { startAgents } from './engine/agents'
import { getState, resetBoard, setScene, swapFloor, useBoard } from './store/board'
import { startQuality } from './engine/quality'

/** Lo que tarda el círculo en cubrir la pantalla. */
const OPEN_MS = 650
/** Lo que tarda el tablero en aparecer mientras la frase se va. */
const ENTER_MS = 1000

/** Lo que dura la frase en pantalla: alcanza para leerla entera, sea corta o larga. */
const holdFor = (phrase: string) => 1300 + phrase.length * 30
/** La entrada se toma su tiempo: el saludo, Clawd y el equipo se ven con calma. */
const INTRO_MS = 5500

function Experience({ onReplay }: { onReplay: () => void }) {
  const scene = useBoard((s) => s.scene)
  const direction = useBoard((s) => s.direction)
  const sprint = useBoard((s) => s.sprint)
  const isIntro = useRef(true)

  useEffect(() => {
    document.documentElement.dataset.sprint = String(sprint)
    document.title = `${SPRINTS[sprint].name}, ${SPRINTS[sprint].tag} | Collectionner`
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sprint === 1 ? '#EDEBE6' : '#0E0E10')
  }, [sprint])

  // La coreografía del cambio de sprint: cada escena dice cuánto dura y cuál sigue.
  useEffect(() => {
    if (scene === 'live') return
    const hold = isIntro.current ? INTRO_MS : holdFor(getState().phrase)
    if (scene === 'enter') isIntro.current = false
    const timer = window.setTimeout(
      () => {
        if (scene === 'leave') {
          swapFloor()
          setScene('shaft')
        } else if (scene === 'shaft') {
          setScene('enter')
        } else {
          setScene('live')
        }
      },
      scene === 'shaft' ? hold : scene === 'leave' ? OPEN_MS : ENTER_MS,
    )
    return () => window.clearTimeout(timer)
  }, [scene])

  // Un clic o una tecla adelantan el cambio: nunca obliga a esperar.
  useEffect(() => {
    if (scene !== 'shaft') return
    const skip = () => setScene('enter')
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [scene])

  useEffect(() => {
    if (scene !== 'live') return
    return startAgents()
  }, [scene])

  // Tapado por el círculo se coloca inclinado; luego llega hasta quedar de frente, sobre el mismo color.
  const covered = scene === 'shaft'
  const world = {
    y: covered ? `${direction * 7}vh` : '0vh',
    rotateX: covered ? 15 : 0,
    scale: covered ? 0.94 : scene === 'leave' ? 0.985 : 1,
    opacity: covered ? 0 : 1,
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-canvas">
      <PortraitDefs />
      <h1 className="sr-only">Collectionner, tablero Kanban del equipo</h1>
      <motion.div
        id="board-panel"
        role="tabpanel"
        aria-labelledby={`tab-${sprint}`}
        initial={false}
        animate={world}
        transition={covered ? { duration: 0 } : scene === 'enter' ? { duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.14 } : { duration: OPEN_MS / 1000, ease: [0.65, 0, 0.2, 1] }}
        style={{ transformPerspective: 1500, originY: 0 }}
      >
        <Board onReplay={onReplay} />
      </motion.div>
      <AnimatePresence>{scene !== 'live' && <Shaft key="shaft" />}</AnimatePresence>
    </div>
  )
}

export default function App() {
  useEffect(() => startQuality(), [])
  const reduced = useReducedMotion() ?? false
  const [run, setRun] = useState(() => {
    if (reduced) resetBoard(false, true)
    return 0
  })

  return (
    <MotionConfig reducedMotion="user">
      <Experience
        key={run}
        onReplay={() => {
          resetBoard(!reduced, reduced)
          setRun((n) => n + 1)
        }}
      />
    </MotionConfig>
  )
}
