import type { PersonId } from './team'

export type SprintId = 1 | 2

export type LaneId =
  | 'backlog'
  | 'analysis'
  | 'ux'
  | 'prototype'
  | 'ready'
  | 'dev'
  | 'review'
  | 'qa'
  | 'demo'
  | 'mvp'
  | 'feedback'
  | 'ranked'
  | 'refined'
  | 'planned'
  | 'build'
  | 'integrate'
  | 'regress'
  | 'accept'
  | 'deploy'
  | 'prod'

export type ServiceClass = 'urgent' | 'date' | 'standard' | 'improve'

/**
 * Cómo se atiende un carril. `queue`: espera a que su dueño la jale. `work`: la trabaja su dueño.
 * `check`: su dueño la lleva por una comprobación y puede volver atrás. `end`: terminada.
 */
export type LaneKind = 'queue' | 'work' | 'check' | 'end'

export type Lane = {
  id: LaneId
  name: string
  /** Límite WIP. `null` = sin límite, como las opciones y lo entregado. */
  wip: number | null
  kind: LaneKind
  hint: string
  /** Etapa del flujo. Solo la primera de cada etapa la nombra. */
  stage?: string
}

export type Card = {
  id: string
  key: string
  title: string
  owner: PersonId
  cls: ServiceClass
  lane: LaneId
  points: number
  due?: string
  /** Regresó a un carril anterior y todavía no vuelve a avanzar. */
  returned?: boolean
  returns: number
  seedProgress?: number
  area?: string
  note?: string
  /** Tiempo real: cuándo empezó, para cuándo estaba planificada y cuándo terminó. */
  planMs?: number
  startedAt?: number
  dueAt?: number
  doneAt?: number
  /* Notas creadas en esta pantalla. */
  local?: boolean
  sprint?: SprintId
  createdAt?: number
  pausedAt?: number
}

/**
 * Área y detalle de cada nota. El Sprint 1 sale del documento de contexto de Collectionner
 * (épicas E1 a E5 y E10, y lo que ya estaba hecho). El Sprint 2 es el entrenamiento del modelo propio.
 */
const DETAILS: Record<string, [string, string]> = {
  'Política de privacidad y términos': ['Lanzamiento', 'Dentro de la app, antes de publicar'],
  'Keystore y publicación en Play Store': ['Lanzamiento', 'Firma de lanzamiento de la app'],
  'Miniaturas para listas': ['Imágenes', 'Fotos livianas en el catálogo'],
  'Límite de intentos de acceso': ['Cuentas', 'Login, registro y recuperación'],
  'Proveedor de correo': ['Cuentas', 'Que salga el correo de recuperación'],
  'Cierre automático de subastas': ['Subastas', 'Definir al ganador en el servidor'],
  'Pujas en tiempo real': ['Subastas', 'WebSocket o sondeo corto'],
  'Incremento mínimo y anti-sniping': ['Subastas', 'Reglas configurables'],
  'Fotos en almacenamiento de objetos': ['Imágenes', 'URLs firmadas, ya no base64 en la base'],
  'Prueba de pujas simultáneas': ['Subastas', 'Contra PostgreSQL, confirmar el 409'],
  'Inicio de sesión con Google': ['Cuentas', 'Terminar y subir el código de la app'],
  'Desplegar el backend': ['Backend', 'Contenedor con variables y secretos propios'],
  'Apuntar la app al servidor real': ['Backend', 'Quitar el modo con datos de muestra'],
  'Seed mínimo en Supabase': ['Backend', 'Categorías y cuentas de prueba'],
  'Esquema de base en Supabase': ['Base de datos', 'Migraciones V1 a V6 aplicadas'],
  'App móvil con más de 50 pantallas': ['App móvil', '85 pruebas automáticas pasan'],

  'Definir las clases del modelo': ['Datos', 'Cartuchos, cartas TCG, relojes y Lego'],
  'Reglas de consentimiento de fotos': ['Datos', 'Quién autoriza y cómo se guarda'],
  'Mostrar correcciones del usuario': ['Escaneo', 'Para mejorar catálogo y modelo'],
  'Meta de precisión por clase': ['Evaluación', 'Qué cifra se necesita para publicar'],
  'Probar Gemini de punta a punta': ['Escaneo', 'Clave en el servidor, flujo en el teléfono'],
  'Recolectar fotos con consentimiento': ['Datos', 'Hoy hay 0 clases y 0 imágenes'],
  'Etiquetar y revisar fotos': ['Datos', 'Cada foto con su clase correcta'],
  'Separar entrenamiento y prueba': ['Datos', 'Conjuntos sin fotos repetidas'],
  'Entrenar el clasificador base': ['Modelo', 'Con la canalización de la carpeta ml/'],
  'Aumento de datos': ['Modelo', 'Luz, ángulo y recorte como en el teléfono'],
  'Medir precisión por clase': ['Evaluación', 'Con fotos reales que el modelo no vio'],
  'Comparar contra Gemini': ['Evaluación', 'Mismas fotos, mismas reglas'],
  'Ajustar umbrales de confianza': ['Escaneo', 'Hoy 0,40, 0,60 y margen de 0,15'],
  'Servir el modelo en el backend': ['Escaneo', 'Dentro de /recognition/analyze'],
  'Canalización ml/ reproducible': ['Modelo', 'Escrita y probada, falta darle datos'],
}

const detailsOf = (title: string): Pick<Card, 'area' | 'note'> => {
  const found = DETAILS[title]
  return found ? { area: found[0], note: found[1] } : {}
}

function seedOf(prefix: string, rows: Array<[string, PersonId, ServiceClass, LaneId, number, Partial<Card>?]>): Card[] {
  return rows.map(([title, owner, cls, lane, points, extra], i) => ({
    id: `${prefix}-${i + 1}`,
    key: `${prefix}-${i + 1}`,
    title,
    owner,
    cls,
    lane,
    points,
    returns: 0,
    ...detailsOf(title),
    ...extra,
  }))
}

export type Sprint = {
  id: SprintId
  name: string
  tag: string
  prefix: string
  color: string
  dates: string
  goal: string
  lanes: Lane[]
  seed: Card[]
  phrases: string[]
}

export const SPRINTS: Record<SprintId, Sprint> = {
  1: {
    id: 1,
    name: 'Sprint 1',
    tag: 'MVP',
    prefix: 'MVP',
    color: '#EDEBE6',
    dates: '24 de agosto al 11 de octubre, semanas 1 a 7',
    goal: 'Collectionner en línea, con subastas confiables.',
    lanes: [
      { id: 'backlog', name: 'Backlog', wip: null, kind: 'queue', hint: 'Lo que falta para lanzar, sin compromiso todavía', stage: 'Descubrir' },
      { id: 'analysis', name: 'Análisis', wip: 2, kind: 'work', hint: 'Entender qué hace falta y qué ya existe' },
      { id: 'ux', name: 'Diseño UX', wip: 2, kind: 'work', hint: 'Flujos y pantallas' },
      { id: 'prototype', name: 'Prototipo', wip: 2, kind: 'work', hint: 'Probar la idea antes de construirla' },
      { id: 'ready', name: 'Listo para dev', wip: 3, kind: 'queue', hint: 'Compromiso: desde aquí se construye', stage: 'Construir' },
      { id: 'dev', name: 'Desarrollo', wip: 3, kind: 'work', hint: 'Construcción' },
      { id: 'review', name: 'Revisión', wip: 2, kind: 'check', hint: 'Revisión de código' },
      { id: 'qa', name: 'Pruebas', wip: 2, kind: 'check', hint: 'Comprobar que funciona', stage: 'Entregar' },
      { id: 'demo', name: 'Demo', wip: 1, kind: 'check', hint: 'Mostrarlo funcionando en un teléfono real' },
      { id: 'mvp', name: 'MVP listo', wip: null, kind: 'end', hint: 'Entregado' },
    ],
    seed: seedOf('MVP', [
      ['Política de privacidad y términos', 'diego', 'improve', 'backlog', 2],
      ['Keystore y publicación en Play Store', 'luis', 'standard', 'backlog', 3],
      ['Miniaturas para listas', 'brenda', 'standard', 'backlog', 2],
      ['Límite de intentos de acceso', 'josediego', 'standard', 'analysis', 3, { seedProgress: 0.4 }],
      ['Proveedor de correo', 'diego', 'date', 'analysis', 5, { due: '2 oct', seedProgress: 0.2 }],
      ['Cierre automático de subastas', 'beth', 'standard', 'ux', 2, { seedProgress: 0.6 }],
      ['Pujas en tiempo real', 'brenda', 'standard', 'ux', 5, { seedProgress: 0.3 }],
      ['Incremento mínimo y anti-sniping', 'beth', 'improve', 'prototype', 3, { seedProgress: 0.5 }],
      ['Fotos en almacenamiento de objetos', 'luis', 'standard', 'ready', 3],
      ['Prueba de pujas simultáneas', 'luis', 'urgent', 'dev', 3, { seedProgress: 0.7 }],
      ['Inicio de sesión con Google', 'josediego', 'standard', 'dev', 2, { seedProgress: 0.4 }],
      ['Desplegar el backend', 'diego', 'date', 'review', 5, { due: '25 sep', seedProgress: 0.25 }],
      ['Apuntar la app al servidor real', 'brenda', 'standard', 'qa', 3, { seedProgress: 0.35 }],
      ['Seed mínimo en Supabase', 'beth', 'standard', 'demo', 5, { seedProgress: 0.6 }],
      ['Esquema de base en Supabase', 'luis', 'standard', 'mvp', 2, { seedProgress: 1 }],
      ['App móvil con más de 50 pantallas', 'josediego', 'standard', 'mvp', 1, { seedProgress: 1 }],
    ]),
    phrases: [
      'Primero, poner Collectionner en línea.',
      'De vuelta a lo que sí o sí tiene que salir.',
      'Que se pueda pujar de verdad.',
      'Menos alcance y más entrega.',
    ],
  },
  2: {
    id: 2,
    name: 'Sprint 2',
    tag: 'Incremento',
    prefix: 'IA',
    color: '#0E0E10',
    dates: '12 de octubre al 6 de diciembre, semanas 8 a 15',
    goal: 'Entrenar la IA que reconoce cada pieza.',
    lanes: [
      { id: 'feedback', name: 'Backlog IA', wip: null, kind: 'queue', hint: 'Lo que falta para tener un modelo propio', stage: 'Datos' },
      { id: 'ranked', name: 'Priorizado', wip: 3, kind: 'queue', hint: 'Ordenado por lo que más desbloquea' },
      { id: 'refined', name: 'Datos', wip: 2, kind: 'work', hint: 'Reunir y etiquetar fotos con consentimiento' },
      { id: 'planned', name: 'Listo para entrenar', wip: 3, kind: 'queue', hint: 'Compromiso: con datos suficientes entra a entrenamiento' },
      { id: 'build', name: 'Entrenamiento', wip: 3, kind: 'work', hint: 'Entrenar y ajustar el modelo', stage: 'Entrenar' },
      { id: 'integrate', name: 'Validación', wip: 2, kind: 'check', hint: 'Medir con fotos que no vio' },
      { id: 'regress', name: 'Comparación', wip: 2, kind: 'check', hint: 'Frente a Gemini y las reglas actuales', stage: 'Publicar' },
      { id: 'accept', name: 'Prueba real', wip: 2, kind: 'check', hint: 'En el teléfono, con fotos reales' },
      { id: 'deploy', name: 'Despliegue', wip: 1, kind: 'check', hint: 'Sale una a la vez' },
      { id: 'prod', name: 'En producción', wip: null, kind: 'end', hint: 'Reconociendo piezas en la app' },
    ],
    seed: seedOf('IA', [
      ['Definir las clases del modelo', 'beth', 'standard', 'feedback', 3],
      ['Reglas de consentimiento de fotos', 'luis', 'improve', 'feedback', 3],
      ['Mostrar correcciones del usuario', 'brenda', 'improve', 'feedback', 2],
      ['Meta de precisión por clase', 'diego', 'date', 'ranked', 5, { due: '5 dic' }],
      ['Probar Gemini de punta a punta', 'josediego', 'standard', 'ranked', 3],
      ['Recolectar fotos con consentimiento', 'brenda', 'standard', 'refined', 5, { seedProgress: 0.3 }],
      ['Etiquetar y revisar fotos', 'luis', 'standard', 'refined', 2, { seedProgress: 0.65 }],
      ['Separar entrenamiento y prueba', 'josediego', 'improve', 'planned', 2],
      ['Entrenar el clasificador base', 'beth', 'improve', 'build', 3, { seedProgress: 0.5 }],
      ['Aumento de datos', 'josediego', 'standard', 'build', 2, { seedProgress: 0.8 }],
      ['Medir precisión por clase', 'diego', 'standard', 'integrate', 5, { seedProgress: 0.15 }],
      ['Comparar contra Gemini', 'brenda', 'standard', 'regress', 3, { seedProgress: 0.45 }],
      ['Ajustar umbrales de confianza', 'diego', 'date', 'accept', 3, { due: '20 nov', seedProgress: 0.3 }],
      ['Servir el modelo en el backend', 'beth', 'date', 'deploy', 1, { due: '12 nov', seedProgress: 0.7 }],
      ['Canalización ml/ reproducible', 'luis', 'standard', 'prod', 3, { seedProgress: 1 }],
    ]),
    phrases: [
      'Ya está el MVP. Ahora, a entrenar la IA.',
      'Hoy hay 0 imágenes. Toca reunir las primeras.',
      'Que el modelo aprenda a reconocer cada pieza.',
      'Del dato al modelo en producción.',
    ],
  },
}

const ALL_LANES = [...SPRINTS[1].lanes, ...SPRINTS[2].lanes]

export const LANE = Object.fromEntries(ALL_LANES.map((l) => [l.id, l])) as Record<LaneId, Lane>

const position = (lanes: Lane[]) => lanes.map((l, i) => [l.id, i] as const)

/** Posición del carril dentro de su sprint. */
export const LANE_INDEX = Object.fromEntries([...position(SPRINTS[1].lanes), ...position(SPRINTS[2].lanes)]) as Record<
  LaneId,
  number
>

const neighbours = (lanes: Lane[]) => lanes.slice(0, -1).map((l, i) => [l.id, lanes[i + 1].id] as const)

export const NEXT = Object.fromEntries([...neighbours(SPRINTS[1].lanes), ...neighbours(SPRINTS[2].lanes)]) as Partial<
  Record<LaneId, LaneId>
>

const backwards = (lanes: Lane[]) => lanes.slice(1).map((l, i) => [l.id, lanes[i].id] as const)

export const PREVIOUS = Object.fromEntries([...backwards(SPRINTS[1].lanes), ...backwards(SPRINTS[2].lanes)]) as Partial<
  Record<LaneId, LaneId>
>

/** Carril donde se rehace una nota que no pasó la comprobación. */
export function reworkLane(lane: LaneId): LaneId | null {
  let current = PREVIOUS[lane]
  while (current) {
    if (LANE[current].kind === 'work') return current
    current = PREVIOUS[current]
  }
  return null
}

/** Clases de servicio de STATIK: dicen cómo se atiende cada nota. */
export const CLASSES: Record<ServiceClass, { label: string; chip: string; dot: string; help: string }> = {
  urgent: { label: 'Urgente', chip: 'bg-[var(--accent)] text-white', dot: 'bg-[var(--accent)]', help: 'Pasa antes que todo lo demás.' },
  date: { label: 'Con fecha', chip: 'bg-ink text-card', dot: 'bg-ink', help: 'Tiene un día de entrega fijo.' },
  standard: { label: 'Estándar', chip: 'shadow-[inset_0_0_0_1px_var(--line-strong)] text-soft', dot: 'bg-soft', help: 'Se toma en orden de llegada.' },
  improve: { label: 'Mejora', chip: 'shadow-[inset_0_0_0_1px_var(--line-strong)] text-soft', dot: 'bg-faint', help: 'Suma a largo plazo, sin prisa.' },
}
