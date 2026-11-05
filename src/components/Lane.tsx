import { memo, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { Lane as LaneData } from '../data/board'
import { addCard, useBoard } from '../store/board'
import { NoteCard } from './NoteCard'
import { Lock, Plus } from './icons'

function AddNote() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  const submit = () => {
    const clean = title.trim()
    if (clean) {
      addCard(clean)
    }
    setTitle('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center gap-1.5 rounded-[12px] px-2.5 py-2.5 text-[13px] font-medium text-soft transition-colors duration-150 hover:bg-lane hover:text-ink"
      >
        <Plus size={13} />
        Nueva nota
      </button>
    )
  }

  return (
    <form
      className="mt-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label className="sr-only" htmlFor="new-note">
        Título de la nota
      </label>
      <input
        id="new-note"
        autoFocus
        name="note"
        autoComplete="off"
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setTitle('')
            setOpen(false)
          }
        }}
        placeholder="Título de la nota…"
        className="w-full rounded-[12px] bg-card px-3 py-2.5 text-[13.5px] shadow-[var(--shadow-card)] outline-none placeholder:text-faint focus-visible:shadow-[0_0_0_2px_var(--accent)]"
      />
    </form>
  )
}

export const Lane = memo(function Lane({ lane, first }: { lane: LaneData; first: boolean }) {
  const allCards = useBoard((s) => s.cards)
  const ghosts = useBoard((s) => s.ghosts)
  const flash = useBoard((s) => s.laneFlash[lane.id] ?? 0)
  const archived = useBoard((s) => s.archived)
  const dimmed = useBoard((s) => (s.focus ? !s.focus.includes(lane.id) : false))
  const cards = useMemo(() => allCards.filter((c) => c.lane === lane.id), [allCards, lane.id])

  const limit = lane.wip
  const full = limit !== null && cards.length >= limit
  const incoming = ghosts.filter((g) => g.target === lane.id && g.from !== lane.id)
  const hovered = incoming.some((g) => g.by === 'user')
  const blocked = hovered && full
  const accepting = hovered && !full

  return (
    <section
      data-lane={lane.id}
      aria-labelledby={`lane-${lane.id}`}
      title={lane.hint}
      className="w-[276px] shrink-0 rounded-[20px] p-2.5 transition-[background-color,opacity] duration-500"
      style={{
        backgroundColor: blocked ? 'color-mix(in oklab, var(--accent) 16%, transparent)' : accepting ? 'var(--lane-over)' : 'var(--lane)',
        opacity: dimmed ? 0.34 : 1,
      }}
    >
      <header className="px-1.5 pt-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id={`lane-${lane.id}`} className="text-[15px] font-semibold tracking-[-0.015em]">
            {lane.name}
          </h3>
          {limit !== null ? (
            <span
              key={flash}
              className={`inline-flex h-[24px] shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] leading-none font-medium ${
                full ? 'bg-ink text-card' : 'text-soft shadow-[inset_0_0_0_1px_var(--line-strong)]'
              } ${flash ? 'wip-flash' : ''}`}
              aria-label={`Límite WIP: ${cards.length} de ${limit}`}
            >
              {full && <Lock size={10} />}
              WIP {cards.length}/{limit}
            </span>
          ) : (
            <span className="inline-flex h-[24px] shrink-0 items-center rounded-full px-2.5 text-[12px] leading-none font-medium text-soft shadow-[inset_0_0_0_1px_var(--line-strong)]" aria-label={`${cards.length} notas, sin límite`}>
              {cards.length}
            </span>
          )}
        </div>
        {limit !== null && (
          <div className="mt-2.5 flex gap-1" aria-hidden="true">
            {Array.from({ length: limit }, (_, i) => (
              <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                <i
                  className="block h-full origin-left rounded-full bg-ink transition-transform duration-500 ease-out-soft"
                  style={{ transform: `scaleX(${i < cards.length ? 1 : 0})` }}
                />
              </span>
            ))}
          </div>
        )}
      </header>

      <ul className="flex list-none flex-col gap-2 p-0">
        {cards.map((card, index) => (
          <NoteCard key={card.id} card={card} index={index} />
        ))}
        {!full && incoming.length > 0 && (
          <motion.li
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 110 }}
            transition={{ type: 'spring', visualDuration: 0.4, bounce: 0 }}
            className="rounded-[14px] shadow-[inset_0_0_0_1.5px_var(--line-strong)]"
            aria-hidden="true"
          />
        )}
        {cards.length === 0 && incoming.length === 0 && (
          <li className="rounded-[14px] px-3 py-6 text-center text-[13px] text-faint shadow-[inset_0_0_0_1px_var(--line)]">Sin notas</li>
        )}
      </ul>

      {/* Va al pie del carril para que la nota arrastrada no lo tape. */}
      {blocked && <p className="mt-2 px-1.5 text-[13px] leading-[1.3] font-medium text-[var(--accent)]">Carril lleno. Termina una nota primero.</p>}
      {first && <AddNote />}
      {lane.kind === 'end' && archived > 0 && <p className="mt-2 px-1.5 text-[12.5px] text-soft">y {archived} archivadas</p>}
    </section>
  )
})
