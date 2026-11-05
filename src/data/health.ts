import type { HealthState } from '../engine/clock'

export const HEALTH: Record<HealthState, { label: string; color: string; help: string }> = {
  waiting: { label: 'Sin iniciar', color: 'var(--state-waiting)', help: 'Todavía no empieza.' },
  ontrack: { label: 'En curso', color: 'var(--state-ontrack)', help: 'Avanza dentro de lo planificado.' },
  regular: { label: 'Regular', color: 'var(--state-regular)', help: 'Por vencer, regresó o espera lugar en el carril.' },
  critical: { label: 'Crítico', color: 'var(--state-critical)', help: 'Se pasó de la hora planificada.' },
  complete: { label: 'Completo', color: 'var(--state-complete)', help: 'Ya se entregó.' },
}
export const HEALTH_ORDER: HealthState[] = ['waiting', 'ontrack', 'regular', 'critical', 'complete']
