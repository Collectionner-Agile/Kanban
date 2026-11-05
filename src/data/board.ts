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
  /** Historia y escenarios que cubre, tareas del DoD y cartillas de las que depende. */
  hu?: string
  dod?: { done: number; total: number }
  depends?: string[]
  /** Carriles que esta cartilla no pisa: lo solo de backend no pasa por diseño. */
  skip?: LaneId[]
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
    dates: '2 al 13 de noviembre, semanas 11 y 12',
    goal: 'Un MVP que cumpla el DoD completo.',
    lanes: [
      { id: 'backlog', name: 'Backlog', wip: null, kind: 'queue', hint: 'Ordenado por el PO; sin asignar responsable', stage: 'Descubrir' },
      { id: 'analysis', name: 'Análisis', wip: 1, kind: 'work', hint: 'Aclarar criterios con el PO' },
      { id: 'ux', name: 'Diseño UX', wip: 1, kind: 'work', hint: 'Las cartillas solo de backend saltan esta columna' },
      { id: 'prototype', name: 'Prototipo', wip: 1, kind: 'work', hint: 'Las cartillas solo de backend saltan esta columna' },
      { id: 'ready', name: 'Listo para dev', wip: 3, kind: 'queue', hint: 'Cola de entrada a Desarrollo', stage: 'Construir' },
      { id: 'dev', name: 'Desarrollo', wip: 3, kind: 'work', hint: 'Terminar antes de empezar' },
      { id: 'review', name: 'Revisión', wip: 2, kind: 'check', hint: 'Revisión por pares obligatoria (DoD)' },
      { id: 'qa', name: 'Pruebas', wip: 1, kind: 'check', hint: 'Pruebas automatizadas en verde', stage: 'Entregar' },
      { id: 'demo', name: 'Demo', wip: 1, kind: 'check', hint: 'Despliegue en entorno de validación' },
      { id: 'mvp', name: 'MVP listo', wip: null, kind: 'end', hint: 'Cumple el DoD completo' },
    ],
    seed: [
      { id: "MVP-01", key: "MVP-01", title: "Base de la app móvil", owner: "brenda", cls: "standard", lane: "backlog", points: 5, returns: 0, area: "Plataforma", note: "Arquitectura por módulos, navegación de 5 pestañas y cliente API con errores tipados", hu: "Habilitador", dod: {done: 4, total: 6}, skip: ["analysis","ux","prototype"] },
      { id: "MVP-02", key: "MVP-02", title: "Sistema de diseño Slab", owner: "diego", cls: "standard", lane: "backlog", points: 5, returns: 0, area: "Diseño", note: "Tokens, tipografía Fraunces/Archivo, modo claro/oscuro e idioma es/en", hu: "RNF01", dod: {done: 5, total: 6}, skip: ["analysis","ux","prototype"] },
      { id: "MVP-03", key: "MVP-03", title: "Registro e inicio de sesión", owner: "brenda", cls: "standard", lane: "review", points: 5, returns: 0, area: "Cuenta", note: "Crear cuenta, ingresar, recuperar contraseña y sesión segura", hu: "HU01 esc. 1–4", dod: {done: 3, total: 7}, seedProgress: 0.15 },
      { id: "MVP-04", key: "MVP-04", title: "Gestión del perfil", owner: "beth", cls: "standard", lane: "dev", points: 3, returns: 0, area: "Cuenta", note: "Ver, editar, cambiar contraseña y eliminar cuenta", hu: "HU02 esc. 1–3", dod: {done: 3, total: 6}, seedProgress: 1 },
      { id: "MVP-05", key: "MVP-05", title: "Catálogo y búsqueda", owner: "luis", cls: "standard", lane: "ready", points: 5, returns: 0, area: "Catálogo", note: "Categorías, búsqueda, filtros y orden de resultados", hu: "HU03 esc. 1–3", dod: {done: 3, total: 7} },
      { id: "MVP-06", key: "MVP-06", title: "Detalle de pieza", owner: "diego", cls: "standard", lane: "ready", points: 3, returns: 0, area: "Catálogo", note: "Galería, visor con zoom, reseñas y comentarios", hu: "HU03", dod: {done: 3, total: 5} },
      { id: "MVP-07", key: "MVP-07", title: "Publicar una pieza", owner: "luis", cls: "standard", lane: "dev", points: 5, returns: 0, area: "Publicación", note: "Ficha con hasta 5 fotos, sin datos EXIF", hu: "HU04 esc. 1–3", dod: {done: 4, total: 7}, seedProgress: 1 },
      { id: "MVP-08", key: "MVP-08", title: "Subastas", owner: "josediego", cls: "standard", lane: "review", points: 8, returns: 0, area: "Subastas", note: "Listar, pujar, crear y cancelar con cuenta regresiva", hu: "HU06 esc. 1–4", dod: {done: 4, total: 7}, seedProgress: 0.4 },
      { id: "MVP-09", key: "MVP-09", title: "Comunidades", owner: "beth", cls: "standard", lane: "ready", points: 8, returns: 0, area: "Comunidades", note: "Unirse, feed, publicaciones y comentarios", hu: "HU08 esc. 1–3", dod: {done: 3, total: 6} },
      { id: "MVP-10", key: "MVP-10", title: "Reconocimiento por cámara", owner: "josediego", cls: "standard", lane: "dev", points: 8, returns: 0, area: "IA", note: "Identifica la pieza con Gemini y la empareja con el catálogo", hu: "Relacionada a HU11", dod: {done: 4, total: 6}, seedProgress: 1 },
      { id: "MVP-11", key: "MVP-11", title: "Suite de pruebas", owner: "diego", cls: "standard", lane: "backlog", points: 5, returns: 0, area: "Calidad", note: "Pruebas unitarias, de widgets, de integración y matriz responsiva", hu: "DoD", dod: {done: 2, total: 4}, skip: ["analysis","ux","prototype"] },
      { id: "MVP-12", key: "MVP-12", title: "Pantallas emergentes", owner: "brenda", cls: "standard", lane: "analysis", points: 1, returns: 0, area: "Alcance", note: "El PO decide si las ~20 pantallas fuera del informe se mantienen", hu: "Fuera del informe", dod: {done: 0, total: 3}, seedProgress: 0.3, skip: ["ux","prototype"] },
    ],
    phrases: [
      'Código terminado. Falta cumplir el DoD.',
      'Revisión de dos en dos, según el orden.',
      'Nada entra a MVP listo sin verificar.',
      'Terminar antes de empezar.',
    ],
  },
  2: {
    id: 2,
    name: 'Sprint 2',
    tag: 'Incremento',
    prefix: 'INC',
    color: '#0E0E10',
    dates: '16 al 27 de noviembre, semanas 13 y 14',
    goal: 'Comprar, intercambiar y confiar en la plataforma.',
    lanes: [
      { id: 'feedback', name: 'Backlog', wip: null, kind: 'queue', hint: 'Ordenado por el PO; sin asignar responsable', stage: 'Descubrir' },
      { id: 'ranked', name: 'Análisis', wip: 1, kind: 'work', hint: 'Aclarar criterios con el PO' },
      { id: 'refined', name: 'Diseño UX', wip: 1, kind: 'work', hint: 'Las cartillas solo de backend saltan esta columna' },
      { id: 'planned', name: 'Prototipo', wip: 1, kind: 'work', hint: 'Las cartillas solo de backend saltan esta columna' },
      { id: 'build', name: 'Listo para dev', wip: 3, kind: 'queue', hint: 'Cola de entrada a Desarrollo', stage: 'Construir' },
      { id: 'integrate', name: 'Desarrollo', wip: 3, kind: 'work', hint: 'Terminar antes de empezar' },
      { id: 'regress', name: 'Revisión', wip: 2, kind: 'check', hint: 'Revisión por pares obligatoria (DoD)' },
      { id: 'accept', name: 'Pruebas', wip: 1, kind: 'check', hint: 'Pruebas automatizadas en verde', stage: 'Entregar' },
      { id: 'deploy', name: 'Demo', wip: 1, kind: 'check', hint: 'Despliegue en entorno de validación' },
      { id: 'prod', name: 'MVP listo', wip: null, kind: 'end', hint: 'Cumple el DoD completo' },
    ],
    seed: [
      { id: "INC-01", key: "INC-01", title: "Categorías del informe", owner: "diego", cls: "urgent", lane: "feedback", points: 2, returns: 0, area: "Catálogo", note: "Alinear con TCG, Figuras/Funkos, Monedas, Cómics, Relojes y Retro", hu: "HU03", dod: {done: 0, total: 5}, skip: ["refined","planned"] },
      { id: "INC-02", key: "INC-02", title: "Ingreso con Google", owner: "josediego", cls: "urgent", lane: "feedback", points: 3, returns: 0, area: "Cuenta", note: "Habilitar OAuth en el backend; el cliente ya existe", hu: "HU01", dod: {done: 0, total: 5}, skip: ["refined","planned"] },
      { id: "INC-03", key: "INC-03", title: "API de compra", owner: "beth", cls: "date", lane: "feedback", points: 8, returns: 0, area: "Compras", note: "Crear operación, bloquear pieza vendida y evitar comprar la propia", hu: "HU05 esc. 1–3", dod: {done: 0, total: 6}, due: "20 nov", skip: ["refined","planned"] },
      { id: "INC-04", key: "INC-04", title: "Comprar desde la app", owner: "brenda", cls: "date", lane: "feedback", points: 5, returns: 0, area: "Compras", note: "Botón Comprar, confirmación y estado visible a ambas partes", hu: "HU05", dod: {done: 0, total: 6}, due: "24 nov", depends: ["INC-03"] },
      { id: "INC-05", key: "INC-05", title: "Cierre de la operación", owner: "brenda", cls: "date", lane: "feedback", points: 5, returns: 0, area: "Compras", note: "El vendedor confirma la entrega y el comprador la recepción; queda «completada»", hu: "HU05", dod: {done: 0, total: 6}, due: "24 nov", depends: ["INC-03"] },
      { id: "INC-06", key: "INC-06", title: "API de intercambio", owner: "beth", cls: "standard", lane: "feedback", points: 8, returns: 0, area: "Intercambio", note: "Propuestas pendiente/aceptada/rechazada y control de pieza comprometida", hu: "HU07 esc. 1–3", dod: {done: 0, total: 6}, skip: ["refined","planned"] },
      { id: "INC-07", key: "INC-07", title: "Intercambiar desde la app", owner: "diego", cls: "standard", lane: "feedback", points: 5, returns: 0, area: "Intercambio", note: "Proponer, aceptar o rechazar desde el detalle de la pieza", hu: "HU07", dod: {done: 0, total: 6}, depends: ["INC-06"] },
      { id: "INC-08", key: "INC-08", title: "Valorar al usuario", owner: "luis", cls: "standard", lane: "feedback", points: 5, returns: 0, area: "Reputación", note: "Solo tras una operación completada, una por operación", hu: "HU09 esc. 1–3", dod: {done: 0, total: 6}, depends: ["INC-05"] },
      { id: "INC-09", key: "INC-09", title: "Notificaciones push", owner: "diego", cls: "standard", lane: "feedback", points: 5, returns: 0, area: "Notificaciones", note: "Aviso de puja superada, compra e intercambio", hu: "HU10 esc. 1–3", dod: {done: 0, total: 7}, depends: ["INC-03","INC-06"], skip: ["refined","planned"] },
      { id: "INC-10", key: "INC-10", title: "Prueba de usabilidad", owner: "luis", cls: "date", lane: "feedback", points: 5, returns: 0, area: "Validación", note: "Tareas de registro, búsqueda, publicación y compra; medir KPI de 2.7", hu: "OE2, OE3", dod: {done: 0, total: 5}, due: "26 nov", depends: ["INC-04","INC-05"] },
      { id: "INC-11", key: "INC-11", title: "API de valorización", owner: "josediego", cls: "standard", lane: "feedback", points: 8, returns: 0, area: "IA", note: "5 fotos a Gemini, puntuación 10/8/6/4/2 no editable", hu: "HU11 esc. 2, 4, 5, Should", dod: {done: 0, total: 6}, skip: ["refined","planned"] },
      { id: "INC-12", key: "INC-12", title: "Valorizar desde la app", owner: "diego", cls: "standard", lane: "feedback", points: 5, returns: 0, area: "IA", note: "Activar u omitir, requisitos de foto y distintivo", hu: "HU11 esc. 1, 3, Should", dod: {done: 0, total: 6}, depends: ["INC-11"] },
    ],
    phrases: [
      'Ya está el MVP. Ahora, comprar e intercambiar.',
      'Primero lo urgente, luego la cadena de compra.',
      'En Kanban, la cartilla se asigna cuando alguien la jala.',
      'La IA cierra el sprint, si la capacidad alcanza.',
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
