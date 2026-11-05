import type { PersonId } from '../data/team'
import type { Face } from '../store/board'

/** Geometría de los retratos, en un lienzo de 100 x 100. */

export const EYE_PATH = {
  l: 'M37.8 48.9 Q42 45.2 46.2 48.6 Q42 51.6 37.8 48.9 Z',
  r: 'M53.8 48.6 Q58 45.2 62.2 48.9 Q58 51.6 53.8 48.6 Z',
}
export const EYE_CENTER = { l: 42, r: 58 }
export const LASH = {
  l: 'M37.4 49 Q42 44.6 46.5 48.4',
  r: 'M53.5 48.4 Q58 44.6 62.6 49',
}
export const CREASE = {
  l: 'M38.6 45.8 Q42 43.4 45.6 45.2',
  r: 'M54.4 45.2 Q58 43.4 61.4 45.8',
}
export const CLOSED = {
  l: 'M38 49.6 Q42 45.8 46 49.6',
  r: 'M54 49.6 Q58 45.8 62 49.6',
}

export const FACE_SHAPE: Record<PersonId, string> = {
  diego: 'M32 44 C32 30 40 22 50 22 C60 22 68 30 68 44 C68 56 63 69 50 71 C37 69 32 56 32 44 Z',
  luis: 'M31 44 C31 30 40 22 50 22 C60 22 69 30 69 44 C69 58 62 71 50 72 C38 71 31 58 31 44 Z',
  josediego: 'M32 44 C32 30 40 22 50 22 C60 22 68 30 68 44 C68 55 64 67 50 70 C36 67 32 55 32 44 Z',
  brenda: 'M33 44 C33 30 40 22 50 22 C60 22 67 30 67 44 C67 56 61 68 50 70 C39 68 33 56 33 44 Z',
  beth: 'M32 45 C32 31 40 23 50 23 C60 23 68 31 68 45 C68 57 62 68 50 70 C38 68 32 57 32 45 Z',
}

/** Sombra del lado derecho de la cara: da volumen sin dibujar arrugas. */
export const FACE_SHADOW: Record<PersonId, string> = {
  diego: 'M60 25 C65 30 68 36 68 44 C68 56 63 69 50 71 C57 66 62 56 62 44 C62 36 62 30 60 25 Z',
  luis: 'M61 25 C66 30 69 36 69 44 C69 58 62 71 50 72 C58 66 63 56 63 44 C63 36 63 30 61 25 Z',
  josediego: 'M60 25 C65 30 68 36 68 44 C68 55 64 67 50 70 C57 65 62 55 62 44 C62 36 62 30 60 25 Z',
  brenda: 'M60 25 C64 30 67 36 67 44 C67 56 61 68 50 70 C56 65 61 56 61 44 C61 36 61 30 60 25 Z',
  beth: 'M60 26 C65 31 68 37 68 45 C68 57 62 68 50 70 C57 65 62 56 62 45 C62 37 62 31 60 26 Z',
}

export const HAIR_STRANDS: Record<PersonId, string[]> = {
  diego: ['M38 28 C44 21 56 19 64 24', 'M36 33 C44 27 56 26 66 31', 'M48 16 C52 15 57 16 61 18'],
  luis: ['M38 27 C44 22 56 22 62 27', 'M36 31 C42 27 48 27 52 28'],
  josediego: ['M38 27 C42 22 52 19 60 22', 'M36 34 C38 30 40 28 42 27 M62 30 C64 33 66 36 67 40'],
  brenda: ['M41 25 C45 22 49 21 50 21', 'M59 25 C55 22 51 21 50 21', 'M30 56 C29 66 30 74 28 84', 'M70 56 C71 66 70 74 72 84'],
  beth: ['M38 28 C44 22 52 20 60 23', 'M36 34 C42 28 50 26 58 28'],
}

type Mouth = { line: string; teeth: string; lower: string; open: boolean }

const shut = (line: string, lower: string): Mouth => ({
  line,
  lower,
  teeth: 'M47 63 Q50 63.4 53 63 Q50 63.6 47 63 Z',
  open: false,
})

export const MOUTH: Record<Face, Mouth> = {
  idle: shut('M44.6 62.4 Q50 64.8 55.4 62.4', 'M46 64 Q50 65.8 54 64 Q50 67 46 64 Z'),
  focus: shut('M45.6 63.2 Q50 63.8 54.4 63.2', 'M46.6 64.2 Q50 65 53.4 64.2 Q50 66 46.6 64.2 Z'),
  happy: {
    line: 'M43 61.2 Q50 63.2 57 61.2',
    teeth: 'M43.8 61.5 Q50 63.2 56.2 61.5 Q50 67.4 43.8 61.5 Z',
    lower: 'M45 65.4 Q50 68.4 55 65.4 Q50 69.8 45 65.4 Z',
    open: true,
  },
  celebrate: {
    line: 'M42 60.6 Q50 62.8 58 60.6',
    teeth: 'M42.8 60.9 Q50 62.8 57.2 60.9 Q50 69.2 42.8 60.9 Z',
    lower: 'M44.6 66.4 Q50 70 55.4 66.4 Q50 71.4 44.6 66.4 Z',
    open: true,
  },
  worried: shut('M45.2 64.6 Q50 61.8 54.8 64.6', 'M46.4 65.2 Q50 64 53.6 65.2 Q50 66.8 46.4 65.2 Z'),
  sad: shut('M44.4 66 Q50 60.8 55.6 66', 'M46 66.4 Q50 64 54 66.4 Q50 67.4 46 66.4 Z'),
  confused: shut('M45.2 64 Q50 63 55.2 61.4', 'M46.4 65 Q50 64.6 54 63.4 Q50 66 46.4 65 Z'),
}

export const BROWS: Record<Face, { l: number; r: number; ly: number; ry: number }> = {
  idle: { l: 0, r: 0, ly: 0, ry: 0 },
  focus: { l: 9, r: -9, ly: 0.9, ry: 0.9 },
  happy: { l: -4, r: 4, ly: -0.9, ry: -0.9 },
  celebrate: { l: -6, r: 6, ly: -1.3, ry: -1.3 },
  worried: { l: -14, r: 14, ly: -0.7, ry: -0.7 },
  sad: { l: -20, r: 20, ly: 0, ry: 0 },
  confused: { l: 10, r: -6, ly: 0.9, ry: -1.8 },
}

/** Cuánto baja el párpado superior. */
export const LID: Record<Face, number> = {
  idle: 0,
  focus: 1.3,
  happy: 0.5,
  celebrate: 0,
  worried: -0.4,
  sad: 1.5,
  confused: 0.7,
}

/** Hacia dónde mira en cada estado. */
export const GAZE: Record<Face, { x: number; y: number }> = {
  idle: { x: 0, y: 0 },
  focus: { x: -0.4, y: 1 },
  happy: { x: 0, y: 0 },
  celebrate: { x: 0, y: 0 },
  worried: { x: 0.8, y: -0.4 },
  sad: { x: 0, y: 1.1 },
  confused: { x: 0.9, y: -0.6 },
}

export const TILT: Record<Face, number> = {
  idle: 0,
  focus: -2,
  happy: 3,
  celebrate: -3,
  worried: -3,
  sad: -6,
  confused: 6,
}

/** La mano entra al cuadro con un gesto: saluda, se toca la barbilla, la mejilla o la cabeza. */
export type HandPose = { x: number; y: number; rotate: number; show: boolean }

export const HAND: Record<Face, HandPose> = {
  idle: { x: 76, y: 118, rotate: 6, show: false },
  focus: { x: 57, y: 76, rotate: -28, show: true },
  happy: { x: 79, y: 62, rotate: 10, show: true },
  celebrate: { x: 80, y: 48, rotate: 14, show: true },
  worried: { x: 29, y: 68, rotate: 18, show: true },
  sad: { x: 30, y: 72, rotate: 22, show: true },
  confused: { x: 69, y: 34, rotate: -26, show: true },
}
