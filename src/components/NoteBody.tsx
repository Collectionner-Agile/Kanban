import { MOBILE } from '../data/mobile'
import { motion, useTransform } from 'motion/react'
import { CLASSES, LANE, type Card } from '../data/board'
import { PERSON } from '../data/team'
import { removeNote } from '../engine/localNotes'
import { clockText, dayText, deltaOf, hourText, spanText, statusOf, useClock } from '../engine/clock'
import { isActive, progressOf, useBoard, type Beat, type Face } from '../store/board'
import { HealthBadge, HealthCap } from './HealthBadge'
import { useHealthStyle } from './useHealthStyle'
import { Portrait } from './Portrait'
import { Calendar, Check, ClockIcon, Close, Returned } from './icons'

type NoteBodyProps = {
  card: Card
  face: Face
  beat?: Beat
  nonce?: number
  lifted?: boolean
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
  ok: { label: 'A tiempo', dot: 'bg-[var(--state-ontrack)]', text: 'text-soft' },
  risk: { label: 'Por vencer', dot: 'bg-[var(--state-regular)]', text: 'text-[var(--state-regular)]' },
  late: { label: 'Atrasada', dot: 'bg-[var(--state-critical)]', text: 'text-[var(--state-critical)]' },
}

/** Inicio y meta reales de la nota, y si va cumpliendo. Se redibuja solo cuando cambia su estado. */
function TimeLine({ card }: { card: Card }) {
  const status = useClock((now) => statusOf(card, now))
  const lateFor = useClock((now) => (status === 'late' && card.dueAt ? Math.floor((now - card.dueAt) / 5000) * 5000 : 0))
  if (status === 'waiting' || !card.startedAt || !card.dueAt) {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2 text-[11.5px] leading-none text-soft">
        <ClockIcon size={12} className="shrink-0 text-faint" />
        {card.createdAt ? `Creada ${dayText(card.createdAt)}, ${hourText(card.createdAt)}, estimado ${spanText(card.planMs ?? 0)}` : `Sin iniciar, estimado ${spanText(card.planMs ?? 0)}`}
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
      <span className={delta > 0 ? 'font-medium text-[var(--state-critical)]' : 'font-medium text-[var(--state-complete)]'}>{delta > 0 ? `${spanText(delta)} tarde` : `${spanText(delta)} antes`}</span>
    </p>
  )
}

function RemoveNote({ card }: { card: Card }) {
  return (
    <button
      type="button"
      aria-label={`Quitar tu nota ${card.title}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => removeNote(card.id)}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-1 font-medium text-soft hover:bg-lane hover:text-ink"
    >
      <Close size={9} />
      Quitar
    </button>
  )
}

/** Lo que le están haciendo a esta nota. Tiene su lugar reservado: nunca tapa nada ni mueve nada. */
function ActionRow({ card, name, color }: { card: Card; name: string; color: string }) {
  const label = useBoard((s) => {
    if (card.local) return s.localCursors.find((c) => c.id === `cursor-${card.id}`)?.label ?? ''
    const agent = s.agents[card.owner]
    return agent.ready && agent.card === card.id && agent.label !== 'disponible' ? agent.label : ''
  })
  return (
    <p data-action-row className="mt-2 flex h-[22px] items-center">
      {label && (
        <span className="truncate rounded-[6px] px-1.5 py-[4px] text-[12px] leading-none font-medium text-white" style={{ backgroundColor: color }}>
          {name} {label}
        </span>
      )}
    </p>
  )
}

/** Código, historia y tareas del DoD hechas, tal como están en el backlog. */
function BacklogLine({ card }: { card: Card }) {
  if (card.local || !card.hu) return null
  const ended = LANE[card.lane].kind === 'end'
  const link = MOBILE[card.key]
  const dod = card.dod ? `, DoD ${ended ? card.dod.total : card.dod.done} de ${card.dod.total}` : ''
  return (
    <p className="mt-1.5 text-[11.5px] leading-[1.3] text-faint" title={`${card.key}, ${card.points} puntos`}>
      {card.key}, {card.hu}
      {dod}
      {link ? `, app ${link.state.toLowerCase()}` : ''}
    </p>
  )
}

export function NoteBody({ card, face, beat, nonce, lifted = false, index = 0, worked = false }: NoteBodyProps) {
  const cls = CLASSES[card.cls]
  const person = PERSON[card.owner]
  const ended = LANE[card.lane].kind === 'end'
  const state = `${lifted ? 'card-lifted' : ''} ${beat ? BEAT_CLASS[beat] : ''}`
  const health = useHealthStyle(card)
  const ownerRing = (worked || lifted) && !beat ? { boxShadow: `0 0 0 2px ${person.color}, var(${lifted ? '--shadow-lift' : '--shadow-card'})` } : undefined
  const look = { backgroundColor: health.background, borderColor: health.border, transition: 'background-color 500ms, border-color 500ms', ...ownerRing }

  if (ended) {
    return (
      <div className={`card ${state} relative flex items-center gap-2.5 p-2.5 pt-[15px]`} style={look}>
        <HealthCap state={health.state} />
        <Portrait person={person} face={face} beat={beat} nonce={nonce} size={36} index={index} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[1.25] font-medium" title={card.title}>
            {card.title}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--state-complete)]">
            <Check size={11} />
            Entregada por {person.name}
          </p>
          <DoneTime card={card} />
          {card.local && (
            <p className="mt-1 flex items-center justify-between gap-2 text-[11.5px] leading-none text-faint">
              Solo en tu pantalla
              <RemoveNote card={card} />
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${state} relative p-3.5 pt-[18px]`} style={look}>
      <HealthCap state={health.state} />
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
        <HealthBadge state={health.state} />
      </div>

      <p className="mt-3 text-[16px] leading-[1.22] font-medium tracking-[-0.018em] text-pretty" title={card.title}>
        {card.title}
      </p>
      {card.note && <p className="mt-1.5 text-[12.5px] leading-[1.35] text-soft">{card.note}</p>}
      <BacklogLine card={card} />

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
      <ActionRow card={card} name={person.name} color={person.color} />

      {card.local && (
        <p className="mt-2 flex items-center justify-between gap-2 text-[11.5px] leading-none text-faint">
          Solo en tu pantalla
          <RemoveNote card={card} />
        </p>
      )}
    </div>
  )
}
