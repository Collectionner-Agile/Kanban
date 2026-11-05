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
}

/** Área y detalle de cada nota: es lo que hace que el tablero se lea como trabajo real. */
const DETAILS: Record<string, [string, string]> = {
  'Encuesta de satisfacción': ['Clientes', 'Tres preguntas al terminar la compra'],
  'Exportar reportes en PDF': ['Reportes', 'Ventas del mes con el logo de la empresa'],
  'Avisos por correo': ['Correo', 'Compra confirmada y pedido enviado'],
  'Filtros en el catálogo': ['Catálogo', 'Precio, marca y disponibilidad'],
  'Factura electrónica': ['Pagos', 'Emitir el comprobante al confirmar el pago'],
  'Guía de bienvenida': ['Clientes', 'Tres pasos en la primera visita'],
  'Rediseño del checkout': ['Pagos', 'Reducir de cuatro a dos pantallas'],
  'Pantalla de perfil': ['Cuenta', 'Datos, direcciones y contraseña'],
  'Reglas de envío': ['Envíos', 'Costo por zona y peso del pedido'],
  'Error al pagar con tarjeta': ['Pagos', 'Falla con tarjetas de débito'],
  'Ingreso con Google': ['Cuenta', 'Entrar sin crear una contraseña'],
  'Panel de ventas': ['Reportes', 'Ventas del día y productos más pedidos'],
  'Carrito que no se pierde': ['Compras', 'Se conserva al cerrar la sesión'],
  'Catálogo de productos': ['Catálogo', 'Listado, detalle y fotos'],
  'Búsqueda rápida': ['Catálogo', 'Resultados mientras se escribe'],
  'Recuperar contraseña': ['Cuenta', 'Enlace por correo, válido una hora'],
  'Galería de fotos del producto': ['Catálogo', 'Varias fotos con zoom'],
  'Cierre de mes automático': ['Reportes', 'Se genera el último día'],
  'Caída del servidor de imágenes': ['Plataforma', 'Las fotos no cargan'],
  'Términos y condiciones': ['Legal', 'Aceptación antes de pagar'],
  'Página de contacto': ['Clientes', 'Formulario y número de WhatsApp'],
  'Lista de deseos': ['Clientes', 'Guardar productos para después'],
  'Reseñas de productos': ['Catálogo', 'Lo más pedido por los clientes'],
  'Modo oscuro': ['Plataforma', 'Sigue el ajuste del teléfono'],
  'Pago en cuotas': ['Pagos', 'De tres a doce cuotas con tarjeta'],
  'Cupones de descuento': ['Compras', 'Código por campaña, con vencimiento'],
  'Recomendaciones en el catálogo': ['Catálogo', 'Según lo que ya compró'],
  'Historial de compras': ['Cuenta', 'Repetir un pedido con un toque'],
  'Compartir carrito': ['Compras', 'Enlace para que otro lo pague'],
  'Acelerar la carga inicial': ['Plataforma', 'Menos de dos segundos en móvil'],
  'Fallo al aplicar envío gratis': ['Envíos', 'No se descuenta en pedidos grandes'],
  'Panel de ventas por región': ['Reportes', 'Mapa y ranking de zonas'],
  'Búsqueda con filtros': ['Catálogo', 'Combina texto y categorías'],
  'Reporte de inventario': ['Reportes', 'Stock bajo y sin movimiento'],
  'Aviso de envío por correo': ['Correo', 'Con el código de seguimiento'],
  'Pago con un toque': ['Pagos', 'Tarjeta guardada de forma segura'],
  'Cobro duplicado en cuotas': ['Pagos', 'Se cobra dos veces la primera'],
  'Chat de soporte': ['Clientes', 'Horario de oficina'],
  'Programa de puntos': ['Clientes', 'Se acumulan con cada compra'],
  'Devolución desde la cuenta': ['Compras', 'Sin llamar a soporte'],
  'Cierre fiscal de diciembre': ['Reportes', 'Formato para contabilidad'],
}

export const detailsOf = (title: string): Pick<Card, 'area' | 'note'> => {
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
  pool: Array<[string, ServiceClass, number]>
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
    goal: 'Que un cliente pueda comprar de principio a fin.',
    lanes: [
      { id: 'backlog', name: 'Backlog', wip: null, kind: 'queue', hint: 'Lo que entra al MVP, sin compromiso todavía', stage: 'Descubrir' },
      { id: 'analysis', name: 'Análisis', wip: 2, kind: 'work', hint: 'Entender qué necesita el cliente' },
      { id: 'ux', name: 'Diseño UX', wip: 2, kind: 'work', hint: 'Flujos y pantallas' },
      { id: 'prototype', name: 'Prototipo', wip: 2, kind: 'work', hint: 'Probar la idea antes de construirla' },
      { id: 'ready', name: 'Listo para dev', wip: 3, kind: 'queue', hint: 'Compromiso: desde aquí se construye', stage: 'Construir' },
      { id: 'dev', name: 'Desarrollo', wip: 3, kind: 'work', hint: 'Construcción' },
      { id: 'review', name: 'Revisión', wip: 2, kind: 'check', hint: 'Revisión de código' },
      { id: 'qa', name: 'Pruebas', wip: 2, kind: 'check', hint: 'Comprobar que funciona', stage: 'Entregar' },
      { id: 'demo', name: 'Demo', wip: 1, kind: 'check', hint: 'Mostrarlo al cliente' },
      { id: 'mvp', name: 'MVP listo', wip: null, kind: 'end', hint: 'Entregado' },
    ],
    seed: seedOf('MVP', [
      ['Encuesta de satisfacción', 'diego', 'improve', 'backlog', 2],
      ['Exportar reportes en PDF', 'luis', 'standard', 'backlog', 3],
      ['Avisos por correo', 'brenda', 'standard', 'backlog', 2],
      ['Filtros en el catálogo', 'josediego', 'standard', 'analysis', 3, { seedProgress: 0.4 }],
      ['Factura electrónica', 'diego', 'date', 'analysis', 5, { due: '2 oct', seedProgress: 0.2 }],
      ['Guía de bienvenida', 'beth', 'standard', 'ux', 2, { seedProgress: 0.6 }],
      ['Rediseño del checkout', 'brenda', 'standard', 'ux', 5, { seedProgress: 0.3 }],
      ['Pantalla de perfil', 'beth', 'improve', 'prototype', 3, { seedProgress: 0.5 }],
      ['Reglas de envío', 'luis', 'standard', 'ready', 3],
      ['Error al pagar con tarjeta', 'luis', 'urgent', 'dev', 3, { seedProgress: 0.7 }],
      ['Ingreso con Google', 'josediego', 'standard', 'dev', 2, { seedProgress: 0.4 }],
      ['Panel de ventas', 'diego', 'date', 'review', 5, { due: '25 sep', seedProgress: 0.25 }],
      ['Carrito que no se pierde', 'brenda', 'standard', 'qa', 3, { seedProgress: 0.35 }],
      ['Catálogo de productos', 'beth', 'standard', 'demo', 5, { seedProgress: 0.6 }],
      ['Búsqueda rápida', 'luis', 'standard', 'mvp', 2, { seedProgress: 1 }],
      ['Recuperar contraseña', 'josediego', 'standard', 'mvp', 1, { seedProgress: 1 }],
    ]),
    pool: [
      ['Galería de fotos del producto', 'standard', 3],
      ['Cierre de mes automático', 'date', 5],
      ['Caída del servidor de imágenes', 'urgent', 2],
      ['Términos y condiciones', 'date', 1],
      ['Página de contacto', 'improve', 1],
    ],
    phrases: [
      'Volvemos al MVP: que se pueda comprar, y ya.',
      'De vuelta a lo que sí o sí tiene que salir.',
      'Primero que funcione. Lo bonito viene después.',
      'Menos alcance y más entrega.',
    ],
  },
  2: {
    id: 2,
    name: 'Sprint 2',
    tag: 'Incremento',
    prefix: 'INC',
    color: '#0E0E10',
    dates: '12 de octubre al 6 de diciembre, semanas 8 a 15',
    goal: 'Comprar más rápido, y que quieran volver.',
    lanes: [
      { id: 'feedback', name: 'Feedback', wip: null, kind: 'queue', hint: 'Lo que dijeron los clientes del MVP', stage: 'Escuchar' },
      { id: 'ranked', name: 'Priorizado', wip: 3, kind: 'queue', hint: 'Ordenado por valor para el cliente' },
      { id: 'refined', name: 'Refinado', wip: 2, kind: 'work', hint: 'Detallado con el equipo' },
      { id: 'planned', name: 'Planificado', wip: 3, kind: 'queue', hint: 'Compromiso: entra a este sprint' },
      { id: 'build', name: 'Mejoras', wip: 3, kind: 'work', hint: 'Construcción del incremento', stage: 'Mejorar' },
      { id: 'integrate', name: 'Integración', wip: 2, kind: 'check', hint: 'Se une con lo que ya funciona' },
      { id: 'regress', name: 'Regresión', wip: 2, kind: 'check', hint: 'Confirmar que nada se rompió', stage: 'Publicar' },
      { id: 'accept', name: 'Aceptación', wip: 2, kind: 'check', hint: 'El cliente lo prueba' },
      { id: 'deploy', name: 'Despliegue', wip: 1, kind: 'check', hint: 'Sale una a la vez' },
      { id: 'prod', name: 'En producción', wip: null, kind: 'end', hint: 'En manos de los clientes' },
    ],
    seed: seedOf('INC', [
      ['Lista de deseos', 'beth', 'standard', 'feedback', 3],
      ['Reseñas de productos', 'luis', 'improve', 'feedback', 3],
      ['Modo oscuro', 'brenda', 'improve', 'feedback', 2],
      ['Pago en cuotas', 'diego', 'date', 'ranked', 5, { due: '5 dic' }],
      ['Cupones de descuento', 'josediego', 'standard', 'ranked', 3],
      ['Recomendaciones en el catálogo', 'brenda', 'standard', 'refined', 5, { seedProgress: 0.3 }],
      ['Historial de compras', 'luis', 'standard', 'refined', 2, { seedProgress: 0.65 }],
      ['Compartir carrito', 'josediego', 'improve', 'planned', 2],
      ['Acelerar la carga inicial', 'beth', 'improve', 'build', 3, { seedProgress: 0.5 }],
      ['Fallo al aplicar envío gratis', 'josediego', 'urgent', 'build', 2, { seedProgress: 0.8 }],
      ['Panel de ventas por región', 'diego', 'standard', 'integrate', 5, { seedProgress: 0.15 }],
      ['Búsqueda con filtros', 'brenda', 'standard', 'regress', 3, { seedProgress: 0.45 }],
      ['Reporte de inventario', 'diego', 'date', 'accept', 3, { due: '20 nov', seedProgress: 0.3 }],
      ['Aviso de envío por correo', 'beth', 'date', 'deploy', 1, { due: '12 nov', seedProgress: 0.7 }],
      ['Pago con un toque', 'luis', 'standard', 'prod', 3, { seedProgress: 1 }],
    ]),
    pool: [
      ['Cobro duplicado en cuotas', 'urgent', 2],
      ['Chat de soporte', 'standard', 5],
      ['Programa de puntos', 'improve', 5],
      ['Devolución desde la cuenta', 'standard', 3],
      ['Cierre fiscal de diciembre', 'date', 3],
    ],
    phrases: [
      'Ya está el MVP. Ahora, lo que pidieron los clientes.',
      'Lo que no entró al MVP, entra aquí.',
      'Segunda vuelta: menos supuestos, más feedback.',
      'Toca mejorar lo que ya funciona.',
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
