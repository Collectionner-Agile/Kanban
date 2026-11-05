import { useEffect, useMemo, useState } from 'react'
import { SPRINTS, type Lane, type LaneId, type SprintId } from '../data/board'
import { useBoard, getState } from '../store/board'

type Sample = [number, number, number, number]

const WIDTH = 460
const HEIGHT = 92

/** Reparte cada carril en su etapa. La última banda siempre es lo entregado. */
function stagesOf(lanes: Lane[]) {
  const groups: Array<{ name: string; lanes: LaneId[] }> = []
  for (const lane of lanes) {
    if (lane.kind === 'end') continue
    if (lane.stage) groups.push({ name: lane.stage, lanes: [lane.id] })
    else groups[groups.length - 1].lanes.push(lane.id)
  }
  return groups
}

function sampleNow(sprint: SprintId): Sample {
  const { cards, archived } = getState()
  const lanes = SPRINTS[sprint].lanes
  const groups = stagesOf(lanes)
  const end = lanes[lanes.length - 1].id
  const inGroup = (i: number) => cards.filter((c) => groups[i].lanes.includes(c.lane)).length
  return [cards.filter((c) => c.lane === end).length + archived, inGroup(2), inGroup(1), inGroup(0)]
}

/**
 * Diagrama de flujo acumulado: la gráfica clásica de Kanban. Se dibuja con lo que pasa de verdad
 * en el tablero desde que lo abriste, no con datos de adorno.
 */
export function FlowChart() {
  const sprint = useBoard((s) => s.sprint)
  const scene = useBoard((s) => s.scene)
  const [history, setHistory] = useState<Partial<Record<SprintId, Sample[]>>>({})

  useEffect(() => {
    const take = () => {
      if (getState().scene !== 'live' && getState().scene !== 'enter') return
      const next = sampleNow(sprint)
      setHistory((h) => ({ ...h, [sprint]: [...(h[sprint] ?? [next]), next].slice(-90) }))
    }
    take()
    const timer = window.setInterval(take, 1500)
    return () => window.clearInterval(timer)
  }, [sprint, scene])

  const samples = history[sprint] ?? [sampleNow(sprint)]
  const now = samples[samples.length - 1]
  const groups = useMemo(() => stagesOf(SPRINTS[sprint].lanes), [sprint])

  const peak = Math.max(...samples.map((s) => s[0] + s[1] + s[2] + s[3]), 1)
  const x = (i: number) => (samples.length === 1 ? WIDTH : (i / (samples.length - 1)) * WIDTH)
  const y = (v: number) => HEIGHT - (v / peak) * HEIGHT

  // Cuatro bandas apiladas, de abajo hacia arriba.
  const band = (from: number, to: number) => {
    const sum = (s: Sample, n: number) => s.slice(0, n).reduce((a, b) => a + b, 0)
    const top = samples.map((s, i) => `${x(i).toFixed(1)},${y(sum(s, to)).toFixed(1)}`)
    const bottom = samples.map((s, i) => `${x(i).toFixed(1)},${y(sum(s, from)).toFixed(1)}`).reverse()
    if (samples.length === 1) return `M0,${y(sum(samples[0], to))} H${WIDTH} V${y(sum(samples[0], from))} H0 Z`
    return `M${top.join(' L')} L${bottom.join(' L')} Z`
  }

  const legend = [
    { label: 'Entregadas', value: now[0], color: 'var(--accent)', opacity: 1 },
    { label: groups[2]?.name, value: now[1], color: 'var(--ink)', opacity: 0.82 },
    { label: groups[1]?.name, value: now[2], color: 'var(--ink)', opacity: 0.42 },
    { label: groups[0]?.name, value: now[3], color: 'var(--ink)', opacity: 0.16 },
  ]

  return (
    <figure className="m-0 flex items-end gap-5 pb-8" aria-label={`Flujo acumulado: ${legend.map((l) => `${l.value} en ${l.label}`).join(', ')}`}>
      <div>
        <figcaption className="mb-1.5 text-[13px] font-medium tracking-[-0.005em]">Flujo acumulado</figcaption>
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" className="block overflow-hidden rounded-[8px]">
          {legend
            .slice()
            .reverse()
            .map((item, i) => (
              <path key={item.label ?? i} d={band(3 - i, 4 - i)} fill={item.color} opacity={item.opacity} />
            ))}
        </svg>
      </div>
      <ul className="m-0 list-none space-y-1 p-0 text-[13px]">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-2 whitespace-nowrap">
            <i className="size-2 rounded-[2px]" style={{ backgroundColor: item.color, opacity: item.opacity }} />
            <span className="w-5 text-right font-medium">{item.value}</span>
            <span className="text-soft">{item.label}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
