import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CLASSES, LANE, SPRINTS, type ServiceClass, type SprintId } from '../data/board'
import { SCENARIOS, STORIES, TASKS, type Scenario, type TaskStatus } from '../data/backlog'
import { MOBILE, MOBILE_SOURCE, type MobileState } from '../data/mobile'
import { useClock } from '../engine/clock'
import { LIVE_MS, METER_SAMPLES, SPRINT_DAYS, flowAt, landsBefore, localTime, meterAt, scriptFor } from '../engine/script'
import { useBoard } from '../store/board'
import { Close } from './icons'

/* ---------- Piezas comunes ---------- */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [])
  return [ref, width] as const
}

function Panel({ title, hint, children, wide }: { title: string; hint: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`min-w-0 rounded-[18px] bg-card p-4 shadow-[var(--shadow-card)] ${wide ? 'lg:col-span-2' : ''}`}>
      <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-0.5 mb-3 text-[13px] leading-[1.35] text-soft">{hint}</p>
      {children}
    </section>
  )
}

function TableView({ head, rows }: { head: string[]; rows: Array<Array<string | number>> }) {
  return (
    <details className="mt-3 text-[12.5px]">
      <summary className="cursor-pointer text-soft hover:text-ink">Ver como tabla</summary>
      <div className="mt-2 max-h-[220px] overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>{head.map((h) => <th key={h} className="sticky top-0 bg-card py-1 pr-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-line">
                {row.map((cell, j) => <td key={j} className="py-1 pr-3 text-soft">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/* ---------- Gráfica de líneas con cursor ---------- */

type Series = { name: string; values: number[]; color: string; dashed?: boolean; step?: boolean; total?: boolean }

const CHART_H = 168
const PAD = { top: 14, right: 74, bottom: 22, left: 28 }
const dayOf = (i: number) => Math.min(SPRINT_DAYS, Math.floor((i / Math.max(METER_SAMPLES - 1, 1)) * SPRINT_DAYS) + 1)

function LineChart({ series, max, limit, unit, firstDay, lastDay }: { series: Series[]; max: number; limit?: { value: number; label: string }; unit: string; firstDay: string; lastDay: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const innerW = Math.max(60, width - PAD.left - PAD.right)
  const innerH = CHART_H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i / Math.max(METER_SAMPLES - 1, 1)) * innerW
  const y = (v: number) => PAD.top + innerH - (v / Math.max(max, 1)) * innerH
  const path = (s: Series) => s.values.map((v, i) => (i === 0 ? `M${x(0)},${y(v)}` : s.step ? `H${x(i)} V${y(v)}` : `L${x(i)},${y(v)}`)).join(' ')
  const ticks = [0, Math.round(max / 2), max]
  const shown = hover === null ? null : series.map((s) => ({ s, value: s.values[Math.min(hover, s.values.length - 1)], has: hover < s.values.length }))

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={CHART_H}
        role="img"
        aria-label={series.map((s) => `${s.name}: ${s.values[s.values.length - 1]} ${unit}`).join(', ')}
        className="block touch-pan-y"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const at = Math.round(((e.clientX - box.left - PAD.left) / innerW) * (METER_SAMPLES - 1))
          setHover(Math.max(0, Math.min(METER_SAMPLES - 1, at)))
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">{t}</text>
          </g>
        ))}
        <text x={PAD.left} y={CHART_H - 6} fontSize="11" fill="var(--faint)">{firstDay}</text>
        <text x={PAD.left + innerW} y={CHART_H - 6} textAnchor="end" fontSize="11" fill="var(--faint)">{lastDay}</text>
        {limit && (
          <g>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y(limit.value)} y2={y(limit.value)} stroke="var(--soft)" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={PAD.left + innerW + 6} y={y(limit.value) + 4} fontSize="11" fill="var(--soft)">{limit.label}</text>
          </g>
        )}
        {series.map((s) => (
          <path key={s.name} d={path(s)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '2 5' : undefined} />
        ))}
        {series.map((s) => {
          const last = s.values.length - 1
          return (
            <g key={s.name}>
              <circle cx={x(last)} cy={y(s.values[last])} r="4" fill={s.color} stroke="var(--card)" strokeWidth="2" />
              <text x={Math.min(x(last) + 8, width - 66)} y={y(s.values[last]) - 7} fontSize="11.5" fontWeight="500" fill="var(--ink)">
                {s.values[last]} {s.name.toLowerCase()}
              </text>
            </g>
          )
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--line-strong)" />}
      </svg>
      {hover !== null && shown && (
        <div
          role="status"
          className="pointer-events-none absolute top-1 z-10 rounded-[10px] bg-[var(--island)] px-2.5 py-1.5 text-[12px] leading-[1.35] whitespace-nowrap text-white"
          style={x(hover) > width / 2 ? { right: width - x(hover) + 8 } : { left: x(hover) + 8 }}
        >
          <div className="opacity-70">Día {dayOf(hover)} de {SPRINT_DAYS}</div>
          {shown.map(({ s, value, has }) => <div key={s.name}>{s.name}: {has ? `${value} ${unit}` : 'todavía no'}</div>)}
        </div>
      )}
      {series.length > 1 && (
        <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12.5px] text-soft">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <svg width="18" height="4" aria-hidden="true"><line x1="1" x2="17" y1="2" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={s.dashed ? '2 5' : undefined} /></svg>
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- WIP por columna: una casilla por cada lugar que permite el límite ---------- */

function WipBars({ sprint, counts }: { sprint: SprintId; counts: number[] }) {
  const lanes = SPRINTS[sprint].lanes
  const active = lanes.map((lane, i) => ({ lane, count: counts[i] })).filter(({ lane }) => lane.kind === 'work' || lane.kind === 'check')
  const most = Math.max(...active.map(({ lane, count }) => Math.max(lane.wip ?? 0, count)), 1)
  return (
    <>
      <ul className="m-0 list-none space-y-2 p-0">
        {active.map(({ lane, count }) => {
          const limit = lane.wip ?? 0
          const over = count > limit
          const cells = Math.max(limit, count)
          return (
            <li key={lane.id} className="grid grid-cols-[92px_1fr_auto] items-center gap-2 text-[13px]" title={`${lane.name}: ${count} de ${limit}. ${lane.hint}`}>
              <span className="truncate">{lane.name}</span>
              <span className="flex gap-[2px]" style={{ width: `${(cells / most) * 100}%`, minWidth: 18 }}>
                {Array.from({ length: cells }, (_, i) => (
                  <i
                    key={i}
                    className="h-3 min-w-0 flex-1 rounded-[3px]"
                    style={{ backgroundColor: i < count ? (i >= limit ? 'var(--state-critical)' : 'var(--ink)') : 'var(--lane)', boxShadow: i < count ? undefined : 'inset 0 0 0 1px var(--line)' }}
                  />
                ))}
              </span>
              <span className={`whitespace-nowrap tabular-nums ${over ? 'font-medium text-[var(--state-critical)]' : 'text-soft'}`}>
                {count} de {limit}{over ? ', sobre el límite' : ''}
              </span>
            </li>
          )
        })}
      </ul>
      <TableView head={['Columna', 'Cartillas', 'Límite', 'Política']} rows={active.map(({ lane, count }) => [lane.name, count, lane.wip ?? '', lane.hint])} />
    </>
  )
}

/* ---------- Flujo acumulado ---------- */

function FlowBands({ sprint, local }: { sprint: SprintId; local: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const samples = flowAt(sprint, local)
  const stages = useMemo(() => SPRINTS[sprint].lanes.filter((l) => l.stage).map((l) => l.stage as string), [sprint])
  const total = SPRINTS[sprint].seed.length
  const height = 132
  const x = (i: number) => (i / Math.max(METER_SAMPLES - 1, 1)) * width
  const y = (v: number) => height - (v / Math.max(total, 1)) * height
  const legend = [
    { label: SPRINTS[sprint].lanes[SPRINTS[sprint].lanes.length - 1].name, color: 'var(--accent)', opacity: 1 },
    { label: stages[2], color: 'var(--ink)', opacity: 0.82 },
    { label: stages[1], color: 'var(--ink)', opacity: 0.42 },
    { label: stages[0], color: 'var(--ink)', opacity: 0.16 },
  ]
  const band = (from: number, to: number) => {
    const sum = (s: number[], n: number) => s.slice(0, n).reduce((a, b) => a + b, 0)
    const top = samples.map((s, i) => `${x(i).toFixed(1)},${y(sum(s, to)).toFixed(1)}`)
    const bottom = samples.map((s, i) => `${x(i).toFixed(1)},${y(sum(s, from)).toFixed(1)}`).reverse()
    if (samples.length === 1) return `M0,${y(sum(samples[0], to))} H${Math.max(x(1), 2)} V${y(sum(samples[0], from))} H0 Z`
    return `M${top.join(' L')} L${bottom.join(' L')} Z`
  }
  const now = samples[samples.length - 1]
  return (
    <div ref={ref}>
      <svg width={width} height={height} role="img" aria-label={legend.map((l, i) => `${now[i]} en ${l.label}`).join(', ')} className="block rounded-[8px] bg-[var(--lane)]">
        {legend.map((item, i) => <path key={item.label} d={band(i, i + 1)} fill={item.color} opacity={item.opacity} />)}
      </svg>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12.5px]">
        {legend.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <i className="size-2 rounded-[2px]" style={{ backgroundColor: item.color, opacity: item.opacity }} />
            <b className="font-medium tabular-nums">{now[i]}</b>
            <span className="text-soft">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- Escenarios Gherkin ---------- */

type Coverage = 'verified' | 'tested' | 'partial' | 'open'
const COVERAGE: Record<Coverage, { label: string; color: string; opacity: number }> = {
  verified: { label: 'Verificado en la función', color: 'var(--accent)', opacity: 1 },
  tested: { label: 'Con prueba automatizada', color: 'var(--ink)', opacity: 0.82 },
  partial: { label: 'Prueba parcial', color: 'var(--ink)', opacity: 0.36 },
  open: { label: 'Sin prueba', color: 'var(--ink)', opacity: 0.1 },
}
const COVERAGE_ORDER: Coverage[] = ['verified', 'tested', 'partial', 'open']

function Scenarios({ sprint, ended }: { sprint: SprintId; ended: Set<string> }) {
  const mine = SCENARIOS.filter((s) => s.sprint === sprint)
  const cover = (s: Scenario): Coverage => (s.cards.length && s.cards.every((c) => ended.has(c)) ? 'verified' : s.test === 'Sí' ? 'tested' : s.test === 'Parcial' ? 'partial' : 'open')
  const groups = STORIES.map((story) => ({ story, list: mine.filter((s) => s.hu === story.id) })).filter((g) => g.list.length)
  const count = (kind: Coverage) => mine.filter((s) => cover(s) === kind).length
  return (
    <>
      <ul className="m-0 list-none space-y-2 p-0">
        {groups.map(({ story, list }) => (
          <li key={story.id} className="grid gap-x-3 gap-y-1 text-[13px] sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center">
            <span className="truncate" title={`${story.id} ${story.title}, ${story.moscow}`}>
              <b className="font-medium">{story.id}</b> <span className="text-soft">{story.title}</span>
            </span>
            <span className="flex flex-wrap gap-[2px]">
              {[...list].sort((a, b) => COVERAGE_ORDER.indexOf(cover(a)) - COVERAGE_ORDER.indexOf(cover(b))).map((s) => {
                const kind = COVERAGE[cover(s)]
                return (
                  <i
                    key={s.id}
                    tabIndex={0}
                    title={`${s.id}: ${s.title}. ${s.happy ? 'Camino feliz' : 'Camino de error'}. ${kind.label}.`}
                    aria-label={`${s.id}: ${s.title}. ${kind.label}`}
                    className="relative block h-4 w-6 rounded-[3px] outline-offset-1"
                  >
                    <i className="absolute inset-0 rounded-[3px]" style={{ backgroundColor: kind.color, opacity: kind.opacity }} />
                    {!s.happy && <i className="absolute inset-x-1 bottom-[3px] h-[2px] rounded-full bg-card" />}
                  </i>
                )
              })}
            </span>
          </li>
        ))}
      </ul>
      <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12.5px]">
        {COVERAGE_ORDER.map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-[2px]" style={{ backgroundColor: COVERAGE[kind].color, opacity: COVERAGE[kind].opacity }} />
            <b className="font-medium tabular-nums">{count(kind)}</b>
            <span className="text-soft">{COVERAGE[kind].label}</span>
          </li>
        ))}
        <li className="text-soft">La raya marca un camino de error.</li>
      </ul>
      <TableView head={['Escenario', 'Historia', 'Tipo', 'Estado']} rows={mine.map((s) => [s.title, s.hu, s.happy ? 'Feliz' : 'Error', COVERAGE[cover(s)].label])} />
    </>
  )
}

/* ---------- Los seis pasos de STATIK, medidos ---------- */

const CLASS_COLOR: Record<ServiceClass, string> = { urgent: 'var(--viz-urgent)', date: 'var(--viz-date)', standard: 'var(--viz-standard)', improve: 'var(--faint)' }

function Statik({ sprint, local, wip, ended }: { sprint: SprintId; local: number; wip: number; ended: Set<string> }) {
  const script = scriptFor(sprint)
  const { seed, lanes } = SPRINTS[sprint]
  const points = seed.reduce((n, c) => n + c.points, 0)
  const lands = script.lands.slice(0, landsBefore(sprint, local))
  const stops = script.events.filter((e) => e.kind === 'full' && e.at <= local).length
  const firstMove = new Map<string, number>()
  lands.forEach((l) => {
    if (!firstMove.has(l.card)) firstMove.set(l.card, l.at)
  })
  const finished = lands.filter((l) => l.kind === 'done')
  const dayMs = LIVE_MS / SPRINT_DAYS
  const cycle = finished.length ? finished.reduce((n, l) => n + (l.at - Math.min(firstMove.get(l.card) ?? 0, l.at)), 0) / finished.length / dayMs : 0
  const donePoints = seed.filter((c) => ended.has(c.id)).reduce((n, c) => n + c.points, 0)
  const sample = meterAt(sprint, local).at(-1)
  const crowded = lanes.map((lane, i) => ({ lane, count: sample?.lanes[i] ?? 0 })).filter(({ lane }) => lane.wip !== null && lane.kind !== 'queue').sort((a, b) => b.count / (b.lane.wip ?? 1) - a.count / (a.lane.wip ?? 1))[0]
  const over = lanes.filter((lane, i) => lane.wip !== null && (sample?.lanes[i] ?? 0) > lane.wip).length
  const limit = lanes.filter((l) => l.kind === 'work' || l.kind === 'check').reduce((n, l) => n + (l.wip ?? 0), 0)
  const classes = (Object.keys(CLASSES) as ServiceClass[]).map((cls) => {
    const own = seed.filter((c) => c.cls === cls)
    return { cls, count: own.length, points: own.reduce((n, c) => n + c.points, 0), done: own.filter((c) => ended.has(c.id)).length }
  }).filter((x) => x.count)

  const steps: Array<{ name: string; value: string; text: ReactNode }> = [
    {
      name: 'Insatisfacción',
      value: `${stops} ${stops === 1 ? 'freno' : 'frenos'}`,
      text: sprint === 1 ? 'Veces que el WIP detuvo el paso. El Excel registra 11 cartillas en Revisión con límite 2.' : 'Veces que el WIP detuvo el paso en este sprint.',
    },
    {
      name: 'Demanda',
      value: `${seed.length} cartillas`,
      text: `${points} puntos comprometidos. Los dos sprints suman 24 cartillas y 125 puntos.`,
    },
    {
      name: 'Capacidad',
      value: `${donePoints} de ${points} puntos`,
      text: finished.length ? `${finished.length} entregadas, con un ciclo medio de ${cycle.toFixed(1).replace('.', ',')} días de sprint.` : 'Todavía no se entrega ninguna en esta función.',
    },
    {
      name: 'Flujo',
      value: `${lanes.length} columnas`,
      text: crowded && crowded.count ? `Ahora pesa más ${crowded.lane.name}, con ${crowded.count} de ${crowded.lane.wip}.` : 'Ninguna columna activa tiene trabajo ahora.',
    },
    {
      name: 'Clases de servicio',
      value: `${classes.length} ${classes.length === 1 ? 'clase' : 'clases'}`,
      text: (
        <>
          <span className="my-1.5 flex h-2 gap-[2px] overflow-hidden rounded-[3px]">
            {classes.map((x) => <i key={x.cls} style={{ flexGrow: x.points, backgroundColor: CLASS_COLOR[x.cls] }} />)}
          </span>
          <span className="flex flex-wrap gap-x-3">
            {classes.map((x) => (
              <span key={x.cls} className="flex items-center gap-1.5">
                <i className="size-2 rounded-[2px]" style={{ backgroundColor: CLASS_COLOR[x.cls] }} />
                {CLASSES[x.cls].label}, {x.points} puntos, {x.done} de {x.count}
              </span>
            ))}
          </span>
        </>
      ),
    },
    {
      name: 'Sistema kanban',
      value: `WIP ${wip} de ${limit}`,
      text: `${limit / 5} por persona, en equipo de 5. ${over === 0 ? 'Ninguna columna sobre su límite.' : `${over} sobre su límite.`}`,
    },
  ]
  return (
    <ol className="m-0 grid list-none gap-x-5 gap-y-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.name} className="min-w-0 border-t pt-2.5" style={{ borderColor: 'var(--line-strong)' }}>
          <p className="text-[12.5px] text-soft"><span className="tabular-nums">{i + 1}.</span> {step.name}</p>
          <p className="mt-0.5 text-[21px] leading-[1.2] font-semibold tracking-[-0.02em] tabular-nums">{step.value}</p>
          <div className="mt-1 text-[13px] leading-[1.35] text-soft">{step.text}</div>
        </li>
      ))}
    </ol>
  )
}

/* ---------- Actividades de la app móvil ---------- */

const STATE_COLOR: Record<MobileState, string> = { Hecho: 'var(--state-complete)', 'A medias': 'var(--state-regular)', 'Por crear': 'var(--state-waiting)', 'Por decidir': 'var(--state-ontrack)' }
const TASK_MARK: Record<TaskStatus, { mark: string; label: string }> = {
  Hecha: { mark: '✓', label: 'Hecha' },
  'Por verificar': { mark: '◐', label: 'Por verificar' },
  Pendiente: { mark: '○', label: 'Pendiente' },
}

function Activities({ sprint }: { sprint: SprintId }) {
  const cards = SPRINTS[sprint].seed
  const tasks = TASKS.filter((t) => cards.some((c) => c.key === t.card))
  const done = tasks.filter((t) => t.status === 'Hecha').length
  const states = (['Hecho', 'A medias', 'Por decidir', 'Por crear'] as MobileState[]).map((state) => ({ state, count: cards.filter((c) => MOBILE[c.key]?.state === state).length })).filter((x) => x.count)
  return (
    <>
      <p className="mb-3 text-[13px] leading-[1.4] text-soft">
        {done} de {tasks.length} tareas hechas en este sprint, y {TASKS.filter((t) => t.status === 'Hecha').length} de {TASKS.length} en total.{' '}
        {states.map((x) => `${x.count} ${x.state.toLowerCase()}`).join(', ')}.
      </p>
      <ul className="m-0 list-none p-0">
        {cards.map((card) => {
          const link = MOBILE[card.key]
          const own = TASKS.filter((t) => t.card === card.key)
          const finished = own.filter((t) => t.status === 'Hecha').length
          return (
            <li key={card.id} className="border-t border-line">
              <details className="group">
                <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 py-2.5 text-[13.5px] sm:grid-cols-[64px_1fr_96px_72px]">
                  <span className="hidden font-medium tabular-nums sm:inline">{card.key}</span>
                  <span className="min-w-0 font-medium">
                    <span className="sm:hidden">{card.key} </span>
                    {card.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-[12.5px] whitespace-nowrap max-sm:row-start-2">
                    <i className="size-2 rounded-full" style={{ backgroundColor: STATE_COLOR[link.state] }} />
                    {link.state}
                  </span>
                  <span className="text-right text-[12.5px] text-soft tabular-nums max-sm:col-start-2 max-sm:row-start-1">{finished} de {own.length}</span>
                </summary>
                <div className="pb-3 text-[13px] leading-[1.4] sm:pl-[76px]">
                  <p className="text-soft">{link.note}</p>
                  <p className="mt-1 text-[12.5px] text-faint"><span translate="no">{link.where}</span>, {link.route}</p>
                  <ul className="m-0 mt-2 list-none space-y-1 p-0">
                    {own.map((task) => (
                      <li key={task.id} className="grid grid-cols-[16px_1fr] gap-1.5" title={task.evidence}>
                        <span aria-label={TASK_MARK[task.status].label} className={task.status === 'Hecha' ? 'text-[var(--state-complete)]' : 'text-soft'}>{TASK_MARK[task.status].mark}</span>
                        <span>
                          {task.task} <span className="text-faint">{task.who}, {task.type.toLowerCase()}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 border-t border-line pt-2 text-[12px] text-faint">Fuente: backlog_kanban_collectioneer.xlsx, {MOBILE_SOURCE}.</p>
    </>
  )
}

/* ---------- El panel ---------- */

const RANGE: Record<SprintId, [string, string]> = { 1: ['2 nov', '13 nov'], 2: ['16 nov', '27 nov'] }

export default function Metrics({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const sprint = useBoard((s) => s.sprint)
  const step = useClock((now) => Math.floor(Math.max(0, Math.min(localTime(sprint, now), LIVE_MS)) / 2000))
  const local = step * 2000

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  const meter = meterAt(sprint, local)
  const now = meter[meter.length - 1]
  const { seed, lanes } = SPRINTS[sprint]
  const points = seed.reduce((n, c) => n + c.points, 0)
  const limit = lanes.filter((l) => l.kind === 'work' || l.kind === 'check').reduce((n, l) => n + (l.wip ?? 0), 0)
  const ended = useMemo(() => new Set(scriptFor(sprint).lands.slice(0, landsBefore(sprint, local)).filter((l) => LANE[l.to].kind === 'end').map((l) => l.card)), [sprint, local])
  const ideal = useMemo(() => Array.from({ length: METER_SAMPLES }, (_, i) => Math.round(points * (1 - i / (METER_SAMPLES - 1)))), [points])
  const [firstDay, lastDay] = RANGE[sprint]

  return (
    <dialog
      ref={dialog}
      aria-labelledby="metrics-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
      className="metrics m-0 ml-auto h-dvh max-h-none w-[min(1040px,100vw)] max-w-none overflow-y-auto bg-canvas p-0 text-ink backdrop:bg-black/35"
    >
      {open && (
        <motion.div initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} className="px-4 pb-10 sm:px-6" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
          <header style={{ top: 'env(safe-area-inset-top, 0px)' }} className="sticky z-20 -mx-4 flex items-start justify-between gap-3 bg-canvas px-4 py-2 sm:-mx-6 sm:px-6">
            <div className="min-w-0">
              <h2 id="metrics-title" className="text-[22px] leading-[1.15] font-semibold tracking-[-0.025em]">Medición, {SPRINTS[sprint].name}</h2>
              <p className="mt-0.5 text-[13px] text-soft">{SPRINTS[sprint].dates}</p>
            </div>
            <button type="button" aria-label="Cerrar la medición" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-card shadow-[var(--shadow-card)]">
              <Close size={14} />
            </button>
          </header>

          <p className="mt-2 mb-4 max-w-[70ch] text-[13.5px] leading-[1.4] text-soft">
            Las gráficas miden la función del tablero: 6 minutos representan los {SPRINT_DAYS} días hábiles del sprint. Las actividades muestran el estado real del Excel y del repositorio.
          </p>

          <section className="rounded-[18px] bg-card p-4 shadow-[var(--shadow-card)]">
            <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">Los seis pasos de STATIK</h3>
            <Statik sprint={sprint} local={local} wip={now.wip} ended={ended} />
          </section>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Panel title="WIP por columna" hint="Cada casilla es un lugar que permite el límite.">
              <WipBars sprint={sprint} counts={now.lanes} />
            </Panel>
            <Panel title="WIP activo" hint={`Cartillas en columnas activas. Límite del Excel: ${limit}.`}>
              <LineChart
                series={[{ name: 'En curso', values: meter.map((m) => m.wip), color: 'var(--ink)', step: true }]}
                max={Math.max(limit, ...meter.map((m) => m.wip))}
                limit={{ value: limit, label: 'Límite' }}
                unit="cartillas"
                firstDay={firstDay}
                lastDay={lastDay}
              />
              <TableView head={['Día', 'En curso']} rows={meter.filter((_, i) => i % 8 === 0).map((m) => [`Día ${dayOf(m.at / 4000)}`, m.wip])} />
            </Panel>
            <Panel title="Burndown" hint={`Puntos que faltan para llegar a ${lanes[lanes.length - 1].name}.`}>
              <LineChart
                series={[
                  { name: 'Real', values: meter.map((m) => m.remaining), color: 'var(--ink)', step: true },
                  { name: 'Ideal', values: ideal, color: 'var(--soft)', dashed: true },
                ]}
                max={points}
                unit="puntos"
                firstDay={firstDay}
                lastDay={lastDay}
              />
              <TableView head={['Día', 'Real', 'Ideal']} rows={meter.filter((_, i) => i % 8 === 0).map((m) => [`Día ${dayOf(m.at / 4000)}`, m.remaining, ideal[m.at / 4000]])} />
            </Panel>
            <Panel title="Flujo acumulado" hint="Cuántas cartillas hay en cada etapa. Una banda que se ensancha es trabajo que se acumula.">
              <FlowBands sprint={sprint} local={local} />
            </Panel>
            <Panel wide title="Escenarios de aceptación" hint="Cada casilla es un escenario Gherkin del informe. Se verifica en la función cuando su cartilla llega al final.">
              <Scenarios sprint={sprint} ended={ended} />
            </Panel>
            <Panel wide title="Actividades de la app móvil" hint="Cartilla por cartilla: qué existe en el repositorio, qué falta y sus tareas del DoD.">
              <Activities sprint={sprint} />
            </Panel>
          </div>
        </motion.div>
      )}
    </dialog>
  )
}
