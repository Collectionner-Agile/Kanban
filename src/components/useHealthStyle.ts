import type { Card } from '../data/board'
import { HEALTH } from '../data/health'
import { healthOf, useClock } from '../engine/clock'
import { useBoard } from '../store/board'

export const useHealth = (card: Card) => {
  const blocked = useBoard((s) => Object.values(s.blockedCards).includes(card.id))
  return useClock((now) => healthOf(card, now, blocked))
}

/** El color de la nota se ve de lejos: tiñe toda la tarjeta y le pone una cabecera sólida. */
export function useHealthStyle(card: Card) {
  const state = useHealth(card)
  const color = HEALTH[state].color
  return { state, color, background: `color-mix(in oklab, ${color} 11%, var(--card))`, border: `color-mix(in oklab, ${color} 60%, transparent)` }
}
