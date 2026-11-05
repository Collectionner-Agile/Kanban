import { motion, useTransform } from 'motion/react'
import { CLASSES, LANE, NEXT, PREVIOUS, type Card } from '../data/board'
import { PERSON } from '../data/team'
import { nudge } from '../engine/carry'
import { clockText, dayText, deltaOf, hourText, spanText, statusOf, useClock } from '../engine/clock'
import { isActive, progressOf, type Beat, type Face } from '../store/board'
import { Portrait } from './Portrait'
import { Calendar, Check, ChevronLeft, ChevronRight, ClockIcon, Returned } from './icons'

type NoteBodyProps = {
  card: Card
  face: Face
  beat?: Beat
  nonce?: number
  lifted?: boolean
  interactive?: boolean
  index?: number
  /** Su cursor está sobre ella: la marca con el color de esa persona. */
  worked?: boolean
}

const BEAT_CLASS: Record<Exclude<Beat, null>, string> = {
  up: 'card-up',
  done: 'card-done',
  down: 'card-down',
  huh: 'card-huh',
}

const CHIP = 'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] leading-none font-medium whitespace-nowrap'

function ProgressRing({ cardId, color }: { cardId: string; color: string }) {
  const progress = progressOf(cardId)
  const label = useTransform(progress, (v) => `${Math.round(v * 100)}%`)
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
      <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" className="-rotate-90">
        <circle cx="8" cy="8" r="6" fill="none" stroke="var(--line-strong)" strokeWidth="2.2" />
        <motion.circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" style={{ pathLength: progress }} />
      </svg>
      <motion.span>{label}</motion.span>
    </span>
  )
}

const STATUS_LOOK = {
  ok: { label: 'A tiempo', dot: 'bg-good', text: 'text-good' },
  risk: { label: 'Por vencer', dot: 'bg-[#D9A21B]', text: 'text-[#9A6F00] dark-amber' },
  late: { label: 'Atrasada', dot: 'bg-[var(--accent)]', text: 'text-[var(--accent)]' },
}

/** Inicio y meta reales de la nota, y si va cumpliendo. Se redibuja solo cuando cambia su estado. */
function TimeLine({ card }: { card: Card }) {
  const status = useClock((now) => statusOf(card, now))
  const lateFor = useClock((now) => (status === 'late' && card.dueAt ? Math.floor((now - card.dueAt) / 5000) * 5000 : 0))
  if (status === 'waiting' || !card.startedAt || !card.dueAt) {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2 text-[11.5px] leading-none text-soft">
        <ClockIcon size={12} className="shrink-0 text-faint" />
        Sin iniciar, estimado {spanText(card.planMs ?? 0)}
      </p>
    )
  }
  const look = STATUS_LOOK[status as keyof typeof STATUS_LOOK] ?? STATUS_LOOK.ok
  const detail = `Inició ${dayText(card.startedAt)} a las ${clockText(card.startedAt)}. Planificado para las ${clockText(card.dueAt)}, ${spanText(card.planMs ?? 0)} en total.`
  return (
    <p data-note-time={status} title={detail} className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2 text-[11.5px] leading-none whitespace-nowrap text-soft">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <ClockIcon size={12} className="shrink-0 text-faint" />
        <span className="truncate">
          {dayText(card.startedAt)}, {hourText(card.startedAt)} a {hourText(card.dueAt)}
        </span>
      </span>
      <span className={`inline-flex shrink-0 items-center gap-1 font-medium ${look.text}`}>
        <i className={`size-1.5 rounded-full ${look.dot}`} />
        {status === 'late' ? `${spanText(lateFor)} tarde` : look.label}
      </span>
    </p>
  )
}

/** Al terminar: cuándo fue y cuánto se adelantó o se pasó de lo planificado. */
function DoneTime({ card }: { card: Card }) {
  if (!card.doneAt) return null
  const delta = deltaOf(card)
  return (
    <p data-note-time={delta > 0 ? 'overtime' : 'ontime'} className="mt-1 truncate text-[11.5px] leading-[1.2] text-soft" title={`Terminó ${dayText(card.doneAt)} a las ${clockText(card.doneAt)}`}>
      {dayText(card.doneAt)}, {hourText(card.doneAt)},{' '}
      <span className={delta > 0 ? 'font-medium text-[var(--accent)]' : 'font-medium text-good'}>{delta > 0 ? `${spanText(delta)} tarde` : `${spanText(delta)} antes`}</span>
    </p>
  )
}

export function NoteBody({ card, face, beat, nonce, lifted = false, interactive = false, index = 0, worked = false }: NoteBodyProps) {
  const cls = CLASSES[card.cls]
  const person = PERSON[card.owner]
  const ended = LANE[card.lane].kind === 'end'
  const next = NEXT[card.lane]
  const previous = PREVIOUS[card.lane]
  const state = `${lifted ? 'card-lifted' : ''} ${beat ? BEAT_CLASS[beat] : ''}`
  const ownerRing = (worked || lifted) && !beat ? { boxShadow: `0 0 0 2px ${person.color}, var(${lifted ? '--shadow-lift' : '--shadow-card'})` } : undefined

  if (ended) {
    return (
      <div className={`card ${state} flex items-center gap-2.5 p-2.5`} style={ownerRing}>
        <Portrait person={person} face={face} beat={beat} nonce={nonce} size={36} index={index} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[1.25] font-medium" title={card.title}>
            {card.title}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-good">
            <Check size={11} />
            Entregada por {person.name}
          </p>
          <DoneTime card={card} />
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${state} relative p-3.5`} style={ownerRing}>
      <div className="flex items-center gap-1.5">
        {card.returned ? (
          <span className={`${CHIP} bg-[var(--accent)] text-white`}>
            <Returned size={11} />
            Regresó
          </span>
        ) : (
          <span className={`${CHIP} ${cls.chip}`}>{cls.label}</span>
        )}
        {card.area && <span className="truncate text-[12px] text-soft">{card.area}</span>}
        <span className="ml-auto text-[11px] whitespace-nowrap text-faint pointer-coarse:hidden" translate="no">
          {card.key}
        </span>
      </div>

      <p className="mt-3 text-[16px] leading-[1.22] font-medium tracking-[-0.018em] text-pretty" title={card.title}>
        {card.title}
      </p>
      {card.note && <p className="mt-1.5 text-[12.5px] leading-[1.35] text-soft">{card.note}</p>}

      <div className="mt-3.5 flex items-center gap-2.5">
        <Portrait person={person} face={face} beat={beat} nonce={nonce} size={46} index={index} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[1.2] font-medium">{person.name}</p>
          {card.due ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-soft">
              <Calendar size={12} />
              {card.due}
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-faint">{card.points} puntos</p>
          )}
        </div>
        {isActive(card.lane) && <ProgressRing cardId={card.id} color={person.color} />}
      </div>
      <TimeLine card={card} />

      {interactive && (
        <span className="absolute top-3 right-3 flex gap-0.5">
          {[
            { to: previous, step: -1 as const, label: previous ? `Regresar a ${LANE[previous].name}` : 'Sin carril anterior', Icon: ChevronLeft },
            { to: next, step: 1 as const, label: next ? `Pasar a ${LANE[next].name}` : 'Sin carril siguiente', Icon: ChevronRight },
          ].map(({ to, step, label, Icon }) => (
            <button
              key={step}
              type="button"
              disabled={!to}
              aria-label={label}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => void nudge(card.id, step)}
              className="nudge grid size-[24px] place-items-center rounded-full bg-card text-soft shadow-[0_0_0_1px_var(--line-strong)] hover:text-ink disabled:invisible pointer-coarse:size-8"
            >
              <Icon size={13} />
            </button>
          ))}
        </span>
      )}
    </div>
  )
}
