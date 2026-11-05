import { memo } from 'react'
import { motion } from 'motion/react'
import type { Card } from '../data/board'
import { PERSON } from '../data/team'
import { useBoard } from '../store/board'
import { NoteBody } from './NoteBody'

export const NoteCard = memo(function NoteCard({ card, index }: { card: Card; index: number }) {
  const held = useBoard((s) => s.ghosts.some((g) => g.id === card.id))
  const reaction = useBoard((s) => s.cardBeats[card.id])
  const worked = useBoard((s) => Object.values(s.working).includes(card.id))
  const face = reaction?.face ?? (card.returned ? 'worried' : worked ? 'focus' : 'idle')

  return (
    <motion.li
      data-card={card.id}
      layout="position"
      layoutDependency={index}
      transition={{ type: 'spring', visualDuration: 0.5, bounce: 0 }}
      className="relative"
    >
      {held && <div className="absolute inset-0 rounded-lg border border-dashed border-faint/60" />}
      <div
        data-note
        tabIndex={0}
        role="group"
        aria-roledescription="nota"
        aria-label={`${card.key}, ${card.title}, de ${PERSON[card.owner].name}.`}
        className={`note-handle rounded-lg ${held ? 'invisible' : ''}`}
      >
        <NoteBody card={card} face={face} beat={reaction?.beat} nonce={reaction?.nonce} index={index} worked={worked} />
      </div>
    </motion.li>
  )
})
