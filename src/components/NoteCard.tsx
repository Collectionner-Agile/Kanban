import { memo } from 'react'
import { motion } from 'motion/react'
import type { Card } from '../data/board'
import { PERSON } from '../data/team'
import { beginDrag, nudge } from '../engine/carry'
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
        aria-label={`${card.key}, ${card.title}, de ${PERSON[card.owner].name}. Usa las flechas izquierda y derecha para moverla.`}
        onPointerDown={(e) => beginDrag(e, card.id)}
        onContextMenu={(e) => {
          if (e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType === 'touch') e.preventDefault()
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            void nudge(card.id, 1)
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            void nudge(card.id, -1)
          }
        }}
        className={`note-handle rounded-lg ${held ? 'invisible' : ''}`}
      >
        <NoteBody card={card} face={face} beat={reaction?.beat} nonce={reaction?.nonce} interactive index={index} worked={worked} />
      </div>
    </motion.li>
  )
})
