import { memo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Person } from '../data/team'
import { useBoard } from '../store/board'

export type HandPose = 'open' | 'point' | 'fist'

/*
 * Manos de cursor clásico, dibujadas a mano píxel por píxel: contorno negro y relleno blanco.
 * # es contorno, . es relleno y el espacio es transparente. Todas se apoyan en la misma muñeca,
 * así cambiar de pose no mueve la mano de sitio.
 */
const SPRITES: Record<HandPose, string[]> = {
  point: [
    '      ##         ',
    '     #..#        ',
    '     #..#        ',
    '     #..#        ',
    '     #..###      ',
    '     #..#..###   ',
    '     #..#..#..## ',
    ' ##  #..#..#..#.#',
    '#..# #..........#',
    '#...##..........#',
    ' #...#..........#',
    '  #.............#',
    '  #.............#',
    '   #............#',
    '    #..........# ',
    '     #.........# ',
    '     ########### ',
  ],
  open: [
    '       ##        ',
    '      #..###     ',
    '    ###..#..#    ',
    '   #..#..#..###  ',
    '   #..#..#..#..# ',
    '   #..#..#..#..# ',
    '   #..#..#..#..# ',
    ' ###..#..#..#..# ',
    '#..#...........# ',
    '#...#..........# ',
    ' #.............# ',
    '  #............# ',
    '  #............# ',
    '   #...........# ',
    '    #.........#  ',
    '     #........#  ',
    '     ##########  ',
  ],
  fist: [
    '                 ',
    '                 ',
    '                 ',
    '                 ',
    '                 ',
    '    ## ## ## ##  ',
    '   #..#..#..#..# ',
    '   #..#..#..#..# ',
    ' ###...........# ',
    ' #.#...........# ',
    ' #..#..........# ',
    ' #.............# ',
    '  #............# ',
    '   #...........# ',
    '    #.........#  ',
    '     #........#  ',
    '     ##########  ',
  ],
}

const COLUMNS = 17
const ROWS = 17

/** Convierte el dibujo en un solo trazo por color: mucho más liviano que un cuadrado por píxel. */
function runs(sprite: string[], mark: string) {
  let path = ''
  sprite.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (row[x] !== mark) {
        x += 1
        continue
      }
      let end = x
      while (end < row.length && row[end] === mark) end += 1
      path += `M${x} ${y}h${end - x}v1h${x - end}z`
      x = end
    }
  })
  return path
}

const PATHS = Object.fromEntries((Object.keys(SPRITES) as HandPose[]).map((pose) => [pose, { line: runs(SPRITES[pose], '#'), fill: runs(SPRITES[pose], '.') }])) as Record<HandPose, { line: string; fill: string }>
const POSES = Object.keys(PATHS) as HandPose[]

/** Abierta al viajar, señalando al trabajar y hecha puño al llevar una nota. */
export const Hand = memo(function Hand({ person, pose, cell = 2 }: { person: Person; pose: HandPose; cell?: number }) {
  const reduced = useReducedMotion()
  const lite = useBoard((s) => s.lite)
  const tapping = pose === 'point' && !reduced && !lite

  return (
    <svg viewBox={`0 -3 ${COLUMNS} ${ROWS + 3}`} width={COLUMNS * cell} height={(ROWS + 3) * cell} aria-hidden="true" data-hand={pose} shapeRendering="crispEdges" className="block overflow-visible">
      {POSES.map((name) => (
        <motion.g key={name} initial={false} animate={{ opacity: name === pose ? 1 : 0 }} transition={{ duration: 0.07, ease: 'linear' }}>
          <path d={PATHS[name].fill} fill="#ffffff" />
          <path d={PATHS[name].line} fill="#111111" />
        </motion.g>
      ))}

      {/* Rayitas de clic sobre el dedo mientras trabaja una nota. */}
      <motion.g
        fill={person.color}
        initial={false}
        animate={tapping ? { opacity: [0, 1, 1, 0, 0] } : { opacity: 0 }}
        transition={tapping ? { duration: 1.6, times: [0, 0.08, 0.3, 0.38, 1], repeat: Infinity, ease: 'linear' } : { duration: 0.1 }}
      >
        <rect x="6" y="-3" width="1" height="2" />
        <rect x="3" y="-2" width="1" height="1" />
        <rect x="4" y="-1" width="1" height="1" />
        <rect x="9" y="-2" width="1" height="1" />
        <rect x="8" y="-1" width="1" height="1" />
      </motion.g>
    </svg>
  )
})
