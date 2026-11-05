import { memo, useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import type { Person } from '../data/team'
import { watchPointer } from '../engine/pointer'
import { useBoard, type Beat, type Face } from '../store/board'
import {
  BROWS,
  CLOSED,
  CREASE,
  EYE_CENTER,
  EYE_PATH,
  FACE_SHADOW,
  FACE_SHAPE,
  GAZE,
  HAIR_STRANDS,
  HAND,
  LASH,
  LID,
  MOUTH,
  TILT,
} from './portraitShapes'

const ease = { duration: 0.42, ease: [0.2, 0, 0, 1] } as const
const glide = { type: 'spring', visualDuration: 0.55, bounce: 0 } as const

function HairBack({ person }: { person: Person }) {
  const fill = `url(#hair-${person.id})`
  if (person.id === 'brenda') {
    return <path d="M28 46 C27 28 38 15 50 15 C62 15 73 28 72 46 C72 60 76 72 76 90 C68 95 32 95 24 90 C24 72 28 60 28 46 Z" fill={fill} />
  }
  if (person.id === 'beth') {
    return (
      <>
        <circle cx="50" cy="13.5" r="8.5" fill={fill} />
        <path d="M44 11 C47 8 53 8 56 11 M45 15 C48 13 52 13 55 15" stroke={person.hairLight} strokeWidth="0.7" fill="none" strokeLinecap="round" />
      </>
    )
  }
  return null
}

function HairFront({ person }: { person: Person }) {
  const fill = `url(#hair-${person.id})`
  switch (person.id) {
    case 'diego':
      return (
        <path
          d="M31 46 C28 30 36 16 52 15 C47 13 48 10 52 9 C55 13 62 14 67 18 C72 24 72 36 69 46 C68 40 66 36 62 33 C54 36 42 35 37 33 C34 36 32 40 31 46 Z"
          fill={fill}
        />
      )
    case 'luis':
      return <path d="M31.5 41 C30.5 27 40 18 50 18 C60 18 69.5 27 68.5 41 C66.5 34 62 30 56 29.5 C50 30.5 44 30.5 40 29.5 C36 31 33 35 31.5 41 Z" fill={fill} />
    case 'josediego':
      return <path d="M31 44 C29 28 38 17 51 17 C63 17 71 28 69 44 C68 38 65 33 60 30 C52 33 42 33 38 28 C34 32 32 38 31 44 Z" fill={fill} />
    case 'brenda':
      return <path d="M32 45 C32 30 40 21 50 20 C60 21 68 30 68 45 C65 37 58 31 50 27 C42 31 35 37 32 45 Z" fill={fill} />
    case 'beth':
      return (
        <>
          <path d="M31 45 C29 28 38 18 50 18 C62 18 71 28 69 45 C66 37 60 32 52 31 C46 35 38 37 33 41 Z" fill={fill} />
          <path d="M32.5 44 C30.5 50 31 56 33 60" stroke={person.hair} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </>
      )
  }
}

/** La ropa también dice quién es: polera, camisa abierta, saco, cuello alto, blusa. */
function Clothes({ person }: { person: Person }) {
  const body = 'M10 100 C12 85 30 79 42 76 L58 76 C70 79 88 85 90 100 Z'
  const fill = `url(#shirt-${person.id})`
  switch (person.id) {
    case 'diego':
      return (
        <>
          <path d={body} fill={fill} />
          <path d="M41.5 76 Q50 84 58.5 76 L60 78 Q50 87.5 40 78 Z" fill={person.shirtDeep} />
          <path d="M26 100 L28 90 M74 100 L72 90" stroke={person.shirtDeep} strokeWidth="1" strokeLinecap="round" />
        </>
      )
    case 'luis':
      return (
        <>
          <path d={body} fill={fill} />
          <path d="M43 76 L50 89 L57 76 Z" fill="#EFECE3" />
          <path d="M43 75.5 L50 89 L39 85 Z M57 75.5 L50 89 L61 85 Z" fill={person.shirtDeep} />
          <path d="M50 89 V100" stroke={person.shirtDeep} strokeWidth="0.9" />
          <circle cx="51.8" cy="94" r="0.7" fill="#EFECE3" />
        </>
      )
    case 'josediego':
      return (
        <>
          <path d={body} fill={fill} />
          <path d="M44 76 L50 92 L56 76 Z" fill="#F5F4F0" />
          <path d="M46.5 76 L50 80 L53.5 76 L50 92 Z" fill="#DDDCD6" opacity="0.7" />
          <path d="M43 75.5 L50 100 L33 100 L35 82 Z M57 75.5 L50 100 L67 100 L65 82 Z" fill={person.shirtDeep} />
        </>
      )
    case 'brenda':
      return (
        <>
          <path d={body} fill={fill} />
          <path d="M41.5 69 L58.5 69 L60 79 Q50 84 40 79 Z" fill={person.shirtLight} />
          <path d="M41 73 Q50 76.5 59 73" stroke={person.shirtDeep} strokeWidth="0.8" fill="none" />
        </>
      )
    case 'beth':
      return (
        <>
          <path d={body} fill={fill} />
          <path d="M43 76 L50 87 L57 76 Z" fill={`url(#neck-${person.id})`} />
          <path d="M42.5 75.5 L50 88 L57.5 75.5" stroke={person.shirtDeep} strokeWidth="1" fill="none" />
          <path d="M45 80 Q50 85 55 80" stroke="#E7CE8E" strokeWidth="0.7" fill="none" />
        </>
      )
  }
}

function Glasses({ person }: { person: Person }) {
  return (
    <g stroke={person.frame} strokeWidth="1.15" fill="rgb(255 255 255 / 0.1)">
      {person.glasses === 'round' ? (
        <>
          <circle cx="42" cy="48.6" r="6.8" />
          <circle cx="58" cy="48.6" r="6.8" />
        </>
      ) : (
        <>
          <rect x="34.8" y="43.6" width="13.8" height="10" rx="2.2" />
          <rect x="51.4" y="43.6" width="13.8" height="10" rx="2.2" />
        </>
      )}
      <path d="M48.6 47.4 Q50 46.4 51.4 47.4" fill="none" />
      <path d="M35.2 47 L32 46 M64.8 47 L68 46" fill="none" strokeLinecap="round" />
      <path d="M37.6 45.6 L40 44 M53.6 45.6 L56 44" stroke="#fff" strokeOpacity="0.65" strokeWidth="0.9" strokeLinecap="round" fill="none" />
    </g>
  )
}

function Eye({ side, person, face, lookX, lookY, glance, blinkDelay }: {
  side: 'l' | 'r'
  person: Person
  face: Face
  lookX: MotionValue<number>
  lookY: MotionValue<number>
  glance: number
  blinkDelay: string
}) {
  const cx = EYE_CENTER[side]
  const closed = face === 'celebrate'
  const gaze = GAZE[face]
  return (
    <>
      <motion.g initial={false} animate={{ opacity: closed ? 0 : 1 }} transition={{ duration: 0.2 }}>
        <path d={EYE_PATH[side]} fill="#FBF8F3" />
        <g clipPath={`url(#eye-${side})`}>
          <motion.g style={{ x: lookX, y: lookY }}>
            <motion.g initial={false} animate={{ x: gaze.x + glance, y: gaze.y }} transition={glide}>
              <circle cx={cx} cy={48.3} r={2.55} fill={person.iris} />
              <circle cx={cx} cy={48.3} r={1.25} fill="#120B0C" />
              <circle cx={cx + 0.9} cy={47.4} r={0.6} fill="#fff" />
            </motion.g>
          </motion.g>
          <motion.rect
            x={cx - 6}
            y={38.6}
            width={12}
            height={7}
            fill={person.skin}
            initial={false}
            animate={{ y: LID[face] }}
            transition={glide}
          />
        </g>
        <path d={LASH[side]} stroke="#20140F" strokeWidth={person.id === 'brenda' || person.id === 'beth' ? 1.2 : 0.95} fill="none" strokeLinecap="round" />
        <g className="lid" style={{ animationDelay: blinkDelay }}>
          <path d={EYE_PATH[side]} fill={person.skin} stroke={person.skin} strokeWidth="0.8" />
          <path d={side === 'l' ? 'M38 49 Q42 50.6 46 49' : 'M54 49 Q58 50.6 62 49'} stroke="#20140F" strokeWidth="0.95" fill="none" strokeLinecap="round" />
        </g>
      </motion.g>
      <motion.path
        d={CLOSED[side]}
        stroke="#20140F"
        strokeWidth="1.25"
        fill="none"
        strokeLinecap="round"
        initial={false}
        animate={{ opacity: closed ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
      <path d={CREASE[side]} stroke={person.skinDeep} strokeWidth="0.55" fill="none" strokeLinecap="round" opacity="0.65" />
    </>
  )
}

function Hand({ person, face, nonce }: { person: Person; face: Face; nonce: number }) {
  const pose = HAND[face]
  const wave = face === 'happy' || face === 'celebrate'
  return (
    <motion.g
      initial={false}
      animate={{ x: pose.x, y: pose.y, rotate: pose.rotate, opacity: pose.show ? 1 : 0 }}
      transition={{ type: 'spring', visualDuration: 0.6, bounce: 0.08 }}
      style={{ originX: '50%', originY: '10%' }}
    >
      {/* El saludo se repite solo mientras dura la alegría. */}
      <motion.g
        key={wave ? `wave-${nonce}` : 'still'}
        animate={wave ? { rotate: [0, 13, -7, 13, -5, 0] } : { rotate: 0 }}
        transition={wave ? { duration: 1.5, delay: 0.3, ease: 'easeInOut' } : { duration: 0.2 }}
        style={{ originX: '50%', originY: '20%' }}
      >
        <rect x="-5.2" y="6" width="10.4" height="46" rx="4.4" fill={`url(#shirt-${person.id})`} />
        <rect x="-5.4" y="5" width="10.8" height="3" rx="1.4" fill={person.shirtDeep} />
        <rect x="-4.9" y="-4.6" width="9.8" height="10.6" rx="3.6" fill={`url(#skin-${person.id})`} />
        {[-4.8, -2.3, 0.2, 2.7].map((x, i) => (
          <rect key={x} x={x} y={i === 0 || i === 3 ? -9.4 : -11} width="2.2" height="8" rx="1.1" fill={`url(#skin-${person.id})`} stroke={person.skinShade} strokeWidth="0.25" />
        ))}
        <rect x="4" y="-2.6" width="2.4" height="6.4" rx="1.2" transform="rotate(32 5.2 0.6)" fill={person.skin} stroke={person.skinShade} strokeWidth="0.25" />
      </motion.g>
    </motion.g>
  )
}

type Life = { turn: number; glance: number; tilt: number; brow: number }
const REST: Life = { turn: 0, glance: 0, tilt: 0, brow: 0 }

/**
 * Vida propia: cada tanto gira la cabeza, mira a un lado o levanta una ceja, y vuelve.
 * Cada retrato tiene su propio reloj, así nunca se mueven todos a la vez.
 */
function useLife(active: boolean) {
  const [life, setLife] = useState<Life>(REST)
  useEffect(() => {
    if (!active) return
    let timer = 0
    const next = () => {
      timer = window.setTimeout(
        () => {
          const side = Math.random() < 0.5 ? -1 : 1
          const pick = Math.random()
          setLife(
            pick < 0.4
              ? { ...REST, turn: side * 1.5, glance: side * 0.8, tilt: side * 1.5 }
              : pick < 0.75
                ? { ...REST, glance: side * 1.1 }
                : { ...REST, brow: -1, tilt: side * 2 },
          )
          timer = window.setTimeout(() => {
            setLife(REST)
            next()
          }, 1100 + Math.random() * 1100)
        },
        2600 + Math.random() * 5200,
      )
    }
    next()
    return () => {
      window.clearTimeout(timer)
      setLife(REST)
    }
  }, [active])
  return life
}

type PortraitProps = {
  person: Person
  face: Face
  beat?: Beat
  nonce?: number
  size: number
  index?: number
  /** Cara quieta: no sigue al puntero ni hace gestos. Para listas y lugares pequeños. */
  still?: boolean
}

export const Portrait = memo(function Portrait({ person, face, beat = null, nonce = 0, size, index = 0, still = false }: PortraitProps) {
  const lite = useBoard((s) => s.lite)
  const quiet = still || lite
  const box = useRef<HTMLDivElement>(null)
  const controls = useAnimationControls()
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const lookX = useSpring(rawX, { stiffness: 70, damping: 16 })
  const lookY = useSpring(rawY, { stiffness: 70, damping: 16 })
  const turnFromPointer = useTransform(lookX, (v) => v * 0.9)
  const brow = BROWS[face]
  const mouth = MOUTH[face]
  const life = useLife(face === 'idle' && !quiet)
  const blinkDelay = `${index * -1.37 - (person.id.length % 3) * 0.9}s`
  const large = size >= 60 && !quiet

  useEffect(() => {
    if (!box.current || quiet) return
    return watchPointer({ el: box.current, x: rawX, y: rawY, reach: 1 })
  }, [rawX, rawY, quiet])

  useEffect(() => {
    if (!nonce || !beat) return
    if (beat === 'up') void controls.start({ y: [0, -5, 0], transition: { duration: 0.7, ease: 'easeInOut' } })
    else if (beat === 'done') void controls.start({ y: [0, -7, 0, -3, 0], scale: [1, 1.08, 1, 1.03, 1], transition: { duration: 1.1, ease: 'easeInOut' } })
    else if (beat === 'down') void controls.start({ y: [0, 3, 1, 0], transition: { duration: 1, ease: 'easeInOut' } })
    else void controls.start({ rotate: [0, 6, -3, 0], transition: { duration: 0.8, ease: 'easeInOut' } })
  }, [nonce, beat, controls])

  return (
    <motion.div ref={box} data-portrait animate={controls} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        aria-hidden="true"
        className="block overflow-hidden rounded-full shadow-[0_0_0_1px_rgb(24_24_27/0.08)]"
        style={{ background: person.tint }}
      >
        <rect width="100" height="100" fill={`url(#bg-${person.id})`} />

        {/* Respira solo donde se ve grande: en la tarjeta sería un gasto sin efecto. */}
        <motion.g animate={large ? { y: [0, -0.7, 0] } : { y: 0 }} transition={large ? { duration: 3.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}>
          <HairBack person={person} />
          <Clothes person={person} />
          <path d="M43 62 L43 77 Q50 83 57 77 L57 62 Z" fill={`url(#neck-${person.id})`} />

          <motion.g
            initial={false}
            animate={{ rotate: TILT[face] + life.tilt }}
            transition={glide}
            style={{ originX: '50%', originY: '92%' }}
          >
            <ellipse cx="31.6" cy="50" rx="2.9" ry="4.6" fill={person.skinShade} />
            <ellipse cx="68.4" cy="50" rx="2.9" ry="4.6" fill={person.skinShade} />
            <path d="M31 47.5 Q30 50 31.4 52.8 M69 47.5 Q70 50 68.6 52.8" stroke={person.skinDeep} strokeWidth="0.5" fill="none" />
            {person.id === 'brenda' || person.id === 'beth' ? (
              <>
                <circle cx="31.6" cy="55.4" r="1.15" fill="#E2B64C" />
                <circle cx="68.4" cy="55.4" r="1.15" fill="#E2B64C" />
              </>
            ) : null}

            <path d={FACE_SHAPE[person.id]} fill={`url(#skin-${person.id})`} />
            <path d={FACE_SHADOW[person.id]} fill={person.skinDeep} opacity="0.22" />

            {/* Barba de Luis y sombra de barba de los demás hombres. */}
            {person.id === 'luis' && (
              <path
                d="M31.5 46 C31.5 58 38 73 50 73 C62 73 68.5 58 68.5 46 C67 50.5 64.5 54.5 60 56 C56 55 53 55.6 50 56.6 C47 55.6 44 55 40 56 C35.5 54.5 33 50.5 31.5 46 Z"
                fill={person.hair}
              />
            )}
            {person.id === 'luis' && <ellipse cx="50" cy="63.6" rx="6.8" ry="3.5" fill={person.skinShade} />}
            {(person.id === 'diego' || person.id === 'josediego') && (
              <path d="M34 54 C36 62 42 69 50 70.6 C58 69 64 62 66 54 C64 60 58 64 50 64.6 C42 64 36 60 34 54 Z" fill={person.hair} opacity="0.09" />
            )}

            <ellipse cx="38" cy="57" rx="5.6" ry="3.6" fill="url(#warm-cheek)" />
            <ellipse cx="62" cy="57" rx="5.6" ry="3.6" fill="url(#warm-cheek)" />

            {/* Los rasgos giran más que el pelo: es lo que da la sensación de cabeza que voltea. */}
            <motion.g style={{ x: turnFromPointer }}>
              <motion.g initial={false} animate={{ x: life.turn }} transition={glide}>
                <Eye side="l" person={person} face={face} lookX={lookX} lookY={lookY} glance={life.glance} blinkDelay={blinkDelay} />
                <Eye side="r" person={person} face={face} lookX={lookX} lookY={lookY} glance={life.glance} blinkDelay={blinkDelay} />

                <path d="M51.4 50 C51.8 53 52.6 55.6 53 57 Q51.4 58.8 50 58.4" stroke={person.skinDeep} strokeWidth="0.75" fill="none" strokeLinecap="round" opacity="0.8" />
                <path d="M46.6 57.6 Q47.6 59 49 58.6" stroke={person.skinDeep} strokeWidth="0.65" fill="none" strokeLinecap="round" opacity="0.65" />

                <motion.path d={MOUTH.idle.lower} initial={false} animate={{ d: mouth.lower }} transition={ease} fill={person.lip} opacity="0.85" />
                <motion.path d={MOUTH.idle.teeth} initial={false} animate={{ d: mouth.teeth, opacity: mouth.open ? 1 : 0 }} transition={ease} fill="#FBF9F5" />
                <motion.path d={MOUTH.idle.line} initial={false} animate={{ d: mouth.line }} transition={ease} stroke="#3B1D1A" strokeWidth="1.05" strokeLinecap="round" fill="none" />

                {person.glasses && <Glasses person={person} />}

                <motion.path
                  d="M37.6 42.6 Q41.6 40.2 45.8 41.8"
                  stroke={person.hair}
                  strokeWidth="1.65"
                  strokeLinecap="round"
                  fill="none"
                  initial={false}
                  animate={{ rotate: brow.l, y: brow.ly + life.brow }}
                  transition={glide}
                />
                <motion.path
                  d="M54.2 41.8 Q58.4 40.2 62.4 42.6"
                  stroke={person.hair}
                  strokeWidth="1.65"
                  strokeLinecap="round"
                  fill="none"
                  initial={false}
                  animate={{ rotate: brow.r, y: brow.ry + life.brow }}
                  transition={glide}
                />
              </motion.g>
            </motion.g>

            <motion.g initial={false} animate={{ x: life.turn * 0.35 }} transition={glide}>
              <HairFront person={person} />
              {HAIR_STRANDS[person.id].map((d) => (
                <path key={d} d={d} stroke={person.hairLight} strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.75" />
              ))}
            </motion.g>

            {face === 'sad' && (
              <motion.path
                d="M38.6 53 C37.6 55 37.3 56 38.6 57 C39.9 56 39.6 55 38.6 53 Z"
                fill="#7FB2E5"
                initial={{ opacity: 0, y: -1 }}
                animate={{ opacity: [0, 1, 1, 0], y: [-1, 0, 6, 9] }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.6, ease: 'easeIn' }}
              />
            )}
          </motion.g>

          <Hand person={person} face={face} nonce={nonce} />
        </motion.g>
      </svg>

      {face === 'confused' && (
        <motion.span
          className="absolute -top-1 -right-1 grid size-[14px] place-items-center rounded-full bg-full text-[10px] leading-none font-semibold text-white"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        >
          ?
        </motion.span>
      )}
    </motion.div>
  )
})
