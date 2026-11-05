import { memo, useEffect, useRef } from 'react'
import type { Person } from '../data/team'
import type { Face } from '../store/board'
import { Portrait } from './Portrait'

/* Cada combinación de persona, gesto y tamaño se dibuja una sola vez. Después se reutiliza. */
const drawn = new Map<string, string>()

/**
 * Retrato para listas y avisos, donde no hace falta que siga al puntero. Montarlo no cuesta casi
 * nada: por eso abrir el historial o cambiar de aviso no traba la animación en equipos lentos.
 */
export const StillFace = memo(function StillFace({ person, face, size, index = 0 }: { person: Person; face: Face; size: number; index?: number }) {
  const key = `${person.id}:${face}:${size}`
  const html = drawn.get(key)
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (html) return
    // Espera a que el gesto termine de dibujarse antes de guardarlo.
    const timer = window.setTimeout(() => {
      if (box.current) drawn.set(key, box.current.innerHTML)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [key, html])

  if (html) return <span className="block shrink-0" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />
  return (
    <span ref={box} className="block shrink-0">
      <Portrait person={person} face={face} size={size} index={index} still />
    </span>
  )
})
