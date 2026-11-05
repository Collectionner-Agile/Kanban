import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SPRINTS, type SprintId } from '../data/board'
import { TEAM } from '../data/team'
import { useBoard, type Face } from '../store/board'
import { longDayText, hourText, weekOf } from '../engine/clock'
import { Clawd, type ClawdAction, type ClawdGear } from './Clawd'
import { Portrait } from './Portrait'

/** Una palabra cada 70 ms: cada una sube 16 px saliendo de un desenfoque de 12 px en 0.34 s. */
const WORD_S = 0.07
const ARRIVE = [0.16, 1, 0.3, 1] as const
const OPEN_S = 0.65

const THEME: Record<SprintId, { bg: string; ink: string; soft: string; accent: string }> = {
  1: { bg: '#EDEBE6', ink: '#111111', soft: '#5C5B57', accent: '#E8501C' },
  2: { bg: '#0E0E10', ink: '#F3F2EE', soft: '#A9A8A3', accent: '#FF6A2B' },
}

/**
 * Todas las palabras están en su lugar desde el primer cuadro, aunque aún no se vean.
 * Así nada se reacomoda ni salta de línea mientras la frase aparece.
 */
function Phrase({ text, delay, leaving }: { text: string; delay: number; leaving: boolean }) {
  const lite = useBoard((s) => s.lite)
  const words = text.replace(/\.$/, '').split(' ')
  const lastAt = delay + (words.length - 1) * WORD_S + 0.34
  return (
    <p
      data-phrase
      className="max-w-[19ch] text-[clamp(36px,5.6vw,88px)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance"
    >
      <span className="sr-only">{text}</span>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="inline-block whitespace-pre"
          initial={{ y: 16, opacity: 0, filter: lite ? 'blur(0px)' : 'blur(12px)' }}
          animate={leaving ? { y: -14, opacity: 0, filter: lite ? 'blur(0px)' : 'blur(8px)' } : { y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={leaving ? { duration: 0.24, ease: 'easeIn', delay: i * 0.015 } : { duration: 0.34, ease: ARRIVE, delay: delay + i * WORD_S }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
          {i === words.length - 1 && (
            <motion.i
              className="type-caret ml-[0.05em] inline-block h-[0.8em] w-[0.08em] translate-y-[0.08em] rounded-[1px] bg-[var(--accent)]"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.2, ease: ARRIVE, delay: lastAt }}
            />
          )}
        </motion.span>
      ))}
    </p>
  )
}

/** Los cinco aparecen uno tras otro y sonríen cuando la frase ya está completa. */
function Riders({ size, delay, leaving }: { size: number; delay: number; leaving: boolean }) {
  const [face, setFace] = useState<Face>('idle')

  useEffect(() => {
    const timer = window.setTimeout(() => setFace('happy'), (delay + 0.4) * 1000)
    return () => window.clearTimeout(timer)
  }, [delay])

  return (
    <span className="inline-flex" aria-hidden="true">
      {TEAM.map((person, i) => (
        <motion.span
          key={person.id}
          className="-ml-[10px] block rounded-full first:ml-0"
          style={{ boxShadow: '0 0 0 3px var(--shaft-bg)' }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={leaving ? { scale: 0.86, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={leaving ? { duration: 0.22, ease: 'easeIn', delay: i * 0.012 } : { type: 'spring', visualDuration: 0.4, bounce: 0.15, delay: delay + i * 0.05 }}
        >
          <Portrait person={person} face={face} size={size} index={i} />
        </motion.span>
      ))}
    </span>
  )
}

/** Clawd entra caminando, saluda, y se va de un salto con la frase. Cada sprint con lo suyo. */
function ClawdGuide({ target, intro, leaving, delay, unit }: { target: SprintId; intro: boolean; leaving: boolean; delay: number; unit: number }) {
  const [step, setStep] = useState<ClawdAction>('walk')
  useEffect(() => {
    const timer = window.setTimeout(() => setStep('wave'), (delay + 0.9) * 1000)
    return () => window.clearTimeout(timer)
  }, [delay])
  const [hour] = useState(() => new Date().getHours())
  const gear: ClawdGear[] = intro ? (hour >= 5 && hour < 12 ? ['coffee'] : hour >= 19 || hour < 5 ? ['tophat'] : ['glasses']) : target === 1 ? ['laptop'] : ['party']
  return (
    <motion.span
      className="block shrink-0"
      style={{ color: 'var(--shaft-ink)' }}
      initial={{ x: '-70vw' }}
      animate={leaving ? { x: 0, y: -46, opacity: 0, scale: 0.9 } : { x: 0, y: 0, opacity: 1, scale: 1 }}
      transition={leaving ? { duration: 0.28, ease: 'easeIn' } : { duration: 0.9, delay, ease: [0.22, 0.8, 0.3, 1] }}
    >
      <Clawd size={unit} eyes={step === 'walk' ? 'dots' : 'happy'} gear={step === 'walk' ? [] : gear} action={leaving ? 'hop' : step} />
    </motion.span>
  )
}

/**
 * Cambio de sprint sin cortes: un círculo se abre desde la pestaña que tocaste con el color del
 * sprint nuevo. Después la frase se va y el tablero aparece sobre ese mismo color, sin costura.
 */
export function Shaft() {
  const scene = useBoard((s) => s.scene)
  const phrase = useBoard((s) => s.phrase)
  const sprintNow = useBoard((s) => s.sprint)
  const lite = useBoard((s) => s.lite)
  const [mounted] = useState(() => {
    const fromTravel = scene === 'leave'
    const target: SprintId = fromTravel ? (sprintNow === 1 ? 2 : 1) : sprintNow
    const tab = fromTravel ? document.getElementById(`tab-${target}`)?.getBoundingClientRect() : null
    return {
      fromTravel,
      target,
      x: tab ? tab.left + tab.width / 2 : window.innerWidth / 2,
      y: tab ? tab.top + tab.height / 2 : 0,
    }
  })
  const sprint = SPRINTS[mounted.target]
  const theme = THEME[mounted.target]
  const [width, setWidth] = useState(() => window.innerWidth)
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const calm = useReducedMotion()
  const leaving = scene === 'enter'
  const size = Math.round(Math.min(84, Math.max(46, width * 0.058)))
  const start = mounted.fromTravel ? OPEN_S * 0.55 : 0.2
  const wordCount = phrase.replace(/\.$/, '').split(' ').length
  const peopleAt = start + wordCount * WORD_S + 0.1
  const closed = `circle(0px at ${mounted.x}px ${mounted.y}px)`
  const open = `circle(${Math.hypot(window.innerWidth, window.innerHeight) * 1.1}px at ${mounted.x}px ${mounted.y}px)`

  return (
    <motion.div
      data-shaft
      className="pointer-events-none absolute inset-0 z-40 flex h-dvh flex-col justify-center overflow-hidden px-[6vw]"
      style={
        {
          backgroundColor: theme.bg,
          color: theme.ink,
          '--accent': theme.accent,
          '--shaft-bg': theme.bg,
          '--shaft-ink': theme.ink,
        } as React.CSSProperties
      }
      initial={{ clipPath: mounted.fromTravel && !calm ? closed : open, opacity: 1 }}
      animate={{ clipPath: open, opacity: leaving ? 0 : 1 }}
      transition={{
        clipPath: { duration: OPEN_S, ease: [0.65, 0, 0.2, 1] },
        opacity: { duration: 0.42, ease: 'easeOut', delay: leaving ? 0.2 : 0 },
      }}
    >
      <Phrase text={phrase} delay={start} leaving={leaving} />
      <div className="mt-[clamp(20px,4vh,40px)] flex flex-wrap items-center gap-x-5 gap-y-3">
        <ClawdGuide target={mounted.target} intro={!mounted.fromTravel} leaving={leaving} delay={Math.max(0, start - 0.15)} unit={Math.round(size * 0.1)} />
        <Riders size={size} delay={peopleAt} leaving={leaving} />
        <motion.p
          className="text-[clamp(14px,1.4vw,18px)]"
          style={{ color: theme.soft }}
          initial={{ y: 16, opacity: 0, filter: lite ? 'blur(0px)' : 'blur(12px)' }}
          animate={leaving ? { y: -10, opacity: 0, filter: lite ? 'blur(0px)' : 'blur(6px)' } : { y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={leaving ? { duration: 0.22, ease: 'easeIn' } : { duration: 0.34, ease: ARRIVE, delay: peopleAt + 0.3 }}
        >
          {sprint.name}, {sprint.id === 1 ? 'el MVP' : 'el incremento'}, {sprint.dates}
          <span className="block opacity-80">
            Hoy es {longDayText(openedAt)}, {hourText(openedAt)}, semana {weekOf(openedAt)}
          </span>
        </motion.p>
      </div>
    </motion.div>
  )
}
