import { useEffect, useMemo, useRef, useState } from 'react'
import { SPRINTS, type SprintId } from '../data/board'
import { HEALTH, HEALTH_ORDER } from '../data/health'
import { healthOf, useClock, type HealthState } from '../engine/clock'
import { useBoard } from '../store/board'

export function HealthCap({ state }: { state: HealthState }) {
  return <i aria-hidden="true" data-health={state} className="absolute inset-x-0 top-0 h-[7px] rounded-t-[13px] transition-colors duration-500" style={{ backgroundColor: HEALTH[state].color }} />
}

/** El estado en palabras: el color nunca es la única señal. */
export function HealthBadge({ state }: { state: HealthState }) {
  const look = HEALTH[state]
  return (
    <span
      title={look.help}
      data-health-label={state}
      className="ml-auto inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11.5px] leading-none font-semibold whitespace-nowrap text-card transition-colors duration-500"
      style={{ backgroundColor: look.color }}
    >
      {look.label}
    </span>
  )
}

/** La tarjeta que explica cada color, con cuántas notas hay en él ahora mismo. */
export function HealthLegend({ sprint }: { sprint: SprintId }) {
  const cards = useBoard((s) => s.cards)
  const archived = useBoard((s) => s.archived)
  const blocked = useBoard((s) => s.blockedCards)
  const key = useClock((now) => {
    const held = Object.values(blocked)
    const count: Record<HealthState, number> = { waiting: 0, ontrack: 0, regular: 0, critical: 0, complete: archived }
    for (const card of cards) count[healthOf(card, now, held.includes(card.id))] += 1
    return HEALTH_ORDER.map((state) => count[state]).join(':')
  })
  const counts = useMemo(() => key.split(':').map(Number), [key])
  return (
    <section aria-label={`Qué significa cada color en ${SPRINTS[sprint].name}`} data-health-legend={key} className="card w-[min(330px,calc(100vw-48px))] shrink-0 p-3.5">
      <h3 className="text-[13.5px] font-semibold tracking-[-0.01em]">Estados de las notas</h3>
      <ul className="mt-2 space-y-1.5">
        {HEALTH_ORDER.map((state, i) => (
          <li key={state} className="flex items-baseline gap-2 text-[12.5px] leading-[1.3]">
            <i aria-hidden="true" className="size-2 shrink-0 translate-y-[-0.5px] rounded-full" style={{ backgroundColor: HEALTH[state].color }} />
            <span className="min-w-0 flex-1 text-soft">
              <b className="font-medium text-ink">{HEALTH[state].label}.</b> {HEALTH[state].help}
            </span>
            <b className="font-semibold tabular-nums">{counts[i]}</b>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Siempre a la vista, aunque la cámara esté lejos: color y cuántas hay. Al tocarlo explica cada color. */
export function HealthPill() {
  const sprint = useBoard((s) => s.sprint)
  const cards = useBoard((s) => s.cards)
  const archived = useBoard((s) => s.archived)
  const blocked = useBoard((s) => s.blockedCards)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const key = useClock((now) => {
    const held = Object.values(blocked)
    const count: Record<HealthState, number> = { waiting: 0, ontrack: 0, regular: 0, critical: 0, complete: archived }
    for (const card of cards) count[healthOf(card, now, held.includes(card.id))] += 1
    return HEALTH_ORDER.map((state) => count[state]).join(':')
  })
  const counts = useMemo(() => key.split(':').map(Number), [key])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
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
    <div ref={root} data-health-pill={key} className="relative">
      {open && (
        <div className="absolute right-0 bottom-full mb-2">
          <HealthLegend sprint={sprint} />
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Estados de las notas: ${HEALTH_ORDER.map((state, i) => `${HEALTH[state].label} ${counts[i]}`).join(', ')}`}
        onClick={() => setOpen((v) => !v)}
        className="float flex h-8 items-center gap-2 rounded-full px-2.5 text-[12px] font-semibold tabular-nums transition-transform duration-150 active:scale-[0.96]"
      >
        {HEALTH_ORDER.map((state, i) => (
          <span key={state} className="inline-flex items-center gap-1">
            <i aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: HEALTH[state].color }} />
            {counts[i]}
          </span>
        ))}
      </button>
    </div>
  )
}

/** En el mapa: un punto rojo si el carril tiene alguna nota crítica. */
export function LaneAlarm({ lane }: { lane: string }) {
  const cards = useBoard((s) => s.cards)
  const critical = useClock((now) => cards.filter((c) => c.lane === lane && healthOf(c, now) === 'critical').length)
  if (!critical) return null
  return <i aria-label={`${critical} críticas`} className="absolute top-1.5 right-1.5 size-1.5 rounded-full" style={{ backgroundColor: 'var(--state-critical)' }} />
}
